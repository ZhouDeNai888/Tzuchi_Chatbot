'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import CreateKnowledgeModal from '../../components/CreateKnowledgeModal';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { useAuth } from '@/context/AuthContext';
import { getKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase, KnowledgeBase as ApiKnowledgeBase } from '@/utils/apiService';

interface KnowledgeBase {
  id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  department_id?: number;
  owner_id?: number;
  is_public?: boolean;
  is_global?: boolean;
  is_new?: boolean;
}

export default function Knowledge() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { language } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [knowledgeToDelete, setKnowledgeToDelete] = useState<number | null>(null);
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9; // 9 items per page as requested
  const defaultTranslations = {
    title: 'Knowledge',
    createNew: 'Create New',
    confirmDelete: 'Are you sure you want to delete this knowledge base?',
    confirmDeleteTitle: 'Confirm Delete',
    searchPlaceholder: 'Search...',
    noKnowledgeBases: 'No knowledge bases found',
    newlyCreated: 'Newly Created',
    duplicateError: 'A knowledge base with this title already exists',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of'
  };
  const t = { ...defaultTranslations, ...translations[language].knowledge };

  // Get user's primary department ID or use a default
  const getUserDepartmentId = (): number => {
    console.log('User:', user); // Debugging line to check user object
    if (user && user.departments && user.departments.length > 0) {
      // Access either property using a type-safe approach
      const department = user.departments[0];
      // DepartmentID is the correct property name as confirmed by the user
      return (department as any).DepartmentID || department.id || 1;
    }

    return 1; // Default department ID if user has no departments
  };

  // Fetch knowledge bases from API
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      if (!isAuthenticated) return;

      setIsLoading(true);
      setError(null);
      // Clear previous knowledge bases when user changes
      setKnowledgeBases([]);

      try {
        // Get the user's department ID
        const departmentId = getUserDepartmentId();
        console.log('Fetching knowledge bases for department ID:', departmentId);
        console.log('Current user2:', user);
        // Pass the department ID to the getKnowledgeBases function
        const data = await getKnowledgeBases(departmentId);
        console.log('Knowledge bases data:', data); // Debugging line to check fetched data
        setKnowledgeBases(data);
        console.log('Fetched knowledge bases:', data);
      } catch (err: any) {
        console.error('Error fetching knowledge bases:', err);
        setError(err.message || 'Failed to load knowledge bases');
      } finally {
        setIsLoading(false);
      }
    };

    fetchKnowledgeBases();
  }, [isAuthenticated, user]); // Update dependency to just user since we don't use DepartmentID anymore

  const isEnglishOnly = (text: string) => {
    // Regular expression to match non-English characters
    const regex = /[^\x00-\x7F]+/;
    return !regex.test(text);
  };

  const handleCreateKnowledge = async (title: string, description: string) => {
    // Check if title already exists
    const titleExists = knowledgeBases.some(
      kb => kb.title && title && kb.title.toLowerCase() === title.toLowerCase()
    );

    if (titleExists) {
      alert(t.duplicateError);
      return;
    }

    // Validate that title contains only English characters
    if (!isEnglishOnly(title)) {
      // Show bilingual alert message for English-only requirement
      alert(t.englishTitleOnly || 'Please enter title in English only / 請使用英文輸入標題');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the user's department ID
      const departmentId = getUserDepartmentId();

      // Call API to create knowledge base
      const newKnowledgeBase = await createKnowledgeBase({
        title,
        description,
        department_id: departmentId,
        is_public: true,
        is_global: false
      });

      // Generate URL to navigate to the new knowledge base
      const url = getKnowledgeUrl(newKnowledgeBase);

      // Navigate to the new knowledge base page
      window.location.href = url;
    } catch (err: any) {
      console.error('Error creating knowledge base:', err);
      setError(err.message || 'Failed to create knowledge base');
      setIsLoading(false);
    }
  };

  const handleDeleteKnowledge = async (id: number) => {
    setKnowledgeToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!knowledgeToDelete) return;

    // Close the modal immediately
    setIsDeleteModalOpen(false);

    setIsLoading(true);
    setError(null);

    try {
      // Call API to delete knowledge base
      await deleteKnowledgeBase(knowledgeToDelete);

      // Update state
      setKnowledgeBases(prev => prev.filter(kb => kb.id !== knowledgeToDelete));
    } catch (err: any) {
      console.error('Error deleting knowledge base:', err);
      setError(err.message || 'Failed to delete knowledge base');
    } finally {
      setIsLoading(false);
      setKnowledgeToDelete(null);
    }
  };

  const filteredItems = searchTerm
    ? knowledgeBases.filter(kb =>
      (kb.title && kb.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (kb.description && kb.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    : knowledgeBases; // Show all knowledge bases when search term is empty

  const newItems = filteredItems.filter(kb => kb.is_new);
  const existingItems = filteredItems.filter(kb => !kb.is_new);

  // Generate URL slug from title and append id as query param
  const getKnowledgeUrl = (kb: KnowledgeBase) => {
    console.log('Knowledge base:', kb); // Debugging line to check knowledge base object
    if (!kb.title) return `/knowledge/view?id=${kb.id}`;
    const slug = kb.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `/knowledge/${slug}?id=${kb.id}`;
  };

  // Calculate pagination data
  const totalPages = Math.ceil(existingItems.length / itemsPerPage);
  const paginatedItems = existingItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Define rainbow gradient classes for cards
  const rainbowGradients = [
    'bg-gradient-to-r from-pink-500 to-purple-500',
    'bg-gradient-to-r from-purple-500 to-indigo-500',
    'bg-gradient-to-r from-indigo-500 to-blue-500',
    'bg-gradient-to-r from-blue-500 to-teal-500',
    'bg-gradient-to-r from-teal-500 to-green-500',
    'bg-gradient-to-r from-green-500 to-yellow-500',
    'bg-gradient-to-r from-yellow-500 to-orange-500',
    'bg-gradient-to-r from-orange-500 to-red-500',
    'bg-gradient-to-r from-red-500 to-pink-500',
  ];

  // Function to get a gradient based on the knowledge base ID
  const getGradientClass = (id: number) => {
    return rainbowGradients[id % rainbowGradients.length];
  };

  return (
    <div className="pt-16 bg-white dark:bg-black px-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-gray-900 dark:text-white text-3xl font-bold">{t.title}</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          disabled={isLoading}
        >
          {t.createNew}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">
          {error}
        </div>
      )}

      <div className="mb-8">
        <input
          type="text"
          className="w-full max-w-xl mx-auto block bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          placeholder={t.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading && knowledgeBases.length === 0 ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : knowledgeBases.length === 0 ? (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">{t.noKnowledgeBases}</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Create your first knowledge base
          </button>
        </div>
      ) : (
        <>
          {newItems.length > 0 && (
            <div className="mb-8">
              <h2 className="text-gray-900 dark:text-white text-xl font-semibold mb-4">{t.newlyCreated}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newItems.map((kb) => (
                  <Link
                    key={kb.id}
                    href={getKnowledgeUrl(kb)}
                    className={`rounded-lg p-6 hover:bg-opacity-90 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl cursor-pointer block relative group ${getGradientClass(kb.id)}`}
                  >
                    <div className="absolute top-2 right-2 flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteKnowledge(kb.id);
                        }}
                        className="text-white opacity-0 group-hover:opacity-100 hover:text-gray-200 transition-all duration-200"
                        disabled={isLoading}
                        aria-label="Delete knowledge base"
                        title="Delete knowledge base"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="bg-white/30 backdrop-blur-sm p-2 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-white text-xl font-semibold mb-2">{kb.title}</h2>
                        <p className="text-white/80">{kb.description}</p>
                        <p className="text-xs text-white/70 mt-4">
                          Created: {new Date(kb.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <span className="text-white text-sm font-medium">
                        View &rarr;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedItems.map((kb) => (
              <Link
                key={kb.id}
                href={getKnowledgeUrl(kb)}
                className={`rounded-lg p-6 hover:bg-opacity-90 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl cursor-pointer block relative group ${getGradientClass(kb.id)}`}
              >
                <div className="absolute top-2 right-2 flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteKnowledge(kb.id);
                    }}
                    className="text-white opacity-0 group-hover:opacity-100 hover:text-gray-200 transition-all duration-200"
                    disabled={isLoading}
                    aria-label="Delete knowledge base"
                    title="Delete knowledge base"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-white/30 backdrop-blur-sm p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-white text-xl font-semibold mb-2">{kb.title}</h2>
                    <p className="text-white/80">{kb.description}</p>
                    <p className="text-xs text-white/70 mt-4">
                      Created: {new Date(kb.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <span className="text-white text-sm font-medium">
                    View &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-between items-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                disabled={currentPage === 1 || isLoading}
              >
                {t.previous}
              </button>
              <div className="text-gray-700 dark:text-gray-300">
                {t.page} {currentPage} {t.of} {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                disabled={currentPage === totalPages || isLoading}
              >
                {t.next}
              </button>
            </div>
          )}
        </>
      )}

      <CreateKnowledgeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateKnowledge}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={t.confirmDeleteTitle}
        message={t.confirmDelete}
      />
    </div>

  );
}

