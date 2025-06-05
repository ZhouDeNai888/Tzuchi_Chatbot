'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoadingLocal, setIsLoadingLocal] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [renderTimeout, setRenderTimeout] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isLoading, login, isAuthenticated } = useAuth();
    const { language } = useLanguage();

    // Force render login form after timeout to prevent infinite loading
    useEffect(() => {
        console.log('Login Page Mounted');
        const timeoutId = setTimeout(() => {
            console.log('Login render timeout - forcing display');
            setRenderTimeout(true);
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, []);

    // Handle redirect after login
    useEffect(() => {
        // Debug authentication state
        console.log('Login page - Auth state:', { isAuthenticated, isLoading });

        // Check if user has just completed authentication (using session marker)
        const authSuccess = sessionStorage.getItem('auth_success');

        if (isAuthenticated && !isLoading) {
            console.log('Already authenticated, preparing redirect from login page');

            // Get the intended redirect destination
            let redirectPath = searchParams.get('redirect') || '/';

            // If we've already saved a post-login destination, use that
            const savedRedirect = sessionStorage.getItem('post_login_redirect');
            if (savedRedirect) {
                redirectPath = savedRedirect;
                // Clear it once used
                sessionStorage.removeItem('post_login_redirect');
            }

            console.log('Will redirect to:', redirectPath);
            setIsRedirecting(true);

            // Add a small delay to ensure cookie is properly set
            setTimeout(() => {
                try {
                    // Use a stronger approach: location.replace
                    const redirectUrl = `${redirectPath}${redirectPath.includes('?') ? '&' : '?'}t=${Date.now()}`;
                    console.log('Redirecting to:', redirectUrl);
                    window.location.replace(redirectUrl);
                } catch (e) {
                    console.error('Navigation error:', e);
                    // Fallback
                    window.location.href = '/';
                }
            }, 300);
        }

        // Clear the auth success flag after we've handled it
        if (authSuccess) {
            sessionStorage.removeItem('auth_success');
        }
    }, [isAuthenticated, isLoading, searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Login form submitted");

        if (!username.trim() || !password.trim()) {
            setError('Username and password are required');
            return;
        }

        setIsLoadingLocal(true);
        setError(null);

        try {
            console.log("Attempting login with username:", username);
            await login(username, password);
            console.log("Login function completed");

            // Show redirect loading screen - redirecting will happen in useEffect
            setIsRedirecting(true);

        } catch (err: any) {
            console.error("Login error:", err);
            setError(err.message || 'Login failed. Please try again.');
            setIsRedirecting(false);
        } finally {
            setIsLoadingLocal(false);
        }
    };

    // Show loading spinner when redirecting
    if (isRedirecting) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-800 z-50">
                <div className="mb-8">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={120}
                        height={120}
                        className="animate-pulse"
                    />
                </div>
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
                <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-200">
                    {language === 'en' ? 'Signing you in...' : '登入中...'}
                </p>
            </div>
        );
    }

    // Show loading spinner only during initial auth check (and before timeout)
    if (isLoading && !renderTimeout) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="mb-8">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={120}
                        height={120}
                        className="animate-pulse"
                    />
                </div>
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">Loading...</p>
            </div>
        );
    }

    // Otherwise, show login form
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl space-y-8 transform transition-all">
                <div className="flex flex-col items-center">
                    <div className="mb-6">
                        <Image
                            src="/logo.png"
                            alt="Logo"
                            width={150}
                            height={150}
                            className="mx-auto"
                        />
                    </div>
                    <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        AI Chat
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        {language === 'en' ? 'Sign in to your account' : '登入您的帳戶'}
                    </p>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg flex items-center">
                        <svg className="h-5 w-5 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="mb-4">
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {language === 'en' ? 'Username' : '使用者名稱'}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder={language === 'en' ? 'Enter your username' : '輸入使用者名稱'}
                                    disabled={isLoadingLocal}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {language === 'en' ? 'Password' : '密碼'}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder={language === 'en' ? 'Enter your password' : '輸入密碼'}
                                    disabled={isLoadingLocal}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember_me"
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                disabled={isLoadingLocal}
                            />
                            <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                {language === 'en' ? 'Remember me' : '記住我'}
                            </label>
                        </div>
                        <div className="text-sm">
                            <a href="#" className="font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors">
                                {language === 'en' ? 'Forgot password?' : '忘記密碼？'}
                            </a>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoadingLocal}
                        className={`group relative w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${isLoadingLocal ? 'opacity-70 cursor-not-allowed' : ''
                            }`}
                    >
                        <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                            <svg className={`h-5 w-5 text-blue-500 group-hover:text-blue-400 transition-colors ${isLoadingLocal ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </span>
                        {isLoadingLocal
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
                            <a href="#" className="font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors">
                                {language === 'en' ? 'Contact administrator' : '聯繫管理員'}
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}