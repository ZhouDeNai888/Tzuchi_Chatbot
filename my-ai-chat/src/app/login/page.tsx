'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { login, isAuthenticated } = useAuth();
    const { language } = useLanguage();

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username.trim() || !password.trim()) {
            setError('Username and password are required');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await login(username, password);
            // The redirect is handled in the AuthContext after successful login
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="flex flex-col items-center mb-6">
                <div className="flex items-center mb-4">
                    <div className="mr-2 text-blue-600 dark:text-blue-400">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Chat</h1>
                </div>
                <h2 className="text-xl text-gray-600 dark:text-gray-300">
                    {language === 'en' ? 'Sign in to your account' : '登入您的帳戶'}
                </h2>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {language === 'en' ? 'Username' : '使用者名稱'}
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={language === 'en' ? 'Enter your username' : '輸入使用者名稱'}
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {language === 'en' ? 'Password' : '密碼'}
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={language === 'en' ? 'Enter your password' : '輸入密碼'}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <input
                            id="remember_me"
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                            {language === 'en' ? 'Remember me' : '記住我'}
                        </label>
                    </div>
                    <div className="text-sm">
                        <a href="#" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            {language === 'en' ? 'Forgot password?' : '忘記密碼？'}
                        </a>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''
                        }`}
                >
                    {isLoading ? (
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : null}
                    {isLoading
                        ? (language === 'en' ? 'Signing in...' : '登入中...')
                        : (language === 'en' ? 'Sign in' : '登入')}
                </button>
            </form>

            <div className="mt-6">
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            {language === 'en' ? 'Or' : '或'}
                        </span>
                    </div>
                </div>

                <div className="mt-6">
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                        {language === 'en' ? 'Need an account?' : '需要一個帳戶？'}{' '}
                        <a href="#" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            {language === 'en' ? 'Contact administrator' : '聯繫管理員'}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}