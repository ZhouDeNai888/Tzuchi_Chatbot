import React from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareType: string;
  shareUrl: string;
  embedScript: string;
}

const ShareModal = ({ isOpen, onClose, shareType }: ShareModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full shadow-xl">
        <div className="text-center">
          <div className="text-green-600 dark:text-green-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Copied Successfully!</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The {shareType === 'link' ? 'share link' : 'embed code'} has been copied to your clipboard.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
