'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CreateDataModal from '../../../components/CreateDataModal';
import FileInfoModal from '../../../components/FileInfoModal';
import ConfirmDeleteModal from '../../../components/ConfirmDeleteModal';
import { useLanguage } from '@/context/LanguageContext';
import { translations, messageFormatter } from '@/utils/translations';
import { useAuth } from '@/context/AuthContext';
import { useParams } from 'next/navigation';
import {
  getKnowledgeBase,
  getKnowledgeDataItems,
  deleteKnowledgeDataItem,
  KnowledgeBase,
  KnowledgeDataItem,
  getDocumentsInKnowledgeBase,
  getDocument,
  createDocumentWithFile,
  createDocumentWithURL,
  updateDocument,
  deleteDocument,
  Document
} from '@/utils/apiService';

export default function KnowledgePage() {
  const searchParams = useSearchParams();
  const knowledgeBaseId = Number(searchParams.get('id'));
  const router = useRouter();

  const [knowledge, setKnowledge] = useState<KnowledgeBase | null>(null);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [dataItems, setDataItems] = useState<KnowledgeDataItem[]>([]);
  const [processingItems, setProcessingItems] = useState<string[]>([]);
  const [creatingItems, setCreatingItems] = useState<{ id: string, name: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<KnowledgeDataItem | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationTimeout, setNotificationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'error' | 'warning' | 'success';
    visible: boolean;
  }>({
    message: '',
    type: 'error',
    visible: false
  });

  // Track completed items for showing checkmarks
  const [completedItems, setCompletedItems] = useState<{
    id: string;
    name: string;
    visible: boolean;
    timeout: NodeJS.Timeout | null;
  }[]>([]);

  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const t = translations[language].knowledgeDetail;

  // Fetch knowledge base and data items
  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !knowledgeBaseId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch knowledge base
      const knowledgeBase = await getKnowledgeBase(knowledgeBaseId);
      if (!knowledgeBase) {
        throw new Error('Knowledge base not found');
      }
      setKnowledge(knowledgeBase);

      // Fetch data items using the new document API
      try {
        const documents = await getDocumentsInKnowledgeBase(knowledgeBaseId);

        // Convert Document objects to the existing KnowledgeDataItem format
        // For initial page load, properly check isProcessed status for each document
        const convertedItems = documents.map(doc => ({
          id: doc.document_id.toString(),
          knowledge_base_id: knowledgeBaseId,
          type: doc.file_url?.includes('http') ? 'link' as const : 'file' as const,
          file_name: doc.title,
          url: doc.file_url || '',
          file_size: 0, // Placeholder as this may not be available in the API
          status: doc.is_processed ? 'processing' as const : 'finished' as const, // Check isProcessed flag
          created_at: doc.created_at || new Date().toISOString(),
        }));

        setDataItems(convertedItems);

        // On initial load, add any processing documents to the processingItems array
        const processingDocIds = documents
          .filter(doc => doc.is_processed)
          .map(doc => doc.document_id.toString());

        setProcessingItems(processingDocIds);
      } catch (docErr) {
        console.error('Error fetching documents:', docErr);
        // Fallback to original method if document API fails
        const items = await getKnowledgeDataItems(knowledgeBaseId);
        // Mark all existing items as finished
        const updatedItems = items.map(item => ({
          ...item,
          status: 'finished' as const
        }));
        setDataItems(updatedItems);
        setProcessingItems([]);
      }
    } catch (err: any) {
      console.error('Error fetching knowledge data:', err);
      setError(err.message || 'Failed to load knowledge data');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, knowledgeBaseId]);

  useEffect(() => {
    fetchData();

  }, [fetchData]);

  // Poll for processing items status updates
  useEffect(() => {
    if (processingItems.length === 0) return;

    const intervalId = setInterval(async () => {
      try {
        // Use the document API for polling
        const documents = await getDocumentsInKnowledgeBase(knowledgeBaseId);
        console.log('Polling documents:', documents);

        if (documents && documents.length > 0) {
          // Check for newly completed items
          const previouslyProcessingIds = [...processingItems];

          // Update data items with current status
          const convertedItems = documents.map(doc => ({
            id: doc.document_id.toString(),
            knowledge_base_id: knowledgeBaseId,
            type: doc.file_url?.includes('http') ? 'link' as const : 'file' as const,
            file_name: doc.title,
            url: doc.file_url || '',
            file_size: 0,
            status: doc.is_processed ? 'processing' as const : 'finished' as const, // Check isProcessed flag
            created_at: doc.created_at || new Date().toISOString(),
          }));

          setDataItems(convertedItems);

          // Update processing items - keep only items that are still processing
          const stillProcessingIds = documents
            .filter(doc => doc.is_processed)
            .map(doc => doc.document_id.toString());

          // Find items that were processing before but are now completed
          const newlyCompletedIds = previouslyProcessingIds.filter(
            id => !stillProcessingIds.includes(id)
          );

          // Add newly completed items to completedItems with visibility
          if (newlyCompletedIds.length > 0) {
            const newCompletedItems = newlyCompletedIds.map(id => {
              const item = convertedItems.find(item => item.id === id);
              const timeout = setTimeout(() => {
                // Remove item from completed items after 2 seconds
                setCompletedItems(prev => prev.filter(i => i.id !== id));
              }, 2000);

              return {
                id,
                name: item?.file_name || 'Unknown',
                visible: true,
                timeout
              };
            });

            setCompletedItems(prev => [...prev, ...newCompletedItems]);
          }

          setProcessingItems(stillProcessingIds);

          // Stop polling if all items are finished
          if (stillProcessingIds.length === 0) {
            clearInterval(intervalId);
          }
        } else {
          // If no documents returned, keep the current processing items
          console.log('No documents returned in polling');
        }
      } catch (err) {
        console.error('Error updating processing items:', err);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [processingItems, knowledgeBaseId]);

  const isDuplicate = (type: 'file' | 'link', value: string): boolean => {
    if (!value) return false;

    return dataItems.some(item => {
      if (type === 'file') {
        return item.file_name && item.file_name.toLowerCase() === value.toLowerCase();
      }
      return item.url && item.url.toLowerCase() === value.toLowerCase();
    });
  };

  // Check if a file has already been processed in the knowledge base
  const isFileProcessed = (fileName: string): boolean => {
    return dataItems.some(item =>
      item.file_name &&
      item.file_name.toLowerCase() === fileName.toLowerCase() &&
      item.status === 'finished'
    );
  };

  // Close notification after a delay
  const autoCloseNotification = useCallback(() => {
    // Clear any existing timeout
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }

    // Set notification to visible
    setShowNotification(true);

    // Set a new timeout to hide the notification after 5 seconds
    const timeout = setTimeout(() => {
      setShowNotification(false);
    }, 5000);

    setNotificationTimeout(timeout);
  }, [notificationTimeout]);

  // Handle notification visibility when items change
  useEffect(() => {
    if (creatingItems.length > 0 || processingItems.length > 0) {
      setShowNotification(true);
      // If only processing items (no creating items), set auto close
      if (creatingItems.length === 0) {
        autoCloseNotification();
      }
    } else {
      // If both lists are empty, hide notification
      setShowNotification(false);
    }

    // Cleanup timeout on unmount
    return () => {
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
    };
  }, [creatingItems, processingItems, autoCloseNotification, notificationTimeout]);

  // Toast notification for duplicate files/URLs
  const showToast = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    setToast({
      message,
      type,
      visible: true
    });

    // Auto-hide the toast after 5 seconds
    setTimeout(() => {
      setToast(prev => ({
        ...prev,
        visible: false
      }));
    }, 5000);
  };

  const handleAddData = async (type: 'file' | 'link', filesOrLink: File[] | string) => {
    if (!knowledgeBaseId) return;
    setError(null);

    // Close the data modal immediately
    setIsDataModalOpen(false);

    try {
      if (type === 'file' && Array.isArray(filesOrLink)) {
        // Add files to UI immediately with processing status
        const tempItems: KnowledgeDataItem[] = [];
        const currentTime = new Date().toISOString();

        // Create temporary items for each file with processing status
        for (const file of filesOrLink) {
          // Check if the file already exists and is processed
          if (isFileProcessed(file.name)) {
            showToast(`File "${file.name}" already exists and is processed`, 'warning');
            continue;
          } else if (isDuplicate('file', file.name)) {
            // If file exists but isn't processed yet
            showToast(`File "${file.name}" already exists and is being processed`, 'warning');
            continue;
          }

          // Create a temporary ID with current time and random number
          const tempId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

          // Add file to UI immediately with processing status
          const tempItem: KnowledgeDataItem = {
            id: tempId,
            knowledge_base_id: knowledgeBaseId,
            type: 'file' as const,
            file_name: file.name,
            file_size: file.size,
            status: 'processing' as const,
            created_at: currentTime,
            url: ''
          };

          tempItems.push(tempItem);
        }

        // Update UI with temporary items
        if (tempItems.length > 0) {
          setDataItems(prev => [...prev, ...tempItems]);

          // Add files to processing items directly
          setProcessingItems(prev => [
            ...prev,
            ...tempItems.map(item => item.id)
          ]);

          // Show notification
          setShowNotification(true);
        }

        // Process each file with API in a non-blocking way
        for (const file of filesOrLink) {
          // Skip files that already exist
          if (isFileProcessed(file.name) ||
            (isDuplicate('file', file.name) && !tempItems.some(item => item.file_name === file.name))) {
            continue;
          }

          // Start file upload process in background
          const file_type = file.name.split('.').pop() || 'unknown';

          // Process file in the background without awaiting its completion
          createDocumentWithFile(knowledgeBaseId, file, file_type, file.name)
            .then(document => {
              if (document) {
                console.log('Document processed:', document);

                // Update the document in the data items list
                setDataItems(prev => {
                  // Find and replace the temporary item with the real one
                  const newItems = prev.filter(item => !(item.file_name === file.name && item.id.startsWith('temp_')));

                  // Add the new document with the correct status
                  newItems.push({
                    id: document.document_id.toString(),
                    knowledge_base_id: knowledgeBaseId,
                    type: 'file',
                    file_name: document.title,
                    file_size: file.size,
                    url: document.file_url || '',
                    status: document.is_processed ? 'processing' : 'finished',
                    created_at: document.created_at || new Date().toISOString()
                  });

                  return newItems;
                });

                // Update processing items
                if (document.is_processed) {
                  // Replace temp ID with real ID in processing items
                  setProcessingItems(prev => {
                    const filtered = prev.filter(id => !id.startsWith('temp_') ||
                      !prev.some(item => item.startsWith('temp_') &&
                        dataItems.find(di => di.id === item)?.file_name === file.name));

                    return [...filtered, document.document_id.toString()];
                  });
                } else {
                  // If already processed, remove from processing items
                  setProcessingItems(prev =>
                    prev.filter(id => !id.startsWith('temp_') ||
                      !prev.some(item => item.startsWith('temp_') &&
                        dataItems.find(di => di.id === item)?.file_name === file.name))
                  );
                }
              }
            })
            .catch(err => {
              console.error('Error uploading file:', err);

              // Remove from processing items if there's an error
              setProcessingItems(prev =>
                prev.filter(id => !id.startsWith('temp_') ||
                  !prev.some(item => item.startsWith('temp_') &&
                    dataItems.find(di => di.id === item)?.file_name === file.name))
              );
            });
        }
      } else if (type === 'link' && typeof filesOrLink === 'string') {
        const url = filesOrLink.trim();

        // Check if URL already exists
        if (isDuplicate('link', url)) {
          showToast(`URL "${url}" already exists`, 'warning');
          return;
        }

        // Add URL to UI immediately with processing status
        const tempId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const currentTime = new Date().toISOString();

        // Add URL to UI immediately with processing status
        const tempItem: KnowledgeDataItem = {
          id: tempId,
          knowledge_base_id: knowledgeBaseId,
          type: 'link' as const,
          file_name: url.split('/').pop() || 'Web Content',
          file_size: 0,
          status: 'processing' as const,
          created_at: currentTime,
          url: url
        };

        // Update UI with temporary item
        setDataItems(prev => [...prev, tempItem]);

        // Add to processing items directly
        setProcessingItems(prev => [...prev, tempId]);

        // Show notification
        setShowNotification(true);

        // Process URL in the background without blocking
        createDocumentWithURL(knowledgeBaseId, url, tempItem.file_name)
          .then(document => {
            if (document) {
              console.log('URL document processed:', document);

              // Update the document in the data items list
              setDataItems(prev => {
                // Find and replace the temporary item with the real one
                const newItems = prev.filter(item => !(item.url === url && item.id.startsWith('temp_')));

                // Add the new document with the correct status
                newItems.push({
                  id: document.document_id.toString(),
                  knowledge_base_id: knowledgeBaseId,
                  type: 'link',
                  file_name: document.title,
                  file_size: 0,
                  url: document.file_url || '',
                  status: document.is_processed ? 'processing' : 'finished',
                  created_at: document.created_at || new Date().toISOString()
                });

                return newItems;
              });

              // Update processing items
              if (document.is_processed) {
                // Replace temp ID with real ID in processing items
                setProcessingItems(prev => {
                  const filtered = prev.filter(id => id !== tempId);
                  return [...filtered, document.document_id.toString()];
                });
              } else {
                // If already processed, remove from processing items
                setProcessingItems(prev => prev.filter(id => id !== tempId));
              }
            }
          })
          .catch(err => {
            console.error('Error processing URL:', err);
            // Remove from processing items if there's an error
            setProcessingItems(prev => prev.filter(id => id !== tempId));
          });
      }

      // Ensure notification is visible
      setShowNotification(true);
    } catch (err: any) {
      console.error('Error adding data:', err);
      setError(err.message || 'An error occurred while adding data');
    }
  };

  const handleDeleteItem = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!knowledgeBaseId || !itemToDelete) return;

    // Close the modal immediately before starting the delete operation
    setIsDeleteModalOpen(false);
    const itemToDeleteCopy = itemToDelete;
    setItemToDelete(null);

    try {
      // Try using the new document API first
      try {
        // Convert string ID to number for the document API
        const documentId = parseInt(itemToDeleteCopy, 10);
        if (!isNaN(documentId)) {
          const success = await deleteDocument(documentId);
          if (success) {
            // Remove from dataItems state
            setDataItems(prev => prev.filter(item => item.id !== itemToDeleteCopy));
            // Also remove from processing items if it's there
            setProcessingItems(prev => prev.filter(itemId => itemId !== itemToDeleteCopy));
            return;
          }
        }
        throw new Error('Document deletion failed');
      } catch (docErr) {
        console.error('Error deleting document with new API:', docErr);

        // Fallback to original method if the document API fails
        await deleteKnowledgeDataItem(knowledgeBaseId, itemToDeleteCopy);

        // Remove from dataItems state
        setDataItems(prev => prev.filter(item => item.id !== itemToDeleteCopy));
        // Also remove from processing items if it's there
        setProcessingItems(prev => prev.filter(itemId => itemId !== itemToDeleteCopy));
      }
    } catch (err: any) {
      console.error('Error deleting data item:', err);
      alert(`Failed to delete item: ${err.message}`);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleString('default', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  // Add state for notification collapse
  const [isNotificationCollapsed, setIsNotificationCollapsed] = useState(false);

  const toggleNotificationCollapse = () => {
    setIsNotificationCollapsed(!isNotificationCollapsed);
  };

  const handleViewFile = async (item: KnowledgeDataItem) => {
    // Set the selected file immediately to show loading state in modal
    setSelectedFile(item);
    setIsContentLoading(true);
    setContentError(null);
    setSelectedFileContent(null);

    try {
      const documentId = parseInt(item.id, 10);
      if (isNaN(documentId)) {
        throw new Error('Invalid document ID');
      }

      const document = await getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Set document content
      setSelectedFileContent(document.content || 'No content available');
    } catch (err: any) {
      console.error('Error fetching document content:', err);
      setContentError(err.message || 'Failed to load document content');
    } finally {
      setIsContentLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="pt-16 px-4 bg-white dark:bg-black min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-16 px-4 bg-white dark:bg-black min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg">
            <p className="text-red-700 dark:text-red-200">{error}</p>
          </div>
          <Link href="/knowledge" className="text-blue-600 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400 mt-4 block">
            {t.backToKnowledge}
          </Link>
        </div>
      </div>
    );
  }

  if (!knowledge) {
    return (
      <div className="pt-16 px-4 bg-white dark:bg-black min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-gray-900 dark:text-white text-2xl font-bold mb-4">{t.notFound}</h1>
          <Link href="/knowledge" className="text-blue-600 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400">
            {t.backToKnowledge}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 px-4 bg-white dark:bg-black min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{knowledge?.title || t.notFound}</h1>
            {knowledge?.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl line-clamp-1">
                {knowledge.description}
              </p>
            )}
          </div> */}
          <button
            onClick={() => router.push('/knowledge')}
            className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            {t.backToKnowledge}
          </button>
        </div>

        <article className="bg-gradient-to-r from-blue-50 to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 mb-8 shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center w-full md:w-auto">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg mr-4 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 005.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{knowledge?.title}</h1>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{knowledge?.created_at ? formatDate(knowledge.created_at) : '-'}</span>
                </div>
              </div>
            </div>

            {knowledge?.description && (
              <div className="w-full md:w-auto mt-4 md:mt-0 md:ml-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
                <p className="text-gray-700 dark:text-gray-300">{knowledge.description}</p>
              </div>
            )}
          </div>
        </article>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-gray-900 dark:text-white text-2xl font-bold">{t.relatedData}</h2>
            <div className="flex items-center space-x-3">
              {/* Processing status badge */}
              {processingItems.length > 0 && (
                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full text-sm flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {processingItems.length === 1
                    ? t.processing?.single || "Processing 1 file..."
                    : messageFormatter(t.processing?.multiple || "Processing {count} files...", { count: processingItems.length })}
                </div>
              )}
              <button
                onClick={() => setIsDataModalOpen(true)}
                className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                {t.addNewData}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 px-4">{t.table.title || "Title"}</th>
                  <th className="pb-3 px-4">{t.table.pathUrl || "Path/URL"}</th>
                  <th className="pb-3 px-4">{t.table.type}</th>
                  <th className="pb-3 px-4">{t.table.uploadTime}</th>
                  <th className="pb-3 px-4">{t.table.status}</th>
                  <th className="pb-3 px-4">{t.table.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {dataItems.map((item) => (
                  <tr key={item.id} className="text-gray-700 dark:text-gray-300">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <span className="mr-2">{item.type === 'file' ? '📁' : '🔗'}</span>
                        <span className="font-medium">{item.file_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="truncate max-w-xs">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 truncate">
                            {item.url}
                          </a>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 italic">N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {item.type === 'file' ? (
                        <span className="text-gray-700 dark:text-gray-300">
                          {item.file_name?.split('.').pop()?.toUpperCase() || 'FILE'}
                        </span>
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300">URL</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{formatDate(item.created_at)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm ${item.status === 'finished'
                        ? 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-300'
                        }`}>
                        {item.status === 'finished' ? t.status.finished : t.status.processing}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {item.status === 'finished' ? (
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleViewFile(item)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 mr-3"
                            title={t.actions.view}
                          >
                            {t.actions.view}
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
                            title={t.actions.delete}
                          >
                            {t.actions.delete}
                          </button>
                        </div>
                      ) : (
                        <div className="text-gray-400 dark:text-gray-600 text-sm italic">
                          {t.status.processing}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {dataItems.length === 0 && (
              <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                {t.noData}
              </p>
            )}
          </div>
        </div>

        {showNotification && (
          <div className="fixed bottom-4 right-4 max-w-md w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-blue-200 dark:border-blue-800 overflow-hidden transition-all duration-300 transform">
            {/* Header with toggle button */}
            <div className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-3 flex justify-between items-center">
              <h3 className="font-medium text-sm flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                {t.notification?.title || "Processing Status"}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleNotificationCollapse}
                  className="text-white hover:bg-blue-700 dark:hover:bg-blue-600 p-1 rounded"
                  aria-label={isNotificationCollapsed ? "Expand" : "Collapse"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform duration-200 ${isNotificationCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content - shown when not collapsed */}
            <div className={`overflow-hidden transition-all duration-300 ${isNotificationCollapsed ? 'max-h-0' : 'max-h-64'}`}>
              <div className="p-4 text-gray-700 dark:text-gray-300">
                {/* Processing items indicator */}
                {processingItems.length > 0 && (
                  <div>
                    <div className="flex items-center text-amber-600 dark:text-amber-400 font-medium mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {processingItems.length === 1
                        ? t.processing?.single || "Processing 1 file..."
                        : messageFormatter(t.processing?.multiple || "Processing {count} files...", { count: processingItems.length })}
                    </div>
                    {processingItems.length > 0 && (
                      <div className="ml-7 text-sm mt-1 max-h-24 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded p-2">
                        {dataItems
                          .filter(item => processingItems.includes(item.id))
                          .map(item => (
                            <div key={item.id} className="truncate text-gray-600 dark:text-gray-400 py-1">
                              {item.type === 'file' ? item.file_name : item.url}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* Show when nothing is processing */}
                {processingItems.length === 0 && (
                  <div className="flex items-center justify-center text-gray-500 dark:text-gray-400 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {t.notification?.noTasks || "No tasks in progress"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <CreateDataModal
          isOpen={isDataModalOpen}
          onClose={() => setIsDataModalOpen(false)}
          onSubmit={handleAddData}
          knowledgeBaseId={knowledgeBaseId}
        />

        <FileInfoModal
          isOpen={!!selectedFile}
          onClose={() => setSelectedFile(null)}
          fileData={selectedFile ? {
            name: selectedFile.file_name,
            size: selectedFile.file_size,
            value: selectedFile.url,
            type: selectedFile.type,
            uploadTime: selectedFile.created_at,
            id: selectedFile.id,
            content: selectedFileContent,
            isLoading: isContentLoading,
            error: contentError
          } : null}
        />

        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          title={t.confirmDeleteTitle || "Confirm Delete"}
          message={t.confirmDeleteMessage || "Are you sure you want to delete this document? This action cannot be undone."}
        />

        {/* Toast notification for duplicate files/URLs */}
        {toast.visible && (
          <div
            className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center transition-all duration-300 ${toast.type === 'error' ? 'bg-red-500 text-white' :
              toast.type === 'warning' ? 'bg-yellow-500 text-white' :
                'bg-green-500 text-white'
              }`}
            role="alert"
          >
            <div className="mr-3 flex-shrink-0">
              {toast.type === 'error' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : toast.type === 'warning' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div>{toast.message}</div>
            <button
              onClick={() => setToast(prev => ({ ...prev, visible: false }))}
              className="ml-4 text-white opacity-70 hover:opacity-100"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}