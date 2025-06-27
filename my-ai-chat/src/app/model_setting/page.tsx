'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { translations } from '@/utils/translations';
import apiService, { getAllModels, addModel, deleteModel } from '@/utils/apiService';
import { toast } from 'react-hot-toast';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

// Define Model interface based on the provided data structure
interface Model {
    ModelID: number;
    ModelName: string;
    Platform: string;
    CreatedAt: string;
    CreatedBy: number;
    CreatedByUsername: string;
    IsActive: boolean;
}

export default function ModelSettingPage() {
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingModel, setAddingModel] = useState(false);
    const [platform, setPlatform] = useState<'gpt' | 'azure' | 'ollama' | 'custom'>('gpt');
    const [modelName, setModelName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [apiVersion, setApiVersion] = useState('2023-05-15');
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const { isAuthenticated } = useAuth();
    const { language } = useLanguage();
    const t = translations[language].model_setting;

    // Fetch available models when component mounts
    useEffect(() => {
        if (isAuthenticated) {
            fetchModels();
        }
    }, [isAuthenticated]);

    const fetchModels = async () => {
        try {
            setLoading(true);
            const availableModels = await getAllModels();
            setModels(availableModels);
        } catch (error) {
            console.error('Error fetching models:', error);
            toast.error('Failed to load models');
        } finally {
            setLoading(false);
        }
    };

    const handleAddModel = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!modelName.trim()) {
            toast.error('Model name is required');
            return;
        }

        // Validate API key for GPT and Azure platforms
        if ((platform === 'gpt' || platform === 'azure') && !apiKey.trim()) {
            toast.error('API key is required for this platform');
            return;
        }

        // Validate API version for Azure platform
        if (platform === 'azure' && !apiVersion.trim()) {
            toast.error('API version is required for Azure platform');
            return;
        }

        try {
            setAddingModel(true);
            // Get the current user ID or use a default if not available
            const userProfile = await apiService.getUserProfile();
            const userId = userProfile?.UserID || 1;

            // Pass API key and api_version directly (not in config)
            const result = await addModel(
                platform,
                modelName,
                userId,
                apiKey,
                platform === 'azure' ? apiVersion : undefined
            );

            if (result.success) {
                toast.success(t.addModelSuccess);
                setModelName('');
                setApiKey('');
                setApiVersion('2023-05-15'); // Reset to default
                fetchModels(); // Refresh the models list
            } else {
                toast.error(t.addModelError);
            }
        } catch (error) {
            console.error('Error adding model:', error);
            toast.error(t.addModelError);
        } finally {
            setAddingModel(false);
        }
    };

    const handleSelectModelToDelete = (model: Model) => {
        setSelectedModel(model);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedModel) return;

        try {
            setLoading(true);
            setShowDeleteModal(false);

            // Extract the model ID from the selected model
            const modelId = selectedModel.ModelID;

            // Ensure modelId is a number
            const result = await deleteModel(Number(modelId));

            if (result.success) {
                toast.success(t.deleteModelSuccess);
                fetchModels(); // Refresh the models list
            } else {
                toast.error(t.deleteModelError);
            }
        } catch (error) {
            console.error('Error deleting model:', error);
            toast.error(t.deleteModelError);
        } finally {
            setLoading(false);
            setSelectedModel(null);
        }
    };

    const handleCancelDelete = () => {
        setShowDeleteModal(false);
        setSelectedModel(null);
    };

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6 dark:text-white">{t.title}</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">{t.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Model List */}
                <div className="md:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4 dark:text-white">{t.availableModels}</h2>
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        ) : models.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white dark:bg-gray-800">
                                    <thead className="bg-gray-100 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Platform</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created By</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created At</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {models.map((model) => {
                                            // Format the date to a more readable format
                                            const formattedDate = new Date(model.CreatedAt).toLocaleString();

                                            return (
                                                <tr key={model.ModelID} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{model.ModelID}</td>
                                                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">{model.ModelName}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-300">{model.Platform}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-300">{model.CreatedByUsername}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-300">{formattedDate}</td>
                                                    <td className="px-4 py-2 text-sm">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${model.IsActive ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'}`}>
                                                            {model.IsActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm">
                                                        <button
                                                            onClick={() => handleSelectModelToDelete(model)}
                                                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded"
                                                            aria-label={`${t.deleteModel}: ${model.ModelName}`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                {t.noModelsFound}
                            </div>
                        )}
                    </div>
                </div>

                {/* Add Model Form */}
                <div className="md:col-span-1">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4 dark:text-white">{t.addModel}</h2>
                        <form onSubmit={handleAddModel} className="space-y-4">
                            <div>
                                <label htmlFor="platform" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    {t.platformLabel}
                                </label>
                                <select
                                    id="platform"
                                    value={platform}
                                    onChange={(e) => setPlatform(e.target.value as 'gpt' | 'azure' | 'ollama' | 'custom')}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                >
                                    <option value="gpt">{t.platforms.gpt}</option>
                                    <option value="azure">Azure OpenAI</option>
                                    <option value="ollama">{t.platforms.ollama}</option>
                                    {/* <option value="custom">{t.platforms.custom}</option> */}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="modelName" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    {t.modelNameLabel}
                                </label>
                                <input
                                    type="text"
                                    id="modelName"
                                    value={modelName}
                                    onChange={(e) => setModelName(e.target.value)}
                                    placeholder={t.modelNamePlaceholder}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                />
                            </div>

                            {(platform === 'gpt' || platform === 'azure') && (
                                <div>
                                    <label htmlFor="apiKey" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                        API Key
                                    </label>
                                    <input
                                        type="password"
                                        id="apiKey"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter your API key"
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                    />
                                </div>
                            )}

                            {platform === 'azure' && (
                                <div>
                                    <label htmlFor="apiVersion" className="block text-sm font-medium mb-2 dark:text-gray-300">
                                        API Version
                                    </label>
                                    <input
                                        type="text"
                                        id="apiVersion"
                                        value={apiVersion}
                                        onChange={(e) => setApiVersion(e.target.value)}
                                        placeholder="Enter API version (e.g., 2023-05-15)"
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                    />
                                </div>
                            )}

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={addingModel || !modelName.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {addingModel ? (
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                            {translations[language].common.processing}
                                        </div>
                                    ) : (
                                        t.saveButton
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmDeleteModal
                isOpen={showDeleteModal}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title={t.confirmDeleteTitle}
                message={`${t.confirmDelete} (${selectedModel ? selectedModel.ModelName : ''})`}
            />
        </div>
    );
}