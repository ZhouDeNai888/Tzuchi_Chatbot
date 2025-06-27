'use client';

import { useState, useEffect } from 'react';
import {
    useDisclosure,
    Tabs,
    Tab
} from '@nextui-org/react';
import { Trash2, Edit, Plus, Search, ChevronDown, ChevronRight } from 'lucide-react';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import EditModal from '@/components/EditModal';
import apiService from '@/utils/apiService';

interface Permission {
    permission_id: number;
    permission_name: string;
    description: string;
}

interface ApiPermission {
    permission_id: number;      // Maps to ApiPermissionID in backend
    permission_name: string;    // Maps to RequiredPermission in backend
    description: string;
    method: string;             // Maps to Method in backend
    api_path: string;           // Maps to PathPattern in backend
}

interface ApiRoute {
    path: string;
    methods: string[];
    summary?: string;
    description?: string;
}

// New interface for grouped API permissions
interface GroupedApiPermissions {
    [category: string]: ApiPermission[];
}

// HTTP Methods for the dropdown
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

export default function PermissionPage() {
    const [activeTab, setActiveTab] = useState<"permissions" | "apiPermissions">("permissions");
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [apiPermissions, setApiPermissions] = useState<ApiPermission[]>([]);
    const [groupedApiPermissions, setGroupedApiPermissions] = useState<GroupedApiPermissions>({});
    const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});
    const [availableRoutes, setAvailableRoutes] = useState<ApiRoute[]>([]);
    const [permissionNames, setPermissionNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Pagination and search state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredPermissions, setFilteredPermissions] = useState<Permission[]>([]);
    const [filteredApiPermissions, setFilteredApiPermissions] = useState<ApiPermission[]>([]);

    // Form state
    const [formData, setFormData] = useState<Omit<Permission, 'permission_id'> & { permission_id?: number; method?: string; api_path?: string }>({
        permission_name: '',
        description: '',
        method: '',
        api_path: ''
    });

    // Modal states
    const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
    const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const data = await apiService.getAllPermissions();
            setPermissions(data || []);

            // Extract unique permission names for dropdown
            const names = [...new Set(data.map((p: Permission) => p.permission_name))];
            setPermissionNames(names);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    // API Permission handling functions
    const fetchApiPermissions = async () => {
        try {
            setLoading(true);
            const data = await apiService.getApiPermissions();
            setApiPermissions(data || []);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching API permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRoutes = async () => {
        try {
            setLoading(true);
            const data = await apiService.getAllApiRoutes();
            console.log('API Routes fetched:', data);
            setAvailableRoutes(data || []);
        } catch (err: any) {
            console.error('Error fetching API routes:', err);
            setError('Failed to load API routes. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Change the order of API path and method selection
    const getMethodsForPath = (selectedPath: string): string[] => {
        if (!selectedPath) return [];

        // Find all routes that match this path and collect their methods
        const methods: string[] = [];
        availableRoutes.forEach(route => {
            if (route.path === selectedPath) {
                methods.push(...route.methods);
            }
        });

        return [...new Set(methods)]; // Remove duplicates
    };

    // Get API route description based on path and method
    const getRouteDescription = (path: string, method: string): string => {
        const route = availableRoutes.find(r => r.path === path && r.methods.includes(method));
        return route?.summary || 'No description available';
    };

    useEffect(() => {
        if (activeTab === "permissions") {
            fetchPermissions();
        } else {
            fetchApiPermissions();
            fetchRoutes();
        }
    }, [activeTab]);

    // Initial data loading
    useEffect(() => {
        // Load both permissions and API routes on initial render
        fetchPermissions();
        fetchApiPermissions();
        fetchRoutes();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        if (activeTab === "permissions") {
            setFormData({ permission_name: '', description: '' });
        } else {
            setFormData({ permission_name: '', description: '', method: '', api_path: '' });
        }
    };

    const handleAddPermission = async () => {
        try {
            setIsProcessing(true);
            await apiService.createPermission({
                permission_name: formData.permission_name,
                description: formData.description
            });
            await fetchPermissions();
            resetForm();
            onAddClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error adding permission:', err);
        } finally {
            setIsProcessing(false);
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
            setIsProcessing(true);
            if (!formData.permission_id) return;

            await apiService.updatePermission(formData.permission_id, {
                permission_name: formData.permission_name,
                description: formData.description
            });
            await fetchPermissions();
            resetForm();
            onEditClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error updating permission:', err);
        } finally {
            setIsProcessing(false);
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
            setIsProcessing(true);
            if (!formData.permission_id) return;

            await apiService.deletePermission(formData.permission_id);
            await fetchPermissions();
            resetForm();
            onDeleteClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error deleting permission:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // API permission handlers
    const handleAddApiPermission = async () => {
        try {
            setIsProcessing(true);
            if (!formData.api_path || !formData.method) return;

            // Set description from the API route summary
            const description = getRouteDescription(formData.api_path, formData.method);

            await apiService.createApiPermission({
                permission_name: formData.permission_name,
                description: description,
                method: formData.method,
                api_path: formData.api_path
            });
            await fetchApiPermissions();
            resetForm();
            onAddClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error adding API permission:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApiEditClick = (permission: ApiPermission) => {
        setFormData({
            permission_id: permission.permission_id,
            permission_name: permission.permission_name,
            description: permission.description,
            method: permission.method,
            api_path: permission.api_path
        });
        onEditOpen();
    };

    const handleApiEditPermission = async () => {
        try {
            setIsProcessing(true);
            if (!formData.permission_id) return;

            // Set description from the API route summary
            const description = getRouteDescription(formData.api_path || '', formData.method || '');

            await apiService.updateApiPermission(formData.permission_id, {
                permission_name: formData.permission_name,
                description: description,
                method: formData.method,
                api_path: formData.api_path
            });
            await fetchApiPermissions();
            resetForm();
            onEditClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error updating API permission:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApiDeleteClick = (permission: ApiPermission) => {
        setFormData({
            permission_id: permission.permission_id,
            permission_name: permission.permission_name,
            description: permission.description,
            method: permission.method,
            api_path: permission.api_path
        });
        onDeleteOpen();
    };

    const handleApiDeletePermission = async () => {
        try {
            setIsProcessing(true);
            if (!formData.permission_id) return;

            await apiService.deleteApiPermission(formData.permission_id);
            await fetchApiPermissions();
            resetForm();
            onDeleteClose();
        } catch (err: any) {
            setError(err.message);
            console.error('Error deleting API permission:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Filter API paths based on selected method
    const getFilteredApiPaths = () => {
        if (!formData.method) return [];
        return availableRoutes
            .filter(route => route.methods.includes(formData.method || ''))
            .map(route => route.path);
    };

    // Update filtered permissions based on search term
    useEffect(() => {
        if (activeTab === "permissions") {
            const filtered = permissions.filter(permission =>
                permission.permission_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                permission.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredPermissions(filtered);
        } else {
            const filtered = apiPermissions.filter(permission =>
                permission.permission_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                permission.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                permission.api_path?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                permission.method?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredApiPermissions(filtered);
        }
    }, [searchTerm, permissions, apiPermissions, activeTab]);

    // Calculate total pages for permissions and API permissions
    const totalPages = activeTab === "permissions" ? Math.ceil(filteredPermissions.length / itemsPerPage) : Math.ceil(filteredApiPermissions.length / itemsPerPage);

    // Get current items for permissions and API permissions
    const currentItems = activeTab === "permissions" ? filteredPermissions : filteredApiPermissions;
    const paginatedItems = currentItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Type guard function to check if a permission is an ApiPermission
    const isApiPermission = (permission: Permission | ApiPermission): permission is ApiPermission => {
        return 'method' in permission && 'api_path' in permission;
    };

    // Helper function to safely compare string literals for TypeScript
    const compareTab = (tab1: string, tab2: string): boolean => {
        return tab1 === tab2;
    };

    // Toggle category expansion
    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    // Group API permissions by name and automatically expand first category
    useEffect(() => {
        const grouped: GroupedApiPermissions = {};
        apiPermissions.forEach((permission) => {
            const { permission_name } = permission;
            if (!grouped[permission_name]) {
                grouped[permission_name] = [];
            }
            grouped[permission_name].push(permission);
        });
        setGroupedApiPermissions(grouped);

        // Auto-expand the first category if none are expanded
        if (Object.keys(expandedCategories).length === 0 && Object.keys(grouped).length > 0) {
            const firstCategory = Object.keys(grouped)[0];
            setExpandedCategories({ [firstCategory]: true });
        }
    }, [apiPermissions]);

    return (
        <div className="container mx-auto p-6 mt-16">
            <h1 className="text-2xl font-bold mb-6 dark:text-white">Permission Management</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Manage system permissions for users and features</p>

            <div className="flex justify-center mb-6"></div>

            {activeTab === "permissions" ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Regular Permission List */}
                    <div className="md:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold mb-4 dark:text-white">Available Permissions</h2>

                            {error && (
                                <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-between items-center mb-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveTab("permissions")}
                                        className={`px-4 py-2 rounded-l-md ${compareTab(activeTab, "permissions") ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"} transition-colors`}
                                    >
                                        Regular Permissions
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("apiPermissions")}
                                        className={`px-4 py-2 rounded-r-md ${compareTab(activeTab, "apiPermissions") ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"} transition-colors`}
                                    >
                                        API Permissions
                                    </button>
                                </div>

                                {/* Search and Pagination Controls */}
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Search permissions..."
                                            className="px-4 py-2 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                        />
                                        <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            <Search className="text-gray-400" />
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-gray-900 dark:text-white">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                                </div>
                            ) : paginatedItems.length > 0 ? (
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
                                            {paginatedItems.map((permission) => (
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

                    {/* Add Regular Permission Form */}
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
                                        disabled={!formData.permission_name.trim() || isProcessing}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isProcessing ? 'Adding...' : 'Add Permission'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* API Permission List */}
                    <div className="md:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold mb-4 dark:text-white">Available API Permissions</h2>

                            {error && (
                                <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-between items-center mb-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveTab("permissions")}
                                        className={`px-4 py-2 rounded-l-md ${compareTab(activeTab, "permissions") ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"} transition-colors`}
                                    >
                                        Regular Permissions
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("apiPermissions")}
                                        className={`px-4 py-2 rounded-r-md ${compareTab(activeTab, "apiPermissions") ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"} transition-colors`}
                                    >
                                        API Permissions
                                    </button>
                                </div>

                                {/* Search and Pagination Controls */}
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Search API permissions..."
                                            className="px-4 py-2 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                        />
                                        <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            <Search className="text-gray-400" />
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-gray-900 dark:text-white">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                                </div>
                            ) : apiPermissions.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <div className="mb-4">
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Categorized View</h3>
                                        <div className="space-y-2">
                                            {Object.keys(groupedApiPermissions).length > 0 ? (
                                                Object.entries(groupedApiPermissions).map(([category, permissions]) => (
                                                    <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-md">
                                                        <div
                                                            className="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex justify-between items-center cursor-pointer"
                                                            onClick={() => toggleCategory(category)}
                                                        >
                                                            <h4 className="font-medium text-gray-900 dark:text-white">{category}</h4>
                                                            <span className="text-gray-600 dark:text-gray-300">
                                                                {expandedCategories[category] ?
                                                                    <ChevronDown className="h-5 w-5" /> :
                                                                    <ChevronRight className="h-5 w-5" />}
                                                            </span>
                                                        </div>
                                                        {expandedCategories[category] && (
                                                            <div className="p-4">
                                                                <ul className="space-y-2">
                                                                    {permissions.map((permission) => (
                                                                        <li key={permission.permission_id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0 text-gray-900 dark:text-white">
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center">
                                                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full mr-2 ${permission.method === 'GET' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                                                        permission.method === 'POST' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                                                            permission.method === 'PUT' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                                                                permission.method === 'DELETE' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                                                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                                                                        }`}>
                                                                                        {permission.method}
                                                                                    </span>
                                                                                    <span className="font-mono text-sm">{permission.api_path}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <button
                                                                                    onClick={() => handleApiEditClick(permission)}
                                                                                    className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1 rounded"
                                                                                    aria-label={`Edit API permission: ${permission.permission_name}`}
                                                                                >
                                                                                    <Edit size={16} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleApiDeleteClick(permission)}
                                                                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded"
                                                                                    aria-label={`Delete API permission: ${permission.permission_name}`}
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                                                    No API permissions to categorize
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Detailed List</h3>
                                    <table className="min-w-full bg-white dark:bg-gray-800">
                                        <thead className="bg-gray-100 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Method</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">API Path</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {paginatedItems.map((permission) => (
                                                <tr key={permission.permission_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{permission.permission_id}</td>
                                                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">{permission.permission_name}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-300">
                                                        {isApiPermission(permission) && (
                                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${permission.method === 'GET' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                                permission.method === 'POST' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                                    permission.method === 'PUT' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                                        permission.method === 'DELETE' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                                                }`}>
                                                                {permission.method}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-300">
                                                        <span className="font-mono text-xs">{isApiPermission(permission) ? permission.api_path : ''}</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => isApiPermission(permission) ? handleApiEditClick(permission) : handleEditClick(permission as Permission)}
                                                                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1 rounded"
                                                                aria-label={`Edit ${isApiPermission(permission) ? 'API ' : ''}permission: ${permission.permission_name}`}
                                                            >
                                                                <Edit size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => isApiPermission(permission) ? handleApiDeleteClick(permission) : handleDeleteClick(permission as Permission)}
                                                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded"
                                                                aria-label={`Delete ${isApiPermission(permission) ? 'API ' : ''}permission: ${permission.permission_name}`}
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
                                    No API permissions found
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add API Permission Form */}
                    <div className="md:col-span-1">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold mb-4 dark:text-white">Add New API Permission</h2>
                            <form onSubmit={(e) => { e.preventDefault(); handleAddApiPermission(); }} className="space-y-4">
                                <div>
                                    <label htmlFor="api_permission_name" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                        Permission Name
                                    </label>
                                    <select
                                        id="api_permission_name"
                                        name="permission_name"
                                        value={formData.permission_name}
                                        onChange={handleSelectChange}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                    >
                                        <option value="">Select Permission Name</option>
                                        {permissionNames.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                        <option value="custom">Custom (Enter new)</option>
                                    </select>
                                    {formData.permission_name === 'custom' && (
                                        <input
                                            type="text"
                                            name="permission_name"
                                            value=""
                                            onChange={handleInputChange}
                                            placeholder="Enter custom permission name"
                                            className="mt-2 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="api_path" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                        API Path
                                    </label>
                                    <select
                                        id="api_path"
                                        name="api_path"
                                        value={formData.api_path || ''}
                                        onChange={handleSelectChange}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                    >
                                        <option value="">Select API Path</option>
                                        {[...new Set(availableRoutes.map(route => route.path))].map(path => (
                                            <option key={path} value={path}>{path}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="method" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                        HTTP Method
                                    </label>
                                    <select
                                        id="method"
                                        name="method"
                                        value={formData.method || ''}
                                        onChange={handleSelectChange}
                                        disabled={!formData.api_path}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select HTTP Method</option>
                                        {getMethodsForPath(formData.api_path || '').map(method => (
                                            <option key={method} value={method}>{method}</option>
                                        ))}
                                    </select>
                                </div>

                                {formData.api_path && formData.method && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400 italic border-l-4 border-gray-300 dark:border-gray-600 pl-3 py-1">
                                        {getRouteDescription(formData.api_path, formData.method)}
                                    </div>
                                )}

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={!formData.permission_name.trim() || !formData.method || !formData.api_path?.trim() || isProcessing}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isProcessing ? 'Adding...' : 'Add API Permission'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Permission Modal */}
            <EditModal
                isOpen={isEditOpen}
                onClose={onEditClose}
                onSave={activeTab === "permissions" ? handleEditPermission : handleApiEditPermission}
                title={activeTab === "permissions" ? "Edit Permission" : "Edit API Permission"}
                saveText="Save Changes"
                cancelText="Cancel"
                isProcessing={isProcessing}
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="edit-name" className="block text-sm font-medium mb-2 dark:text-gray-300">
                            Permission Name
                        </label>
                        {activeTab === "permissions" ? (
                            <input
                                type="text"
                                id="edit-name"
                                name="permission_name"
                                value={formData.permission_name}
                                onChange={handleInputChange}
                                placeholder="Enter permission name"
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            />
                        ) : (
                            <select
                                id="edit-name"
                                name="permission_name"
                                value={formData.permission_name}
                                onChange={handleSelectChange}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            >
                                <option value="">Select Permission Name</option>
                                {permissionNames.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                                <option value="custom">Custom (Enter new)</option>
                            </select>
                        )}
                        {formData.permission_name === 'custom' && activeTab === "apiPermissions" && (
                            <input
                                type="text"
                                name="permission_name"
                                value=""
                                onChange={handleInputChange}
                                placeholder="Enter custom permission name"
                                className="mt-2 w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            />
                        )}
                    </div>

                    {activeTab === "apiPermissions" && (
                        <>
                            <div>
                                <label htmlFor="edit-api-path" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    API Path
                                </label>
                                <select
                                    id="edit-api-path"
                                    name="api_path"
                                    value={formData.api_path || ''}
                                    onChange={handleSelectChange}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                >
                                    <option value="">Select API Path</option>
                                    {[...new Set(availableRoutes.map(route => route.path))].map(path => (
                                        <option key={path} value={path}>{path}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="edit-method" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    HTTP Method
                                </label>
                                <select
                                    id="edit-method"
                                    name="method"
                                    value={formData.method || ''}
                                    onChange={handleSelectChange}
                                    disabled={!formData.api_path}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Select HTTP Method</option>
                                    {getMethodsForPath(formData.api_path || '').map(method => (
                                        <option key={method} value={method}>{method}</option>
                                    ))}
                                </select>
                            </div>

                            {formData.api_path && formData.method && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 italic border-l-4 border-gray-300 dark:border-gray-600 pl-3 py-1">
                                    {getRouteDescription(formData.api_path, formData.method)}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === "permissions" && (
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
                    )}
                </div>
            </EditModal>

            {/* Delete Permission Modal */}
            <ConfirmDeleteModal
                isOpen={isDeleteOpen}
                onClose={onDeleteClose}
                onConfirm={activeTab === "permissions" ? handleDeletePermission : handleApiDeletePermission}
                title={activeTab === "permissions" ? "Delete Permission" : "Delete API Permission"}
                message={`Are you sure you want to delete the ${activeTab === "permissions" ? "permission" : "API permission"} "${formData.permission_name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
            />
        </div>
    );
}