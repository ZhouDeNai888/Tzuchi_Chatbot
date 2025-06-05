'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';

export default function PreviewPage() {
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [embedCode, setEmbedCode] = useState<string>('');
    const [theme, setTheme] = useState<string>('light');
    const { language } = useLanguage();
    const t = translations[language].preview;

    useEffect(() => {
        // Read query parameters
        const params = new URLSearchParams(window.location.search);
        const apiKeyParam = params.get('apiKey');
        const themeParam = params.get('theme') || 'light'; // Get theme from URL or default to light

        if (apiKeyParam) {
            setApiKey(apiKeyParam);
            setTheme(themeParam);
            // Include the theme parameter in the embed script
            setEmbedCode(`<tcu-ai></tcu-ai><script src="${window.location.origin}/api/embed.js" id="ai-chat-embed" data-api-key="${apiKeyParam}" data-theme="${themeParam}"></script>`);
        }
    }, []);

    // Ensure script is loaded on component mount
    useEffect(() => {
        if (apiKey && embedCode) {
            // Remove any existing embed script
            const existingScript = document.getElementById('ai-chat-embed');
            if (existingScript) {
                existingScript.remove();
            }

            // Add the new script
            const script = document.createElement('script');
            script.id = 'ai-chat-embed';
            script.src = `${window.location.origin}/api/embed.js`;
            script.setAttribute('data-api-key', apiKey);
            script.setAttribute('data-theme', theme);
            document.body.appendChild(script);

            // Add tcu-ai element before script
            const tcuElement = document.createElement('tcu-ai');
            document.body.appendChild(tcuElement);
            document.body.appendChild(script);
        }
    }, [apiKey, embedCode, theme]);

    return (
        <div className={`mt-16 min-h-screen flex flex-col p-8 dark:bg-gray-900 text-whitebg-gray-100 text-gray-900`}>
            <div className="max-w-4xl mx-auto w-full">
                <h1 className="text-3xl font-bold mb-6 dark:text-white text-black">{t.title}</h1>

                {apiKey ? (
                    <>
                        <div className="p-4 mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-3 dark:text-white text-black">{t.embedCode}</h2>
                            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md overflow-x-auto">
                                <code className="font-mono text-sm whitespace-pre-wrap break-all dark:text-white text-black">
                                    {embedCode}
                                </code>
                            </div>
                        </div>

                        <div className="p-4 mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                            <h2 className="text-xl font-semibold mb-3 dark:text-white text-black">{t.previewSection}</h2>
                            <p className="mb-4 dark:text-white text-black">
                                {t.previewDescription}
                            </p>
                            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-md dark:text-white text-black">
                                <p className="font-medium">{t.theme}: {theme}</p>
                                <p className="font-medium">{t.apiKey}: {apiKey.substring(0, 10)}...{apiKey.substring(apiKey.length - 10)}</p>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
                        <p className="text-xl text-red-500">
                            {t.noApiKey} <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded">?apiKey=YOUR_API_KEY</code> {t.toUrl}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}