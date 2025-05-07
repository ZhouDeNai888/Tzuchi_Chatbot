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
  } | null;
}

export default function FileInfoModal({ isOpen, onClose, fileData }: FileInfoModalProps) {
  if (!isOpen || !fileData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 shadow-xl">
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
              <p><span className="font-semibold text-gray-900 dark:text-white">Size:</span> {(fileData.size || 0 / 1024).toFixed(2)} KB</p>
            </>
          ) : (
            <p><span className="font-semibold text-gray-900 dark:text-white">URL:</span> {fileData.value}</p>
          )}
          <p><span className="font-semibold text-gray-900 dark:text-white">Type:</span> {fileData.type}</p>
          <p><span className="font-semibold text-gray-900 dark:text-white">Upload Time:</span> {fileData.uploadTime}</p>
        </div>
      </div>
    </div>
  );
}
