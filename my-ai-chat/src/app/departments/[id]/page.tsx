'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { getDepartment, getDepartmentUsers, addUserToDepartment, removeUserFromDepartment, getKnowledgeBases } from '@/utils/apiService';
import { toast } from 'react-hot-toast';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

interface User {
  id?: string;
  UserID?: string | number;
  name?: string;
  Username?: string;
  username?: string;
  role?: string;
  UserRole?: string;
  Email?: string;
  email?: string;
  FirstName?: string;
  LastName?: string;
}

interface KnowledgeBase {
  id: string;
  title: string;
  lastUpdated: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
}

export default function DepartmentDetail() {
  const params = useParams();
  const router = useRouter();
  const departmentId = params?.id as string;
  const { language } = useLanguage();
  const t = translations[language].departmentDetail;

  const [department, setDepartment] = useState<Department | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userLoading, setUserLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const [showAddUserForm, setShowAddUserForm] = useState<boolean>(false);
  const [newUserId, setNewUserId] = useState<string>('');

  // Modal state for user removal confirmation
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [userToRemove, setUserToRemove] = useState<string | undefined>(undefined);

  const handleBack = () => {
    router.push('/departments');
  };

  const handleAddUser = async () => {
    if (!newUserId.trim() || !departmentId) {
      return;
    }

    try {
      setUserLoading(true);
      setUserError(null);

      const success = await addUserToDepartment(departmentId, newUserId);

      if (success) {
        const updatedUsers = await getDepartmentUsers(departmentId);

        if (updatedUsers && Array.isArray(updatedUsers)) {
          const formattedUsers = updatedUsers.map(user => {
            const userId = user.id?.toString() ||
              user.UserID?.toString() ||
              '';

            console.log('Formatting user:', user, 'extracted ID:', userId);

            return {
              id: userId,
              name: user.FirstName && user.LastName
                ? `${user.FirstName} ${user.LastName}`
                : user.Username || 'Unknown',
              role: user.UserRole || 'Member',
              username: user.Username,
              email: user.Email
            };
          });

          setUsers(formattedUsers);
        }

        setNewUserId('');
        setShowAddUserForm(false);
        toast.success(t.userAdded || 'User added successfully');
      } else {
        setUserError('Failed to add user to department');
        toast.error(t.addUserError || 'Failed to add user to department');
      }
    } catch (err) {
      console.error('Error adding user to department:', err);
      setUserError('Error adding user to department');
      toast.error(t.addUserError || 'Error adding user to department');
    } finally {
      setUserLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string | undefined) => {
    if (!departmentId || !userId) {
      console.error('Missing departmentId or userId', { departmentId, userId });
      toast.error('Cannot remove user: Missing user ID');
      return;
    }

    console.log('Attempting to remove user with ID:', userId);
    setUserToRemove(userId);
    setShowDeleteModal(true);
  };

  const confirmRemoveUser = async () => {
    if (!departmentId || !userToRemove) {
      return;
    }

    try {
      setUserLoading(true);
      setUserError(null);

      const success = await removeUserFromDepartment(departmentId, userToRemove);

      if (success) {
        setUsers(users.filter(user => user.id !== userToRemove));
        toast.success(t.userRemoved || 'User removed successfully');
      } else {
        setUserError('Failed to remove user from department');
        toast.error(t.removeUserError || 'Failed to remove user from department');
      }
    } catch (err) {
      console.error('Error removing user from department:', err);
      setUserError('Error removing user from department');
      toast.error(t.removeUserError || 'Error removing user from department');
    } finally {
      setUserLoading(false);
      setShowDeleteModal(false);
      setUserToRemove(undefined);
    }
  };

  useEffect(() => {
    const fetchDepartmentData = async () => {
      if (!departmentId) return;

      try {
        setLoading(true);

        const departmentData = await getDepartment(departmentId);

        if (departmentData) {
          setDepartment({
            id: departmentData.department_id?.toString() || departmentData.id?.toString() || departmentId,
            name: departmentData.name,
            description: departmentData.description || '',
          });

          const usersData = await getDepartmentUsers(departmentId);
          console.log('Fetched users:', usersData);

          if (usersData && Array.isArray(usersData)) {
            const formattedUsers = usersData.map(user => {
              const userId = user.id?.toString() ||
                user.UserID?.toString() ||
                '';

              console.log('Formatting user:', user, 'extracted ID:', userId);

              return {
                id: userId,
                name: user.FirstName && user.LastName
                  ? `${user.FirstName} ${user.LastName}`
                  : user.Username || 'Unknown',
                role: user.UserRole || 'Member',
                username: user.Username,
                email: user.Email
              };
            });

            setUsers(formattedUsers);
          }

          const knowledgeBasesData = await getKnowledgeBases();
          const departmentKnowledgeBases = knowledgeBasesData
            .filter(kb => kb.department_id === parseInt(departmentId))
            .map(kb => ({
              id: kb.id.toString(),
              title: kb.title,
              lastUpdated: kb.updated_at || new Date().toISOString()
            }));

          setKnowledgeBases(departmentKnowledgeBases);
        } else {
          const localDepartments = localStorage.getItem('departments');
          if (localDepartments) {
            const departments = JSON.parse(localDepartments);
            const dept = departments.find((d: any) => d.id.toString() === departmentId);
            if (dept) {
              setDepartment(dept);
            } else {
              setError('Department not found');
            }
          } else {
            setError('Department not found');
          }
        }
      } catch (err) {
        console.error('Error fetching department:', err);
        setError('Failed to load department data');

        const localDepartments = localStorage.getItem('departments');
        if (localDepartments) {
          const departments = JSON.parse(localDepartments);
          const dept = departments.find((d: any) => d.id.toString() === departmentId);
          if (dept) {
            setDepartment(dept);
          } else {
            setError('Department not found');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDepartmentData();
  }, [departmentId]);

  if (loading) return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.loading || 'Loading...'}</h1>
        <button
          onClick={handleBack}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t.backToDepartments || 'Back'}
        </button>
      </div>

      {/* Loading content */}
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  );

  if (error || !department) return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.notFound || 'Department Not Found'}</h1>
        <button
          onClick={handleBack}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t.backToDepartments || 'Back'}
        </button>
      </div>

      {/* Error content */}
      <div className="p-6">
        <div className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error || t.notFoundMessage || 'The requested department could not be found.'}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white mt-15">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{department.name}</h1>
          <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-3 py-1 text-xs rounded-full">
            ID: {departmentId}
          </span>
        </div>
        <button
          onClick={handleBack}
          className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t.backToDepartments || 'Back'}
        </button>
      </div>

      {/* Department details content */}
      <div className="p-6">
        {/* Department description */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
          <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">{t.about || 'About'}</h2>
          <p className="text-gray-600 dark:text-gray-300">{department.description || t.noDescription || 'No description available.'}</p>
        </div>

        {/* Error alert */}
        {userError && (
          <div className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6 flex justify-between items-center">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {userError}
            </div>
            <button
              onClick={() => setUserError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Users Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                {t.members || 'Members'}
                <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-0.5 text-xs rounded-full">
                  {users.length}
                </span>
              </h2>
              <button
                onClick={() => setShowAddUserForm(!showAddUserForm)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {showAddUserForm ? (t.cancel || 'Cancel') : (t.addUser || 'Add User')}
              </button>
            </div>

            {showAddUserForm && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <div className="flex">
                  <input
                    type="text"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder={t.userIdPlaceholder || "Enter user ID or email"}
                    className="flex-1 px-3 py-2 border dark:bg-gray-600 dark:border-gray-500 rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white"
                    disabled={userLoading}
                  />
                  <button
                    onClick={handleAddUser}
                    className="px-4 py-2 bg-blue-600 text-white rounded-r-md disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-1"
                    disabled={userLoading || !newUserId.trim()}
                  >
                    {userLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t.adding || 'Adding...'}
                      </>
                    ) : (
                      t.add || 'Add'
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="p-4">
              {users.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">{t.noMembers || 'No members in this department'}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user, index) => (
                    <div key={`user-${user.id || index}`} className="flex justify-between items-center py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors px-2">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-xs">
                            {user.role}
                          </span>
                          {user.email && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              {user.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                        disabled={userLoading}
                        title={t.remove || 'Remove'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Knowledge Base Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t.knowledgeBase || 'Knowledge Base'}
                <span className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 px-2 py-0.5 text-xs rounded-full">
                  {knowledgeBases.length}
                </span>
              </h2>
            </div>

            <div className="p-4">
              {knowledgeBases.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">{t.noKnowledgeBases || 'No knowledge bases for this department'}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {knowledgeBases.map(kb => (
                    <div key={kb.id} className="py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors px-2">
                      <div className="flex justify-between items-center">
                        <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {kb.title}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(kb.lastUpdated).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmRemoveUser}
        title={t.confirmRemoveUser || "Confirm Remove User"}
        message={t.confirmRemoveUserMessage || 'Are you sure you want to remove this user from the department? This action cannot be undone.'}
        confirmText={t.remove || "Remove"}
      />
    </div>
  );
}
