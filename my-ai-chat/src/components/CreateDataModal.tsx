'use client';

import React, { useState, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { addKnowledgeFile, addKnowledgeLink } from '@/utils/apiService';

interface CreateDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (type: 'file' | 'link', files: File[] | string) => void;
  knowledgeBaseId?: number;
}

export default function CreateDataModal({ isOpen, onClose, onSubmit, knowledgeBaseId }: CreateDataModalProps) {
  const [type, setType] = useState<'file' | 'link'>('file');
  const [link, setLink] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();
  const t = translations[language].knowledgeDetail;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!knowledgeBaseId) {
      setErrorMessage('Knowledge base ID is required');
      return;
    }

    try {
      if (type === 'file') {
        if (files.length === 0) {
          setErrorMessage('Please select at least one file');
          return;
        }

        setIsUploading(true);

        // We'll let the parent component handle the upload process
        // since it has better context about the knowledge base ID
        onSubmit(type, files);

      } else {
        if (!link.trim()) {
          setErrorMessage('Please enter a valid URL');
          return;
        }

        // For links, we'll also use the parent component's handler
        onSubmit(type, link);
      }

      // Reset form after successful submission
      setLink('');
      setFiles([]);
      onClose();
    } catch (error) {
      console.error('Submission error:', error);
      setErrorMessage('An error occurred. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(droppedFiles);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-gray-900 dark:text-white text-2xl font-bold mb-4">{t.addNewData}</h2>

        {errorMessage && (
          <div className="mb-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 rounded-md">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="file"
                  checked={type === 'file'}
                  onChange={(e) => setType(e.target.value as 'file' | 'link')}
                  className="mr-2 text-blue-600 dark:text-blue-500"
                />
                {t.fileUpload}
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="link"
                  checked={type === 'link'}
                  onChange={(e) => setType(e.target.value as 'file' | 'link')}
                  className="mr-2 text-blue-600 dark:text-blue-500"
                />
                {t.linkInput}
              </label>
            </div>
          </div>

          {type === 'file' ? (
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">{t.uploadFiles}</label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'
                  }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center justify-center py-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 dark:text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.dragAndDrop}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{t.fileSizeLimit}</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.selectedFiles}</h3>
                  <ul className="bg-gray-50 dark:bg-gray-700 rounded-md divide-y divide-gray-200 dark:divide-gray-600">
                    {files.map((file, index) => (
                      <li key={index} className="flex items-center justify-between py-2 px-3">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm truncate max-w-xs">{file.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <label htmlFor="link" className="block text-gray-700 dark:text-gray-300 mb-2">
                {t.enterLink}
              </label>
              <input
                id="link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://example.com/document"
                className="w-full px-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t.linkDescription}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t.uploading}
                </div>
              ) : (
                t.submit
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}