import React from 'react';

interface FileInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileData: {
    name?: string;
    size?: number;
    value?: string;
    type: 'file' | 'link';
    uploadTime: string;
    id?: string; // Document ID for fetching content
    content?: string | null; // New property to receive pre-fetched content
    isLoading?: boolean; // New property to indicate loading state
    error?: string | null; // New property to indicate error state
  } | null;
}

export default function FileInfoModal({ isOpen, onClose, fileData }: FileInfoModalProps) {
  if (!isOpen || !fileData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">File Information</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          {fileData.type === 'file' ? (
            <>
              <p><span className="font-semibold text-gray-900 dark:text-white">Name:</span> {fileData.name}</p>
              <p><span className="font-semibold text-gray-900 dark:text-white">Size:</span> {((fileData.size || 0) / 1024).toFixed(2)} KB</p>
            </>
          ) : (
            <p><span className="font-semibold text-gray-900 dark:text-white">URL:</span> {fileData.value}</p>
          )}
          <p><span className="font-semibold text-gray-900 dark:text-white">Type:</span> {fileData.type}</p>
          <p><span className="font-semibold text-gray-900 dark:text-white">Upload Time:</span> {fileData.uploadTime}</p>
        </div>

        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4 flex-1 overflow-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Document Content</h3>

          {fileData.isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : fileData.error ? (
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded text-red-700 dark:text-red-300">
              {fileData.error}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[50vh]">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
                {fileData.content || 'No content available'}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
