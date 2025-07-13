'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import {
  getAllUserDetails,
  getDepartments,
  createUser,
  deleteUser,
  getPermissions,
  UserCreateRequest,
  Department,
  Permission as ApiPermission
} from '@/utils/apiService';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

// Use a more specific type for our local permissions
type AccountPermission = string | { PermissionName: string };

interface User {
  UserID: number | string;
  Username: string;
  Email: string;
  FirstName?: string;
  LastName?: string;
  UserRole: string;
  departments?: Array<{ id: number, name: string }>;
  permissions?: string[];
  IsActive?: boolean;
}

interface Account {
  id: string;
  username: string;
  email: string;
  role: string;
  department: string;
  permissions: AccountPermission[];
  status: 'active' | 'inactive';
  selectedDepartments?: number[];
}

interface NewAccount {
  username: string;
  password: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  permissions: AccountPermission[];
}

export default function AccountsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const t = translations[language].accounts;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccount, setNewAccount] = useState<NewAccount>({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'user',
    department: '',
    permissions: []
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<ApiPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [inputPage, setInputPage] = useState('');
  const accountsPerPage = 10;

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');

  // Active tab state
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // Fallback permissions in case API fails
  const defaultPermissions: ApiPermission[] = [
    { permission_id: 1, permission_name: 'chat', description: t.permissions.chat },
    { permission_id: 2, permission_name: 'accounts', description: t.permissions.accounts },
    { permission_id: 3, permission_name: 'reports', description: t.permissions.reports },
    { permission_id: 4, permission_name: 'settings', description: t.permissions.settings }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch permissions from API
        try {
          setPermissionsLoading(true);
          const permissionsData = await getPermissions();
          if (permissionsData && permissionsData.length > 0) {
            setAvailablePermissions(permissionsData);
            console.log('Fetched permissions:', permissionsData);
          } else {
            console.warn('No permissions returned from API, using defaults');
            setAvailablePermissions(defaultPermissions);
          }
        } catch (error) {
          console.error('Error fetching permissions:', error);
          setAvailablePermissions(defaultPermissions);
        } finally {
          setPermissionsLoading(false);
        }

        // Fetch departments
        try {
          const deptData = await getDepartments();
          setDepartments(deptData);
        } catch (error) {
          console.error('Error fetching departments:', error);
          const storedDepartments = localStorage.getItem('departments');
          if (storedDepartments) {
            setDepartments(JSON.parse(storedDepartments));
          }
        }

        // Fetch users from the API with detailed information
        const userData = await getAllUserDetails();
        console.log('Fetched users with details:', userData);

        // Transform API data to match the Account interface
        const transformedAccounts = userData.map((user: User) => ({
          id: String(user.UserID),
          username: user.Username,
          email: user.Email,
          role: user.UserRole || 'user',
          department: user.departments && user.departments.length > 0
            ? user.departments[0].name || // Try lowercase first (original code)
            (user.departments[0] as any).Name || // Try uppercase (API response)
            '' // Fallback if neither exists
            : '',
          permissions: user.permissions || [],
          status: user.IsActive ? 'active' : 'inactive'
        } as Account));

        setAccounts(transformedAccounts);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load accounts');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Store the original accounts data when it's first loaded
  const [originalAccounts, setOriginalAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (accounts.length > 0 && originalAccounts.length === 0) {
      setOriginalAccounts(accounts);
    }
  }, [accounts, originalAccounts]);

  // Filter accounts based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      // If search is cleared, restore original accounts
      if (originalAccounts.length > 0) {
        setAccounts(originalAccounts);
      }
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = originalAccounts.filter(account => {
      console.log('Filtering account:', account);
      return (account.username?.toLowerCase() || '').includes(lowerQuery) ||
        (account.email?.toLowerCase() || '').includes(lowerQuery) ||
        (account.role?.toLowerCase() || '').includes(lowerQuery) ||
        (account.department?.toLowerCase() || '').includes(lowerQuery);
    });

    setAccounts(filtered);
    setCurrentPage(1); // Reset to first page on new search
  }, [searchQuery, originalAccounts]);

  const isDuplicateUsername = (username: string): boolean => {
    return accounts.some(account => account.username.toLowerCase() === username.toLowerCase());
  };

  const handleAddAccount = async () => {
    if (!newAccount.username.trim() || !newAccount.password.trim() || !newAccount.email.trim()) {
      toast.error(t.errors.required);
      return;
    }

    if (isDuplicateUsername(newAccount.username)) {
      toast.error(t.errors.duplicate);
      return;
    }

    try {
      setLoading(true);

      // Find department id by name
      let departmentIds: number[] = [];
      if (newAccount.department) {
        const dept = departments.find(d => ((d as any).Name || d.name) === newAccount.department);
        console.log('Department found:', dept);
        if (dept) {
          const deptId = Number((dept as any).DepartmentID || dept.department_id);
          if (!isNaN(deptId)) {
            departmentIds.push(deptId);
          }
        }
      }

      // Convert permissions array to the format expected by the API
      const permissions = newAccount.permissions.map(perm =>
        typeof perm === 'object' ? perm.PermissionName : perm
      );

      // Prepare data for the API
      const userData: UserCreateRequest = {
        username: newAccount.username,
        email: newAccount.email,
        password: newAccount.password,
        first_name: newAccount.first_name,
        last_name: newAccount.last_name,
        department_ids: departmentIds,
        user_role: newAccount.role,
        permissions: permissions
      };

      // Create the user
      const result = await createUser(userData);

      // Add the new account to the local state
      const newUser: Account = {
        id: String(result.user_id),
        username: newAccount.username,
        email: newAccount.email,
        role: newAccount.role,
        department: newAccount.department,
        permissions: newAccount.permissions,
        status: 'active'
      };

      setAccounts([...accounts, newUser]);
      toast.success('Account created successfully');
      setActiveTab('list'); // Switch to list view after creation

      // Reset the form
      setNewAccount({
        username: '',
        password: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'user',
        department: '',
        permissions: []
      });
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (permissionName: string) => {
    setNewAccount((prev: NewAccount) => {
      const hasPermission = prev.permissions.some(p =>
        typeof p === 'string' ? p === permissionName : p.PermissionName === permissionName
      );

      return {
        ...prev,
        permissions: hasPermission
          ? prev.permissions.filter(p =>
            typeof p === 'string' ? p !== permissionName : p.PermissionName !== permissionName
          )
          : [...prev.permissions, permissionName]
      };
    });
  };

  const handleRoleChange = (role: string) => {
    if (role === 'admin') {
      setNewAccount(prev => ({
        ...prev,
        role,
        permissions: availablePermissions.map(p => p.permission_name)
      }));
    } else {
      setNewAccount(prev => ({
        ...prev,
        role,
        permissions: []
      }));
    }
  };

  // Modal state for delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const currentUserId = localStorage.getItem('user_id');

    if (currentUserId && id === currentUserId) {
      toast.error('You cannot delete your own account');
      return;
    }

    setAccountToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;

    try {
      setLoading(true);

      await deleteUser(accountToDelete);

      setAccounts(accounts.filter(account => account.id !== accountToDelete));
      toast.success('Account deleted successfully');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setAccountToDelete(null);
    }
  };

  const handleUserClick = (account: Account) => {
    router.push(`/accounts/${account.id}`);
  };

  const getPermissionDisplay = (permissionName: string): string => {
    const permission = availablePermissions.find(p => p.permission_name === permissionName);
    return permission?.description || permissionName;
  };

  // Pagination logic
  const totalPages = Math.ceil(accounts.length / accountsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputPage(value);

    const page = Number(value);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = Number(inputPage);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    } else {
      setInputPage('');
      setCurrentPage(1);
    }
  };

  // Get current accounts for the displayed page
  const startIndex = (currentPage - 1) * accountsPerPage;
  const endIndex = startIndex + accountsPerPage;
  const displayedAccounts = accounts.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white mt-15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'list'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
            >
              {t.viewAccounts || 'View Accounts'}
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'create'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
            >
              {t.addNew || 'Add New Account'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
          </div>
        )}

        {activeTab === 'create' && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">{t.addNew || 'Create New Account'}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.form.username || 'Username'} *
                </label>
                <input
                  type="text"
                  value={newAccount.username}
                  onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                  placeholder={t.form.username || 'Username'}
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.form.password || 'Password'} *
                </label>
                <input
                  type="password"
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  placeholder={t.form.password || 'Password'}
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.firstName || 'First Name'}
                </label>
                <input
                  type="text"
                  value={newAccount.first_name}
                  onChange={(e) => setNewAccount({ ...newAccount, first_name: e.target.value })}
                  placeholder={t.firstName || 'First Name'}
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.lastName || 'Last Name'}
                </label>
                <input
                  type="text"
                  value={newAccount.last_name}
                  onChange={(e) => setNewAccount({ ...newAccount, last_name: e.target.value })}
                  placeholder={t.lastName || 'Last Name'}
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.email || 'Email'} *
                </label>
                <input
                  type="email"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                  placeholder={t.email || 'Email'}
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.department || 'Department'}
                </label>
                <select
                  value={newAccount.department}
                  onChange={(e) => setNewAccount({ ...newAccount, department: e.target.value })}
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                >
                  <option key="default-department" value="">{t.form.selectDepartment || 'Select Department'}</option>
                  {departments.map((dept) => (
                    <option key={(dept as any).DepartmentID || dept.department_id || dept.id} value={(dept as any).Name || dept.name}>
                      {(dept as any).Name || dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.role || 'Role'}
                </label>
                <select
                  value={newAccount.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                >
                  <option key="user-role" value="user">{t.roles.user || 'User'}</option>
                  <option key="admin-role" value="admin">{t.roles.administrator || 'Administrator'}</option>
                </select>
              </div>
            </div>

            {newAccount.role !== 'admin' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.form.permissions || 'Permissions'}
                </label>

                {permissionsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-3">
                    {availablePermissions.map(permission => (
                      <label key={permission.permission_id} className="flex items-start space-x-2 p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAccount.permissions.some(p =>
                            typeof p === 'string' ? p === permission.permission_name : p.PermissionName === permission.permission_name
                          )}
                          onChange={() => handlePermissionChange(permission.permission_name)}
                          className="mt-1 rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          disabled={newAccount.role === 'admin'}
                        />
                        <div>
                          <span className="text-gray-800 dark:text-gray-200 font-medium">{permission.permission_name}</span>
                          {permission.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{permission.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleAddAccount}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t.creating || 'Creating...'}
                  </>
                ) : (
                  t.form.addAccount || 'Create Account'
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'list' && !loading && (
          <>
            {/* Search bar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                <div className="flex-grow mb-4 md:mb-0">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.search.placeholder || "Search users..."}
                      className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 pl-10 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                    />
                  </div>
                </div>
                <div className="flex space-x-2">
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="all">{t.all || 'All'}</option>
                    <option value="username">{t.username || 'Username'}</option>
                    <option value="email">{t.email || 'Email'}</option>
                    <option value="role">{t.role || 'Role'}</option>
                    <option value="department">{t.department || 'Department'}</option>
                  </select>
                </div>
              </div>

              {searchQuery && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t.search.results?.replace('{count}', accounts.length.toString()) || `Found ${accounts.length} results`}
                </div>
              )}
            </div>

            {/* User list */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              {displayedAccounts.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {displayedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-6 hover:bg-gray-50 dark:hover:bg-gray-750 dark:hover:text-black transition-colors cursor-pointer"
                      onClick={() => handleUserClick(account)}
                    >
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                        <div className="flex-grow mb-4 md:mb-0">
                          <div className="flex items-center">
                            <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-3 mr-4">
                              <svg className="h-6 w-6 text-blue-600 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-gray-900 dark:group-hover:text-black">
                                {account.username}
                              </h3>
                              <div className="flex flex-wrap items-center text-sm text-gray-500 dark:text-gray-400 space-x-2">
                                <span>{account.email}</span>
                                <span>•</span>
                                <span className="capitalize">{account.role}</span>
                                {account.department && (
                                  <>
                                    <span>•</span>
                                    <span>{account.department}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {account.permissions?.map(permission => {
                              const permissionName = typeof permission === 'object' && permission.PermissionName
                                ? permission.PermissionName
                                : typeof permission === 'string'
                                  ? permission
                                  : '';

                              if (!permissionName) return null;

                              return (
                                <span
                                  key={permissionName}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                  title={getPermissionDisplay(permissionName)}
                                >
                                  {permissionName}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${account.status === 'active'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            }`}>
                            {t.status?.[account.status] || account.status}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(account.id);
                            }}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {t.form.deleteAccount || 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  {searchQuery ? (t.noSearchResults || 'No accounts match your search.') : (t.noAccounts || 'No accounts found.')}
                </div>
              )}

              {/* Pagination controls */}
              {accounts.length > 0 && (
                <div className="bg-gray-100 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row justify-between items-center">
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 sm:mb-0">
                      {t.pagination?.showing || 'Showing'} {startIndex + 1} - {Math.min(endIndex, accounts.length)} {t.pagination?.of || 'of'} {accounts.length}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {t.pagination?.prev || 'Previous'}
                      </button>

                      <span className="px-3 py-2 text-gray-800 dark:text-gray-200">
                        {currentPage} / {totalPages}
                      </span>

                      <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t.pagination?.next || 'Next'}
                        <svg className="h-5 w-5 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>

                      <form onSubmit={handlePageSubmit} className="flex items-center ml-4">
                        <label className="sr-only">{t.goToPage || 'Go to page'}</label>
                        <input
                          type="text"
                          value={inputPage}
                          onChange={handlePageInputChange}
                          placeholder={String(currentPage)}
                          className="w-16 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded-l-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                        />
                        <button
                          type="submit"
                          className="bg-blue-600 dark:bg-blue-500 text-white px-3 py-2 rounded-r-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                        >
                          {t.pagination?.go || 'Go'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Delete confirmation modal */}
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDelete}
          title={t.confirmDeleteTitle || "Confirm Delete Account"}
          message={t.confirmDelete || 'Are you sure you want to delete this account? This action cannot be undone.'}
        />
      </div>
    </div>
  );
}
