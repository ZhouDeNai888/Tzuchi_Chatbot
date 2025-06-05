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
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);

  const [newDepartment, setNewDepartment] = useState({
    name: '',
    description: '',
  });

  // Modal state
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

  const handleAddDepartment = async () => {
    if (!newDepartment.name.trim()) {
      alert(t.errors.required);
      return;
    }

    if (isDuplicateName(newDepartment.name)) {
      alert(t.errors.duplicate);
      return;
    }

    try {
      setLoading(true);

      // Create department via API
      const response: any = await createDepartment({
        name: newDepartment.name,
        description: newDepartment.description
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
        setNewDepartment({ name: '', description: '' });
      } else {
        setError('Failed to create department');
      }
    } catch (err) {
      console.error('Error creating department:', err);
      setError('Failed to create department');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDepartment = async () => {
    if (!editingDepartment) return;

    if (!editingDepartment.name.trim()) {
      alert(t.errors.required);
      return;
    }

    if (isDuplicateName(editingDepartment.name, editingDepartment.id)) {
      alert(t.errors.duplicate);
      return;
    }

    try {
      setLoading(true);

      // Update department via API
      const updatedDepartment = await updateDepartment(
        editingDepartment.id,
        {
          name: editingDepartment.name,
          description: editingDepartment.description
        }
      );

      if (updatedDepartment) {
        // Update the departments list
        const updatedDepartments = departments.map(dept => {
          if (dept.id === editingDepartment.id) {
            return {
              ...dept,
              name: updatedDepartment.name,
              description: updatedDepartment.description || ''
            };
          }
          return dept;
        });

        setDepartments(updatedDepartments);
        setEditingDepartment(null);
      } else {
        setError('Failed to update department');
      }
    } catch (err) {
      console.error('Error updating department:', err);
      setError('Failed to update department');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
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

  const handleEditStart = (department: Department) => {
    setEditingDepartment({ ...department });
  };

  const handleEditCancel = () => {
    setEditingDepartment(null);
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
            kbCount: dept.knowledgebase_count || 0, // Get KB count from API
            createdAt: dept.created_at || new Date().toISOString(),
          }));

          setDepartments(formattedDepts);
          setTotalPages(Math.ceil(formattedDepts.length / itemsPerPage)); // Set total pages for pagination
        } else {
          // If no departments found, set empty array
          setDepartments([]);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
        setError('Failed to load departments');

        // Set empty array when API fails or no departments are found
        setDepartments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  // Update paginated departments when currentPage or itemsPerPage changes
  useEffect(() => {
    setTotalPages(Math.ceil(departments.length / itemsPerPage));
  }, [departments, itemsPerPage]);

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
  }, [searchQuery, departments]);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-8 pt-16">
      <h1 className="text-2xl font-bold mb-6">{t.title}</h1>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mb-8 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-lg">
        <h2 className="text-xl mb-4">{t.addNew}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            value={newDepartment.name}
            onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
            placeholder={t.form.name}
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          />
          <input
            type="text"
            value={newDepartment.description}
            onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
            placeholder={t.form.description}
            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          />
        </div>
        <button
          onClick={handleAddDepartment}
          disabled={loading}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t.loading : t.form.addButton}
        </button>
      </div>

      {/* Search bar */}
      <div className="mb-8">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.search.placeholder}
          className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors w-full"
        />
      </div>

      {loading && !editingDepartment && departments.length === 0 ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDepartments.length === 0 ? (
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
              {t.noDepartments}
            </div>
          ) : (
            getPaginatedDepartments().map((department) => (
              <div
                key={department.id}
                className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-md"
              >
                {editingDepartment && editingDepartment.id === department.id ? (
                  <div className="p-3 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 mb-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input
                        type="text"
                        value={editingDepartment.name}
                        onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })}
                        placeholder={t.form.name}
                        className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                      />
                      <input
                        type="text"
                        value={editingDepartment.description}
                        onChange={(e) => setEditingDepartment({ ...editingDepartment, description: e.target.value })}
                        placeholder={t.form.description}
                        className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={handleEditCancel}
                        className="bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white px-3 py-1 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                      >
                        {t.actions.cancel}
                      </button>
                      <button
                        onClick={handleUpdateDepartment}
                        disabled={loading}
                        className="bg-green-600 dark:bg-green-500 text-white px-3 py-1 rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? t.loading : t.actions.save}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex justify-between items-start"
                    onClick={() => handleDepartmentClick(department.id)}
                  >
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">{department.name}</h3>
                      <p className="text-gray-600 dark:text-gray-400">{department.description}</p>
                      <div className="mt-2 flex gap-4">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm">
                          {t.stats.users}: {department.userCount}
                        </span>
                        <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm">
                          {t.stats.knowledgeBase}: {department.kbCount}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStart(department);
                        }}
                        className="bg-blue-600 dark:bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                      >
                        {t.actions.edit}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(department.id);
                        }}
                        className="bg-red-600 dark:bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                      >
                        {t.actions.delete}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination controls */}
      {departments.length > itemsPerPage && (
        <div className="mt-6 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white px-3 py-1 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.actions.prev}
            </button>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white px-3 py-1 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.actions.next}
            </button>
          </div>
          <div className="text-gray-700 dark:text-gray-300">
            {t.pagination.page} {currentPage} {t.pagination.of} {totalPages}
          </div>
          <div>
            <select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
            >
              <option value={5}>5 {t.pagination.itemsPerPage}</option>
              <option value={10}>10 {t.pagination.itemsPerPage}</option>
              <option value={25}>25 {t.pagination.itemsPerPage}</option>
            </select>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message={t.actions?.confirmDelete || 'Are you sure you want to delete this department? This action cannot be undone.'}
      />
    </div>
  );
}
