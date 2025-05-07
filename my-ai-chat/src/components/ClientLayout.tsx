'use client';

import { useEffect, useState } from 'react';
import { LanguageProvider } from '@/context/LanguageContext';
import Navbar from './Navbar';
import Aside from './Aside';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAsideOpen, setIsAsideOpen] = useState(false);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  if (!isInitialized) return null;

  return (
    <LanguageProvider>
      <div className="min-h-screen flex">
        <Aside>{children}</Aside>
        <div className="flex-1">
          <Navbar isAsideOpen={isAsideOpen} />
          <main>
            {children}
          </main>
        </div>
      </div>
    </LanguageProvider>
  );
}