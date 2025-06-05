import React from 'react';

interface CreateKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string) => void;
}

export default function CreateKnowledgeModal({ isOpen, onClose, onSubmit }: CreateKnowledgeModalProps) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(title, description);
    setTitle('');
    setDescription('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-gray-900 dark:text-white text-2xl font-bold mb-4">Create Knowledge Base Item</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="title" className="block text-gray-700 dark:text-gray-300 mb-2">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="description" className="block text-gray-700 dark:text-gray-300 mb-2">Description (Optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors h-32"
            />
          </div>
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-white bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}