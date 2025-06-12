'use client';

import { useState, useEffect } from 'react';
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Button,
    useDisclosure
} from '@nextui-org/react';
import { Trash2, Edit, Plus } from 'lucide-react';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import EditModal from '@/components/EditModal';

interface Permission {
    permission_id: number;
    permission_name: string;
    description: string;
}

export default function PermissionPage() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Form state
    const [formData, setFormData] = useState<Omit<Permission, 'permission_id'> & { permission_id?: number }>({
        permission_name: '',
        description: ''
    });

    // Modal states
    const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
    const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/permissions');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch permissions');
            }

            const data = await response.json();
            setPermissions(data || []);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setFormData({ permission_name: '', description: '' });
    };

    const handleAddPermission = async () => {
        try {
            const response = await fetch('/api/permissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add permission');
            }

            await fetchPermissions();
            resetForm();
            onAddClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error adding permission:', err);
        }
    };

    const handleEditClick = (permission: Permission) => {
        setFormData({
            permission_id: permission.permission_id,
            permission_name: permission.permission_name,
            description: permission.description,
        });
        onEditOpen();
    };

    const handleEditPermission = async () => {
        try {
            const response = await fetch(`/api/permissions/${formData.permission_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update permission');
            }

            await fetchPermissions();
            resetForm();
            onEditClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error updating permission:', err);
        }
    };

    const handleDeleteClick = (permission: Permission) => {
        setFormData({
            permission_id: permission.permission_id,
            permission_name: permission.permission_name,
            description: permission.description,
        });
        onDeleteOpen();
    };

    const handleDeletePermission = async () => {
        try {
            const response = await fetch(`/api/permissions/${formData.permission_id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete permission');
            }

            await fetchPermissions();
            resetForm();
            onDeleteClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error deleting permission:', err);
        }
    };

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6 dark:text-white">Permission Management</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">Manage system permissions for users and features</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Permission List */}
                <div className="md:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4 dark:text-white">Available Permissions</h2>

                        {error && (
                            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        ) : permissions.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white dark:bg-gray-800">
                                    <thead className="bg-gray-100 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {permissions.map((permission) => (
                                            <tr key={permission.permission_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{permission.permission_id}</td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">{permission.permission_name}</td>
                                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-300">{permission.description}</td>
                                                <td className="px-4 py-2 text-sm">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEditClick(permission)}
                                                            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1 rounded"
                                                            aria-label={`Edit permission: ${permission.permission_name}`}
                                                        >
                                                            <Edit size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(permission)}
                                                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded"
                                                            aria-label={`Delete permission: ${permission.permission_name}`}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                No permissions found
                            </div>
                        )}
                    </div>
                </div>

                {/* Add Permission Form */}
                <div className="md:col-span-1">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4 dark:text-white">Add New Permission</h2>
                        <form onSubmit={(e) => { e.preventDefault(); handleAddPermission(); }} className="space-y-4">
                            <div>
                                <label htmlFor="permission_name" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    Permission Name
                                </label>
                                <input
                                    type="text"
                                    id="permission_name"
                                    name="permission_name"
                                    value={formData.permission_name}
                                    onChange={handleInputChange}
                                    placeholder="Enter permission name"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                />
                            </div>

                            <div>
                                <label htmlFor="description" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Enter permission description"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                />
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={!formData.permission_name.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add Permission
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Edit Permission Modal */}
            <EditModal
                isOpen={isEditOpen}
                onClose={onEditClose}
                onSave={handleEditPermission}
                title="Edit Permission"
                saveText="Save Changes"
                cancelText="Cancel"
                isProcessing={isProcessing}
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="edit-name" className="block text-sm font-medium mb-2 dark:text-gray-300">
                            Permission Name
                        </label>
                        <input
                            type="text"
                            id="edit-name"
                            name="permission_name"
                            value={formData.permission_name}
                            onChange={handleInputChange}
                            placeholder="Enter permission name"
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-description" className="block text-sm font-medium mb-2 dark:text-gray-300">
                            Description
                        </label>
                        <input
                            type="text"
                            id="edit-description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Enter permission description"
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        />
                    </div>
                </div>
            </EditModal>

            {/* Replace Delete Permission Modal with ConfirmDeleteModal */}
            <ConfirmDeleteModal
                isOpen={isDeleteOpen}
                onClose={onDeleteClose}
                onConfirm={handleDeletePermission}
                title="Delete Permission"
                message={`Are you sure you want to delete the permission "${formData.permission_name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
            />
        </div>
    );
}