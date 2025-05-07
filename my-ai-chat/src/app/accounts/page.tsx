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
    role: 'User',
    department: '',
    permissions: []
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<ApiPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

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
          role: user.UserRole || 'User',
          department: user.departments && user.departments.length > 0 ? user.departments[0].name : '',
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
        const dept = departments.find(d => d.name === newAccount.department);
        console.log('Department found:', dept);
        if (dept) {
          const deptId = Number(dept.department_id);
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

      // Reset the form
      setNewAccount({
        username: '',
        password: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'User',
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
    if (role === 'Administrator') {
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

  const handleDelete = async (id: string) => {
    const currentUserId = localStorage.getItem('user_id');

    if (currentUserId && id === currentUserId) {
      toast.error('You cannot delete your own account');
      return;
    }

    if (window.confirm(t.confirmDelete)) {
      try {
        setLoading(true);

        await deleteUser(id);

        setAccounts(accounts.filter(account => account.id !== id));
        toast.success('Account deleted successfully');
      } catch (error) {
        console.error('Error deleting account:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to delete account');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUserClick = (account: Account) => {
    router.push(`/accounts/${account.id}`);
  };

  const getPermissionDisplay = (permissionName: string): string => {
    const permission = availablePermissions.find(p => p.permission_name === permissionName);
    return permission?.description || permissionName;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-8 pt-16">
      <h1 className="text-2xl font-bold mb-6">{t.title}</h1>

      <div className="mb-8 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-lg">
        <h2 className="text-xl mb-4">{t.addNew}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            value={newAccount.username}
            onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
            placeholder="Username"
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <input
            type="password"
            value={newAccount.password}
            onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
            placeholder="Password"
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <input
            type="text"
            value={newAccount.first_name}
            onChange={(e) => setNewAccount({ ...newAccount, first_name: e.target.value })}
            placeholder="First Name"
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <input
            type="text"
            value={newAccount.last_name}
            onChange={(e) => setNewAccount({ ...newAccount, last_name: e.target.value })}
            placeholder="Last Name"
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <input
            type="email"
            value={newAccount.email}
            onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
            placeholder="Email"
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <select
            value={newAccount.department}
            onChange={(e) => setNewAccount({ ...newAccount, department: e.target.value })}
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <option key="default-department" value="">{t.form.selectDepartment}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.name}>
                {dept.name}
              </option>
            ))}
          </select>
          <select
            value={newAccount.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <option key="user-role" value="User">{t.roles.user}</option>
            <option key="admin-role" value="Administrator">{t.roles.administrator}</option>
          </select>
        </div>

        {newAccount.role !== 'Administrator' && (
          <div className="mb-4">
            <h3 className="text-sm font-bold mb-2">{t.form.permissions}</h3>

            {permissionsLoading ? (
              <div className="flex justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded p-2">
                {availablePermissions.map(permission => (
                  <label key={permission.permission_id} className="flex items-center space-x-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                    <input
                      type="checkbox"
                      checked={newAccount.permissions.some(p =>
                        typeof p === 'string' ? p === permission.permission_name : p.PermissionName === permission.permission_name
                      )}
                      onChange={() => handlePermissionChange(permission.permission_name)}
                      className="rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      disabled={newAccount.role === 'Administrator'}
                    />
                    <div>
                      <span className="text-gray-700 dark:text-gray-300">{permission.permission_name}</span>
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

        <button
          onClick={handleAddAccount}
          disabled={loading}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors w-full disabled:opacity-50"
        >
          {loading ? 'Loading...' : t.form.addAccount}
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      <div className="grid gap-4">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-md"
            onClick={() => handleUserClick(account)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{account.username}</h3>
                <p className="text-gray-600 dark:text-gray-400">{account.role} - {account.department}</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">{`ID: ${account.id}`}</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">{account.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {account.permissions?.map(permission => {
                    const permissionName = typeof permission === 'object' && permission.PermissionName
                      ? permission.PermissionName
                      : typeof permission === 'string'
                        ? permission
                        : '';

                    if (!permissionName) return null;

                    return (
                      <span key={permissionName} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs" title={getPermissionDisplay(permissionName)}>
                        {permissionName}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`px-2 py-1 rounded ${account.status === 'active'
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                  {t.status[account.status]}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(account.id);
                  }}
                  className="bg-red-600 dark:bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                >
                  {t.form.deleteAccount}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
