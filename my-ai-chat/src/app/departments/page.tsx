'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/utils/apiService';
import { useRouter } from 'next/navigation';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

// Define an interface for API response
interface DepartmentApiResponse {
  department_id?: number;
  name: string;
  description?: string;
  user_count?: number;
  knowledgebase_count?: number;
  created_at?: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
  userCount: number;
  kbCount: number;
  createdAt: string;
}

export default function DepartmentsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const t = translations[language].departments;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);

  // Form modal state
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
  });

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<string | null>(null);

  // Get paginated departments
  const getPaginatedDepartments = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredDepartments.slice(startIndex, endIndex);
  };

  const isDuplicateName = (name: string, excludeId?: string): boolean => {
    return departments.some(dept =>
      dept.name.toLowerCase() === name.toLowerCase() &&
      (!excludeId || dept.id !== excludeId)
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert(t.errors.required);
      return;
    }

    if (isDuplicateName(formData.name, formMode === 'edit' ? formData.id : undefined)) {
      alert(t.errors.duplicate);
      return;
    }

    try {
      setLoading(true);

      if (formMode === 'create') {
        // Create department via API
        const response: any = await createDepartment({
          name: formData.name,
          description: formData.description
        });

        if (response) {
          // Convert API response to our Department format
          const createdDepartment: Department = {
            id: response.department_id?.toString() || response.id?.toString() || '',
            name: response.name,
            description: response.description || '',
            userCount: typeof response.user_count !== 'undefined' ? response.user_count : 0,
            kbCount: typeof response.knowledgebase_count !== 'undefined' ? response.knowledgebase_count : 0,
            createdAt: response.created_at || new Date().toISOString()
          };

          setDepartments([...departments, createdDepartment]);
        } else {
          setError('Failed to create department');
        }
      } else {
        // Update department via API
        const updatedDepartment = await updateDepartment(
          formData.id,
          {
            name: formData.name,
            description: formData.description
          }
        );

        if (updatedDepartment) {
          // Update the departments list
          const updatedDepartments = departments.map(dept => {
            if (dept.id === formData.id) {
              return {
                ...dept,
                name: updatedDepartment.name,
                description: updatedDepartment.description || ''
              };
            }
            return dept;
          });

          setDepartments(updatedDepartments);
        } else {
          setError('Failed to update department');
        }
      }

      // Reset form and close modal
      setShowFormModal(false);
      setFormData({ id: '', name: '', description: '' });
    } catch (err) {
      console.error(`Error ${formMode === 'create' ? 'creating' : 'updating'} department:`, err);
      setError(`Failed to ${formMode === 'create' ? 'create' : 'update'} department`);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setFormMode('create');
    setFormData({ id: '', name: '', description: '' });
    setShowFormModal(true);
  };

  const openEditForm = (department: Department) => {
    setFormMode('edit');
    setFormData({
      id: department.id,
      name: department.name,
      description: department.description
    });
    setShowFormModal(true);
  };

  const handleDelete = (id: string) => {
    setDepartmentToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!departmentToDelete) return;

    try {
      setLoading(true);

      // Delete department via API
      const success = await deleteDepartment(departmentToDelete);

      if (success) {
        const updatedDepartments = departments.filter(dept => dept.id !== departmentToDelete);
        setDepartments(updatedDepartments);
      } else {
        setError('Failed to delete department');
      }
    } catch (err) {
      console.error('Error deleting department:', err);
      setError('Failed to delete department');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setDepartmentToDelete(null);
    }
  };

  const handleDepartmentClick = (id: string) => {
    router.push(`/departments/${id}`);
  };

  // Change items per page
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page
  };

  // Go to next page
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Go to previous page
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoading(true);
        const data: DepartmentApiResponse[] = await getDepartments();

        if (data && Array.isArray(data) && data.length > 0) {
          // Transform API data to match our interface
          const formattedDepts = data.map(dept => ({
            id: dept.department_id?.toString() || '',
            name: dept.name,
            description: dept.description || '',
            userCount: dept.user_count || 0,
            kbCount: dept.knowledgebase_count || 0,
            createdAt: dept.created_at || new Date().toISOString(),
          }));

          setDepartments(formattedDepts);
          setTotalPages(Math.ceil(formattedDepts.length / itemsPerPage));
        } else {
          // If no departments found, set empty array
          setDepartments([]);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
        setError('Failed to load departments');
        setDepartments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  // Update paginated departments when currentPage or itemsPerPage changes
  useEffect(() => {
    setTotalPages(Math.ceil(filteredDepartments.length / itemsPerPage));
  }, [filteredDepartments, itemsPerPage]);

  // Filter departments based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDepartments(departments);
    } else {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const filtered = departments.filter(dept =>
        dept.name.toLowerCase().includes(lowerCaseQuery) ||
        dept.description.toLowerCase().includes(lowerCaseQuery)
      );
      setFilteredDepartments(filtered);
    }
    setCurrentPage(1); // Reset to first page when search changes
  }, [searchQuery, departments]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white mt-15">
      {/* Header with title and actions */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.title}</h1>

        <div className="flex items-center gap-4">
          {/* Search input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search.placeholder}
              className="pl-10 pr-4 py-2 w-64 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {/* Add department button */}
          <button
            onClick={openCreateForm}
            className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t.addNew}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6">
        {error && (
          <div className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6 flex justify-between items-center">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {loading && departments.length === 0 ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">{t.noDepartments}</h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">{t.search.placeholder ? 'No departments match your search criteria.' : 'Create your first department to get started.'}</p>
            <button
              onClick={openCreateForm}
              className="mt-4 bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              {t.addNew}
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 bg-gray-50 dark:bg-gray-700 p-4 font-medium text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">
              <div className="col-span-5 sm:col-span-4">{t.form.name}</div>
              <div className="col-span-5 sm:col-span-4 hidden sm:block">{t.form.description}</div>
              <div className="col-span-4 sm:col-span-2 text-center hidden sm:block">{t.stats?.users ? t.stats.users : 'Stats'}</div>
              <div className="col-span-7 sm:col-span-2 text-right">{t.form.actions || 'Actions'}</div>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {getPaginatedDepartments().map((department) => (
                <div
                  key={department.id}
                  className="grid grid-cols-12 p-4 hover:bg-gray-50 dark:hover:bg-gray-750 dark:hover:text-black transition-colors items-center"
                >
                  <div
                    className="col-span-5 sm:col-span-4 font-medium cursor-pointer"
                    onClick={() => handleDepartmentClick(department.id)}
                  >
                    {department.name}
                  </div>

                  <div
                    className="col-span-5 sm:col-span-4 text-gray-600 dark:text-gray-400 hidden sm:block truncate cursor-pointer"
                    onClick={() => handleDepartmentClick(department.id)}
                  >
                    {department.description || '—'}
                  </div>

                  <div className="col-span-4 sm:col-span-2 flex gap-2 justify-center hidden sm:flex">
                    <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {department.userCount}
                    </span>
                    <span className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {department.kbCount}
                    </span>
                  </div>

                  <div className="col-span-7 sm:col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => openEditForm(department)}
                      className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                      title={t.actions.edit}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(department.id)}
                      className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                      title={t.actions.delete}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDepartmentClick(department.id)}
                      className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title={t.actions.view || "View"}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination controls */}
        {filteredDepartments.length > itemsPerPage && (
          <div className="mt-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show pagination numbers intelligently
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 flex items-center justify-center rounded-md ${currentPage === pageNum
                        ? 'bg-blue-600 dark:bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="text-gray-700 dark:text-gray-300 flex items-center">
              <span className="mr-2">{t.pagination.itemsPerPage}:</span>
              <select
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white p-2 rounded"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-auto overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                {formMode === 'create' ? t.addNew : t.actions.edit}
              </h2>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.form.name} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.form.name}
                    className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.form.description}
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t.form.description}
                    rows={3}
                    className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t.loading}
                    </>
                  ) : formMode === 'create' ? t.form.addButton : t.actions.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title={t.actions.delete || "Confirm Delete"}
        message={t.actions.confirmDelete || 'Are you sure you want to delete this department? This action cannot be undone.'}
      />
    </div>
  );
}
