'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import CreateKnowledgeModal from '../../components/CreateKnowledgeModal';
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
  const defaultTranslations = {
    title: 'Knowledge',
    createNew: 'Create New',
    confirmDelete: 'Are you sure you want to delete this knowledge base?',
    searchPlaceholder: 'Search...',
    noKnowledgeBases: 'No knowledge bases found',
    newlyCreated: 'Newly Created',
    duplicateError: 'A knowledge base with this title already exists'
  };
  const t = { ...defaultTranslations, ...translations[language].knowledge };

  // Get user's primary department ID or use a default
  const getUserDepartmentId = (): number => {
    console.log('User:', user); // Debugging line to check user object
    if (user && user.departments && user.departments.length > 0) {
      return user.departments[0].id;
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

  const handleCreateKnowledge = async (title: string, description: string) => {
    // Check if title already exists
    const titleExists = knowledgeBases.some(
      kb => kb.title && title && kb.title.toLowerCase() === title.toLowerCase()
    );

    if (titleExists) {
      alert(t.duplicateError);
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

      // Add is_new flag for UI highlighting
      const knowledgeBaseWithFlag = {
        ...newKnowledgeBase,
        is_new: true
      };

      setKnowledgeBases(prev => [...prev, knowledgeBaseWithFlag]);

      // Remove the is_new flag after 5 seconds
      setTimeout(() => {
        setKnowledgeBases(items =>
          items.map(item =>
            item.id === newKnowledgeBase.id ? { ...item, is_new: false } : item
          )
        );
      }, 5000);
    } catch (err: any) {
      console.error('Error creating knowledge base:', err);
      setError(err.message || 'Failed to create knowledge base');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKnowledge = async (id: number) => {
    if (!confirm(t.confirmDelete)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call API to delete knowledge base
      await deleteKnowledgeBase(id);

      // Update state
      setKnowledgeBases(prev => prev.filter(kb => kb.id !== id));
    } catch (err: any) {
      console.error('Error deleting knowledge base:', err);
      setError(err.message || 'Failed to delete knowledge base');
    } finally {
      setIsLoading(false);
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
                    className="bg-blue-100 dark:bg-blue-900 rounded-lg p-6 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer block border-2 border-blue-500 relative group"
                  >
                    <div className="absolute top-2 right-2 flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteKnowledge(kb.id);
                        }}
                        className="text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-300 transition-colors"
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
                      <div className="bg-blue-200 dark:bg-blue-700 p-2 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-gray-900 dark:text-white text-xl font-semibold mb-2">{kb.title}</h2>
                        <p className="text-gray-600 dark:text-gray-300">{kb.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                          Created: {new Date(kb.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                        View &rarr;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {existingItems.map((kb) => (
              <Link
                key={kb.id}
                href={getKnowledgeUrl(kb)}
                className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer block relative group"
              >
                <div className="absolute top-2 right-2 flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteKnowledge(kb.id);
                    }}
                    className="text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-300 transition-colors"
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
                  <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-gray-900 dark:text-white text-xl font-semibold mb-2">{kb.title}</h2>
                    <p className="text-gray-600 dark:text-gray-400">{kb.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                      Created: {new Date(kb.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                    View &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <CreateKnowledgeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateKnowledge}
      />
    </div>
  );
}