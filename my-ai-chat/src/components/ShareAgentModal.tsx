'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { shareAgent, SharedAgentData } from '@/utils/apiService';
import { toast } from 'react-hot-toast';

interface ShareAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: number;
    agentName: string;
}

const ShareAgentModal: React.FC<ShareAgentModalProps> = ({
    isOpen,
    onClose,
    agentId,
    agentName,
}) => {
    const { language } = useLanguage();
    const agentT = translations[language].agent || {
        shareAgent: 'Share Agent',
        shareSuccess: 'Agent Shared Successfully',
        shareWarning: 'Keep this API key secure. Anyone with this key can use your agent.',
        apiKey: 'API Key',
        embedCode: 'Embed Code',
        copyEmbed: 'Copy Embed Code',
        form: {
            shareName: 'Share Name',
            shareDescription: 'Description',
            allowedOrigins: 'Allowed Origins',
            allowedOriginsHint: 'Use * for any website or comma-separated list of domains',
            usageLimit: 'Usage Limit',
            unlimited: 'Unlimited',
            expiryDays: 'Expiry Days',
            neverExpires: 'Never Expires'
        },
        shareButton: 'Share Agent'
    };

    const commonT = translations[language].common || {
        cancel: 'Cancel',
        processing: 'Processing...',
        done: 'Done',
        copied: 'Copied!'
    };

    const [formData, setFormData] = useState<SharedAgentData>({
        name: agentName,
        description: '',
        allowedOrigins: '*',
        usageLimit: null,
        expiryDays: null,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const apiKeyRef = useRef<HTMLInputElement>(null);
    const embedCodeRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset form when modal opens
            setFormData({
                name: agentName,
                description: '',
                allowedOrigins: '*',
                usageLimit: null,
                expiryDays: null,
            });
            setApiKey(null);
            setCopied(false);
        }
    }, [isOpen, agentName]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'usageLimit' | 'expiryDays') => {
        const value = e.target.value ? parseInt(e.target.value) : null;

        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const result = await shareAgent(agentId, formData);
            setApiKey(result.apiKey);
            toast.success(agentT.shareSuccess);
        } catch (error) {
            console.error('Error sharing agent:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to share agent');
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyToClipboard = (text: string, type: 'apiKey' | 'embedCode') => {
        navigator.clipboard.writeText(text);
        setCopied(true);

        toast.success(commonT.copied);

        setTimeout(() => {
            setCopied(false);
        }, 3000);
    };

    const getEmbedCode = () => {
        if (!apiKey) return '';

        return `<script src="${window.location.origin}/api/embed.js" id="ai-chat-embed" data-api-key="${apiKey}"></script>`;
    };

    // If modal is not open, don't render anything
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md transform transition-all max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                        {agentT.shareAgent}
                    </h2>

                    {apiKey ? (
                        <div className="space-y-6">
                            <div className="p-3 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 rounded-md text-sm">
                                {agentT.shareWarning}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {agentT.apiKey}
                                </label>
                                <div className="flex">
                                    <input
                                        ref={apiKeyRef}
                                        type="text"
                                        readOnly
                                        value={apiKey}
                                        className="flex-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-l-md p-2 text-gray-900 dark:text-white focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(apiKey, 'apiKey')}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                                    >
                                        {copied ? commonT.copied : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {agentT.embedCode}
                                </label>
                                <div className="flex flex-col">
                                    <textarea
                                        ref={embedCodeRef}
                                        readOnly
                                        value={getEmbedCode()}
                                        rows={3}
                                        className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-t-md p-2 text-gray-900 dark:text-white focus:outline-none font-mono text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(getEmbedCode(), 'embedCode')}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-b-md hover:bg-blue-700"
                                    >
                                        {agentT.copyEmbed}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    {commonT.done}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {agentT.form.shareName}
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {agentT.form.shareDescription}
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={2}
                                    className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label htmlFor="allowedOrigins" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {agentT.form.allowedOrigins}
                                </label>
                                <input
                                    type="text"
                                    id="allowedOrigins"
                                    name="allowedOrigins"
                                    value={formData.allowedOrigins}
                                    onChange={handleChange}
                                    className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {agentT.form.allowedOriginsHint}
                                </p>
                            </div>

                            <div>
                                <label htmlFor="usageLimit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {agentT.form.usageLimit}
                                </label>
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        id="usageLimit"
                                        name="usageLimit"
                                        min="1"
                                        value={formData.usageLimit === null ? '' : formData.usageLimit}
                                        onChange={(e) => handleNumberChange(e, 'usageLimit')}
                                        className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                {formData.usageLimit === null && (
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {agentT.form.unlimited}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="expiryDays" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {agentT.form.expiryDays}
                                </label>
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        id="expiryDays"
                                        name="expiryDays"
                                        min="1"
                                        value={formData.expiryDays === null ? '' : formData.expiryDays}
                                        onChange={(e) => handleNumberChange(e, 'expiryDays')}
                                        className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                {formData.expiryDays === null && (
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {agentT.form.neverExpires}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    {commonT.cancel}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? commonT.processing : agentT.shareButton}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShareAgentModal;