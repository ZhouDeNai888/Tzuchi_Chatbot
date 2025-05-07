'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { toast } from 'react-hot-toast';
import {
    getUser, updateUser, getDepartments,
    getPermissions, addPermissionToUser, removePermissionFromUser, setUserRole,
    UserUpdateRequest, Department, Permission
} from '@/utils/apiService';
import React from 'react';
import { useParams } from 'next/navigation';

interface DepartmentData {
    id?: number;
    name?: string;
    department_id?: number;
    Name?: string;
}

interface Account {
    id: string;
    username: string;
    email: string;
    password?: string;
    role: string;
    department: string;
    departments?: DepartmentData[];
    department_id?: number;
    selectedDepartments: number[];
    permissions: string[];
    status: 'active' | 'inactive';
}

// Component to display and manage user permissions
const PermissionDisplay = ({
    userId,
    userPermissions,
    onPermissionChange
}: {
    userId: string,
    userPermissions: string[],
    onPermissionChange: (newPermissions: string[]) => void
}) => {
    const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                setLoading(true);
                const permissions = await getPermissions();
                setAvailablePermissions(permissions);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch permissions:', err);
                setError('Failed to load available permissions');
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();
    }, []);

    const handleTogglePermission = async (permissionName: string, checked: boolean) => {
        try {
            if (checked) {
                await addPermissionToUser(permissionName, parseInt(userId));
                toast.success(`Added permission: ${permissionName}`);
            } else {
                await removePermissionFromUser(permissionName, parseInt(userId));
                toast.success(`Removed permission: ${permissionName}`);
            }

            // Update the parent component's state
            const newPermissions = checked
                ? [...userPermissions, permissionName]
                : userPermissions.filter(p => p !== permissionName);

            onPermissionChange(newPermissions);
        } catch (err) {
            console.error(`Failed to ${checked ? 'add' : 'remove'} permission:`, err);
            toast.error(`Failed to ${checked ? 'add' : 'remove'} permission: ${permissionName}`);
        }
    };

    if (loading) {
        return <div className="py-4 text-center">Loading permissions...</div>;
    }

    if (error) {
        return <div className="py-4 text-center text-red-500">{error}</div>;
    }

    return (
        <div className="space-y-2 mt-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded p-2">
            {availablePermissions.length > 0 ? (
                availablePermissions.map((permission) => (
                    <div key={permission.permission_id} className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        <input
                            type="checkbox"
                            id={`perm-${permission.permission_name}`}
                            checked={userPermissions.includes(permission.permission_name)}
                            onChange={(e) => handleTogglePermission(permission.permission_name, e.target.checked)}
                            className="mr-2"
                        />
                        <label htmlFor={`perm-${permission.permission_name}`} className="cursor-pointer flex-1">
                            <div className="font-semibold">{permission.permission_name}</div>
                            {permission.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{permission.description}</div>
                            )}
                        </label>
                    </div>
                ))
            ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-2">No permissions available</div>
            )}
        </div>
    );
};

export default function EditUserPage() {

    const params = useParams<{ slug: string }>();

    const router = useRouter();
    const [user, setUser] = useState<Account | null>(null);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const { language } = useLanguage();
    const t = translations[language].accountEdit;

    const { slug } = params;

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoading(true);
                const userData = await getUser(slug);
                console.log('User Data:', userData);

                if (!userData) {
                    throw new Error('Failed to fetch user data');
                }

                const departmentsData = await getDepartments();
                console.log('Departments:', departmentsData);
                setDepartments(departmentsData || []);

                const userDepartmentIds = userData.departments && Array.isArray(userData.departments)
                    ? userData.departments.map(dept =>
                        Number(dept.id || (dept as any).DepartmentID)
                    )
                    : [];
                console.log('User Department IDs:', userDepartmentIds);
                setUser({
                    id: String(userData.UserID),
                    username: userData.Username,
                    email: userData.Email,
                    role: userData.UserRole || 'User',
                    department: userData.departments && userData.departments.length > 0
                        ? (userData.departments[0] as any).Name || userData.departments[0].name || ''
                        : '',
                    departments: userData.departments as unknown as DepartmentData[],
                    selectedDepartments: userDepartmentIds,
                    permissions: userData.permissions && Array.isArray(userData.permissions)
                        ? userData.permissions.map(perm => {
                            if (typeof perm === 'object' && perm !== null) {
                                return (perm as any).PermissionName || (perm as any).id || perm as string;
                            }
                            return perm as string;
                        })
                        : [],
                    status: userData.IsActive ? 'active' : 'inactive'
                });
            } catch (error) {
                console.error('Error fetching user data:', error);
                toast.error('Failed to load user data');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [slug]);

    const handleUpdateUser = async () => {
        if (!user) return;

        try {
            setLoading(true);

            const updateData: UserUpdateRequest = {
                username: user.username,
                email: user.email,
                user_role: user.role,
                is_active: user.status === 'active',
                permissions: user.permissions,
                department_ids: user.selectedDepartments
            };

            if (user.password && user.password.trim() !== '') {
                updateData.password = user.password;
            }

            await updateUser(user.id, updateData);
            toast.success('User updated successfully');
            router.push('/accounts');
        } catch (error) {
            console.error('Error updating user:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update user');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (newRole: 'admin' | 'user') => {
        if (!user) return;
        try {
            setLoading(true);
            await setUserRole(user.id, newRole);
            setUser({ ...user, role: newRole });
        } catch (error) {
            console.error('Error updating user role:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update user role');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-8 pt-16 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-8 pt-16">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl font-bold mb-6">User Not Found</h1>
                    <button
                        onClick={() => router.push('/accounts')}
                        className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                    >
                        {t.back}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-8 pt-16">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">{t.title}: {user.username}</h1>
                    <button
                        onClick={() => router.push('/accounts')}
                        className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                        {t.back}
                    </button>
                </div>

                <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 shadow-lg">
                    <div>
                        <label className="text-gray-700 dark:text-gray-300 block mb-1">{t.form.username}</label>
                        <input
                            type="text"
                            value={user.username}
                            onChange={(e) => setUser({ ...user, username: e.target.value })}
                            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded w-full border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="text-gray-700 dark:text-gray-300 block mb-1">Email</label>
                        <input
                            type="email"
                            value={user.email}
                            onChange={(e) => setUser({ ...user, email: e.target.value })}
                            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded w-full border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="text-gray-700 dark:text-gray-300 block mb-1">{t.form.password}</label>
                        <input
                            type="password"
                            placeholder={t.form.passwordPlaceholder}
                            onChange={(e) => setUser({ ...user, password: e.target.value })}
                            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded w-full border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                        />
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t.form.passwordHint}</p>
                    </div>

                    <div>
                        <label className="text-gray-700 dark:text-gray-300 block mb-1">{t.form.department}</label>
                        <div className="space-y-2 mt-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded p-2">
                            {departments.map(dept => {
                                const deptId = dept.id || (dept as any).department_id;
                                console.log('Department ID:', deptId);
                                const deptName = dept.name || (dept as any).Name;
                                const isSelected = user.selectedDepartments.includes(Number(deptId));

                                return (
                                    <label key={deptId} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {
                                                const departmentId = Number(deptId);
                                                let newSelectedDepartments;

                                                if (isSelected) {
                                                    newSelectedDepartments = user.selectedDepartments.filter(
                                                        id => id !== departmentId
                                                    );

                                                } else {
                                                    newSelectedDepartments = [...user.selectedDepartments, departmentId];
                                                    console.log('New selected departments:', newSelectedDepartments);
                                                }

                                                console.log("Setting user with:", {
                                                    selectedDepartments: newSelectedDepartments,
                                                    departments: newSelectedDepartments.length > 0
                                                        ? departments
                                                            .filter(d => newSelectedDepartments.includes(Number(d.id || (d as any).DepartmentID)))
                                                            .map(d => ({
                                                                DepartmentID: Number(d.id || (d as any).DepartmentID),
                                                                Name: d.name || (d as any).Name
                                                            }))
                                                        : []
                                                });

                                                setUser(prev => {
                                                    if (!prev) return prev;
                                                    return {
                                                        ...prev,
                                                        selectedDepartments: newSelectedDepartments,
                                                        departments: newSelectedDepartments.length > 0
                                                            ? departments
                                                                .filter(d => newSelectedDepartments.includes(Number(d.id || (d as any).DepartmentID)))
                                                                .map(d => ({
                                                                    id: Number(d.id || (d as any).DepartmentID),
                                                                    name: d.name || (d as any).Name
                                                                }))
                                                            : []
                                                    } as Account;
                                                });


                                            }}
                                            className="rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                                        />
                                        <span className="text-gray-700 dark:text-gray-300">{deptName}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {user.selectedDepartments.length > 0 && (
                            <div className="mt-3">
                                <p className="text-gray-700 dark:text-gray-300 text-sm">Selected departments:</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {user.selectedDepartments.map(deptId => {
                                        const dept = departments.find(d =>
                                            Number(d.id || (d as any).DepartmentID) === deptId
                                        );
                                        if (!dept) return null;
                                        const deptName = dept.name || (dept as any).Name;

                                        return (
                                            <div key={deptId} className="group relative">
                                                <span className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 px-2 py-1 rounded text-xs flex items-center">
                                                    {deptName}
                                                    <button
                                                        className="ml-1 text-xs hover:text-red-600 dark:hover:text-red-400"
                                                        onClick={() => {
                                                            const newSelectedDepartments = user.selectedDepartments.filter(
                                                                id => id !== deptId
                                                            );

                                                            setUser({
                                                                ...user,
                                                                selectedDepartments: newSelectedDepartments,
                                                                departments: newSelectedDepartments.length > 0
                                                                    ? departments
                                                                        .filter(d => newSelectedDepartments.includes(Number(d.id || (d as any).DepartmentID)))
                                                                        .map(d => ({
                                                                            DepartmentID: Number(d.id || (d as any).DepartmentID),
                                                                            Name: d.name || (d as any).Name
                                                                        }))
                                                                    : []
                                                            });
                                                            console.log('Updated selected departments:', user.selectedDepartments);

                                                        }}
                                                    >

                                                    </button>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-gray-700 dark:text-gray-300 block mb-1">{t.form.role}</label>
                        <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'user')}
                            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded w-full border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                        >
                            <option value="user">User</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-gray-700 dark:text-gray-300 block mb-1">{t.form.status}</label>
                        <select
                            value={user.status}
                            onChange={(e) => setUser({ ...user, status: e.target.value as 'active' | 'inactive' })}
                            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded w-full border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-gray-700 dark:text-gray-300 block mb-1">{t.form.permissions}</label>
                        <PermissionDisplay
                            userId={user.id}
                            userPermissions={user.permissions}
                            onPermissionChange={(newPermissions) => setUser({ ...user, permissions: newPermissions })}
                        />
                    </div>

                    {user.permissions.includes('full_admin') && (
                        <div className="bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-4 mt-4">
                            <p className="font-bold">Full Admin Access</p>
                            <p>This user has full administrator privileges.</p>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleUpdateUser}
                    disabled={loading}
                    className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors w-full mt-6 disabled:opacity-50"
                >
                    {loading ? "Loading..." : t.form.saveChanges}
                </button>
            </div>
        </div>
    );
}
