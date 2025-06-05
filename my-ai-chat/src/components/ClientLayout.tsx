'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Aside from './Aside';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAsideOpen, setIsAsideOpen] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  // Initialize component and set up cleanup
  useEffect(() => {
    console.log('ClientLayout mounted');
    setIsInitialized(true);

    // Set a timeout to force showing content even if auth check takes too long
    const timeoutId = setTimeout(() => {
      if (!initialLoadComplete) {
        console.log('Auth check timeout - forcing render');
        setInitialLoadComplete(true);
      }
    }, 3000); // 3 seconds timeout

    return () => {
      console.log('ClientLayout unmounted');
      clearTimeout(timeoutId);
      sessionStorage.removeItem('navigation_in_progress');
    };
  }, []);

  // Update initialLoadComplete when auth loading finishes
  useEffect(() => {
    if (!isLoading && isInitialized) {
      console.log('Auth loading complete, auth state:', isAuthenticated);
      setInitialLoadComplete(true);
    }
  }, [isLoading, isInitialized, isAuthenticated]);

  // Handle navigation based on auth state
  useEffect(() => {
    // Only run after initial loading and when not already navigating
    if (initialLoadComplete && isInitialized && !sessionStorage.getItem('navigation_in_progress')) {
      // Check if on protected page but not authenticated
      const protectedPaths = ['/accounts', '/agent', '/departments', '/history', '/knowledge', '/profile', '/share', '/'];
      const isProtectedPath = protectedPaths.some(path => pathname === path || pathname?.startsWith(path + '/'));

      if (!isAuthenticated && isProtectedPath) {
        console.log('Not authenticated but on protected page, redirecting to login...');

        // Store navigation state to prevent loops
        sessionStorage.setItem('navigation_in_progress', 'true');

        // Simple redirect with path preservation
        window.location.href = '/login?redirect=' + encodeURIComponent(pathname || '/');
      }
    }
  }, [initialLoadComplete, isAuthenticated, pathname, isInitialized]);

  // Show loading spinner only during initial load
  if (!initialLoadComplete) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
        <p className="ml-4 text-lg text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  // Special layout for login and other public pages
  if (!isAuthenticated) {
    return (
      <main className="">
        {children}
      </main>
    );
  }

  // Main layout for authenticated pages
  return (
    <div className="min-h-screen flex">
      <Aside>{children}</Aside>
      <div className="flex-1">
        <Navbar isAsideOpen={isAsideOpen} />
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}