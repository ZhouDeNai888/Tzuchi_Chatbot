'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { getDepartment, getDepartmentUsers, addUserToDepartment, removeUserFromDepartment, getKnowledgeBases } from '@/utils/apiService';
import { toast } from 'react-hot-toast';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

interface User {
  id?: string;
  UserID?: string | number;  // Keep this since it's being used
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
    window.history.back();
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">{t.loading || 'Loading...'}</h1>
      </div>
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
      </div>
    </div>
  );

  if (error || !department) return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">{t.notFound || 'Department Not Found'}</h1>
        <button
          onClick={handleBack}
          className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {t.back || 'Back'}
        </button>
      </div>
      <p className="text-red-500">{error || t.notFoundMessage || 'The requested department could not be found.'}</p>
    </div>
  );

  return (
    <div className="p-6 mt-16">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">{department?.name}</h1>
        <button
          onClick={handleBack}
          className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {t.backToDepartments || 'Back'}
        </button>
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-8">{department?.description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Users Section */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium text-black dark:text-white">{t.members || 'Members'}</h2>
            <button
              onClick={() => setShowAddUserForm(!showAddUserForm)}
              className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm cursor-pointer"
            >
              {showAddUserForm ? (t.cancel || 'Cancel') : (t.addUser || 'Add User')}
            </button>
          </div>

          {userError && <p className="text-red-500 text-sm mb-2">{userError}</p>}

          {showAddUserForm && (
            <div className="mb-4 flex">
              <input
                type="text"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder={t.userIdPlaceholder || "Enter user ID or email"}
                className="flex-1 px-3 py-2 border dark:bg-gray-700 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={userLoading}
              />
              <button
                onClick={handleAddUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-r-md disabled:opacity-50 cursor-pointer"
                disabled={userLoading || !newUserId.trim()}
              >
                {userLoading ? (t.adding || 'Adding...') : (t.add || 'Add')}
              </button>
            </div>
          )}

          {users.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t.noMembers || 'No members in this department'}</p>
          ) : (
            <div className="space-y-2">
              {users.map((user, index) => (
                <div key={`user-${user.id || index}`} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                  <div>
                    <span className="font-medium text-black dark:text-white">{user.name}</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.role}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    className="text-sm text-red-500 hover:text-red-700 cursor-pointer"
                    disabled={userLoading}
                  >
                    {t.remove || 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Knowledge Base Section */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <h2 className="text-xl font-medium mb-4 text-black dark:text-white">{t.knowledgeBase || 'Knowledge Base'}</h2>

          {knowledgeBases.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t.noKnowledgeBases || 'No knowledge bases for this department'}</p>
          ) : (
            <div className="space-y-2">
              {knowledgeBases.map(kb => (
                <div key={kb.id} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                  <div className="flex justify-between">
                    <span className="font-medium text-black dark:text-white">{kb.title}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(kb.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmRemoveUser}
        title={t.confirmRemoveUser ? 'Confirm Remove User' : undefined}
        message={t.confirmRemoveUser || 'Are you sure you want to remove this user from the department?'}
      />
    </div>
  );
}
