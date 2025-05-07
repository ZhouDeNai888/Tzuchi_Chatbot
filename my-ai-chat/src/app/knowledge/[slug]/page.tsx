'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import CreateDataModal from '../../../components/CreateDataModal';
import FileInfoModal from '../../../components/FileInfoModal';
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

  const [knowledge, setKnowledge] = useState<KnowledgeBase | null>(null);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [dataItems, setDataItems] = useState<KnowledgeDataItem[]>([]);
  const [processingItems, setProcessingItems] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<KnowledgeDataItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // so we don't need to change the rest of the component
        const convertedItems = documents.map(doc => ({
          id: doc.document_id.toString(),
          knowledge_base_id: knowledgeBaseId,
          type: doc.file_url?.includes('http') ? 'link' as const : 'file' as const,
          file_name: doc.title,
          url: doc.file_url || '',
          file_size: 0, // Placeholder as this may not be available in the API
          status: doc.is_processed ? 'finished' as const : 'processing' as const,
          created_at: doc.created_at || new Date().toISOString(),
        }));

        setDataItems(convertedItems);

        // Check for processing items
        setProcessingItems(convertedItems
          .filter(item => item.status === 'processing')
          .map(item => item.id)
        );
      } catch (docErr) {
        console.error('Error fetching documents:', docErr);
        // Fallback to original method if document API fails
        const items = await getKnowledgeDataItems(knowledgeBaseId);
        setDataItems(items);
        setProcessingItems(items.filter(item => item.status === 'processing').map(item => item.id));
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
        // Use the new document API for polling
        try {
          const documents = await getDocumentsInKnowledgeBase(knowledgeBaseId);
          console.log('Polling documents:', documents);
          // Convert Document objects to the existing KnowledgeDataItem format
          const convertedItems = documents.map(doc => ({
            id: doc.document_id.toString(),
            knowledge_base_id: knowledgeBaseId,
            type: doc.file_url?.includes('http') ? 'link' as const : 'file' as const,
            file_name: doc.title,
            url: doc.file_url || '',
            file_size: 0,
            status: doc.is_processed ? 'finished' as const : 'processing' as const,
            created_at: doc.created_at || new Date().toISOString(),
          }));

          setDataItems(convertedItems);

          // Update processing items
          const stillProcessing = convertedItems
            .filter(item => item.status === 'processing')
            .map(item => item.id);

          setProcessingItems(stillProcessing);

          // If all items are finished processing, stop polling
          if (stillProcessing.length === 0) {
            clearInterval(intervalId);
          }
        } catch (docErr) {
          console.error('Error fetching documents during polling:', docErr);
          // Fallback to original method if document API fails
          const items = await getKnowledgeDataItems(knowledgeBaseId);
          setDataItems(items);

          // Update processing items
          const stillProcessing = items
            .filter(item => item.status === 'processing')
            .map(item => item.id);

          setProcessingItems(stillProcessing);

          // If all items are finished processing, stop polling
          if (stillProcessing.length === 0) {
            clearInterval(intervalId);
          }
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

  const handleAddData = async (type: 'file' | 'link', filesOrLink: File[] | string) => {
    if (!knowledgeBaseId) return;
    setError(null);

    try {
      if (type === 'file' && Array.isArray(filesOrLink)) {
        // Add files to UI immediately with processing status
        const tempItems: KnowledgeDataItem[] = [];
        const currentTime = new Date().toISOString();

        // Create temporary items for each file with processing status
        for (const file of filesOrLink) {
          if (isDuplicate('file', file.name)) {
            setError(`File "${file.name}" already exists`);
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
        }

        // Process each file with API
        for (const file of filesOrLink) {
          if (isDuplicate('file', file.name) && !tempItems.some(item => item.file_name === file.name)) {
            continue; // Skip files that were already duplicates
          }

          try {
            const file_type = file.name.split('.').pop() || 'unknown';
            console.log('Uploading file:', file.name);

            // Find the temporary item for this file
            const tempItem = tempItems.find(item => item.file_name === file.name);

            // Call API to process file and wait for the response
            const document = await createDocumentWithFile(knowledgeBaseId, file, file_type, file.name);

            if (document) {
              // Remove temporary item and add real item with status directly from API response
              setDataItems(prev => {
                // Filter out the temporary item
                const filteredItems = tempItem
                  ? prev.filter(item => item.id !== tempItem.id)
                  : prev;

                // Check if document is processed from API response
                const status = document.is_processed ? 'finished' : 'processing';

                // Add the real item with API response data
                return [...filteredItems, {
                  id: document.document_id.toString(),
                  knowledge_base_id: knowledgeBaseId,
                  type: 'file' as const,
                  file_name: document.title,
                  url: document.file_url || '',
                  file_size: file.size,
                  status: status,
                  created_at: document.created_at || currentTime
                }];
              });

              // If document is still processing, add to processing items for polling
              if (!document.is_processed) {
                setProcessingItems(prev => [...prev, document.document_id.toString()]);
              }
            } else {
              // If API call failed, update the status of temporary item to error
              setDataItems(prev => prev.map(item => {
                if (tempItem && item.id === tempItem.id) {
                  return { ...item, status: 'processing' as const };
                }
                return item;
              }));
            }
          } catch (err: any) {
            console.error('Error uploading file:', err);

            // Update the temporary item to show error
            if (tempItems.find(item => item.file_name === file.name)) {
              setDataItems(prev => prev.map(item => {
                if (item.file_name === file.name && item.status === 'processing') {
                  return { ...item, status: 'processing' as const };
                }
                return item;
              }));
            }

            setError(`Error uploading ${file.name}: ${err.message || 'Unknown error'}`);
          }
        }
      } else if (type === 'link' && typeof filesOrLink === 'string') {
        const url = filesOrLink.trim();

        // Check if URL already exists
        if (isDuplicate('link', url)) {
          setError(`URL "${url}" already exists`);
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

        try {
          console.log('Adding URL:', url);

          // Call API to process URL
          const document = await createDocumentWithURL(knowledgeBaseId, url, tempItem.file_name);

          if (document) {
            // Remove temporary item and add real item with status from API response
            setDataItems(prev => {
              // Filter out the temporary item
              const filteredItems = prev.filter(item => item.id !== tempId);

              // Check if document is processed from API response
              const status = document.is_processed ? 'finished' : 'processing';

              // Add the real item with API response data
              return [...filteredItems, {
                id: document.document_id.toString(),
                knowledge_base_id: knowledgeBaseId,
                type: 'link' as const,
                file_name: document.title || url.split('/').pop() || 'Web Content',
                url: document.file_url || url,
                file_size: 0,
                status: status,
                created_at: document.created_at || currentTime
              }];
            });

            // If document is still processing, add to processing items for polling
            if (!document.is_processed) {
              setProcessingItems(prev => [...prev, document.document_id.toString()]);
            }
          } else {
            // If API call failed, update the status of temporary item to error
            setDataItems(prev => prev.map(item => {
              if (item.id === tempId) {
                return { ...item, status: 'processing' as const };
              }
              return item;
            }));

            setError(`Failed to process URL: ${url}`);
          }
        } catch (err: any) {
          console.error('Error processing URL:', err);

          // Update the temporary item to show error
          setDataItems(prev => prev.map(item => {
            if (item.id === tempId) {
              return { ...item, status: 'processing' as const };
            }
            return item;
          }));

          setError(`Error processing URL: ${err.message || 'Unknown error'}`);
        }
      }
    } catch (err: any) {
      console.error('Error adding data:', err);
      setError(err.message || 'An error occurred while adding data');
    }
  };

  const deleteItem = async (id: string) => {
    if (!knowledgeBaseId) return;

    try {
      // Try using the new document API first
      try {
        // Convert string ID to number for the document API
        const documentId = parseInt(id, 10);
        if (!isNaN(documentId)) {
          const success = await deleteDocument(documentId);
          if (success) {
            // Remove from dataItems state
            setDataItems(prev => prev.filter(item => item.id !== id));
            // Also remove from processing items if it's there
            setProcessingItems(prev => prev.filter(itemId => itemId !== id));
            return;
          }
        }
        throw new Error('Document deletion failed');
      } catch (docErr) {
        console.error('Error deleting document with new API:', docErr);

        // Fallback to original method if the document API fails
        await deleteKnowledgeDataItem(knowledgeBaseId, id);

        // Remove from dataItems state
        setDataItems(prev => prev.filter(item => item.id !== id));
        // Also remove from processing items if it's there
        setProcessingItems(prev => prev.filter(itemId => itemId !== id));
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

  const handleViewFile = (item: KnowledgeDataItem) => {
    setSelectedFile(item);
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
        <Link href="/knowledge" className="text-blue-600 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400 mb-4 block transition-colors">
          {t.backToKnowledge}
        </Link>

        <article className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 mb-8 shadow-lg">
          <h1 className="text-gray-900 dark:text-white text-3xl font-bold mb-4">{knowledge.title}</h1>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 text-lg mb-6">{knowledge.description}</p>
          </div>
        </article>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-gray-900 dark:text-white text-2xl font-bold">{t.relatedData}</h2>
            <button
              onClick={() => setIsDataModalOpen(true)}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              {t.addNewData}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 px-4">{t.table.fileName}</th>
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
                      {item.type === 'file' ? (
                        <div className="flex items-center">
                          <span className="mr-2">📁</span>
                          <span>{item.file_name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="mr-2">🔗</span>
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
                            {item.url}
                          </a>
                        </div>
                      )}
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
                            onClick={() => deleteItem(item.id)}
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

        {processingItems.length > 0 && (
          <div className="fixed bottom-4 right-4 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-200 px-4 py-2 rounded-lg shadow-lg">
            <div>
              {processingItems.length === 1
                ? t.processing.single
                : messageFormatter(t.processing.multiple, { count: processingItems.length })}
            </div>
            <div className="text-sm mt-1">
              {dataItems
                .filter(item => processingItems.includes(item.id))
                .map(item => (
                  <div key={item.id} className="text-blue-900 dark:text-blue-200">
                    {item.type === 'file' ? item.file_name : item.url}
                  </div>
                ))
              }
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
            uploadTime: selectedFile.created_at
          } : null}
        />
      </div>
    </div>
  );
}