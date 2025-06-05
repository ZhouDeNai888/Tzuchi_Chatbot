'use client';

import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import ClientLayout from './ClientLayout';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <LanguageProvider>
            <AuthProvider>
                <ClientLayout>
                    {children}
                </ClientLayout>
            </AuthProvider>
        </LanguageProvider>
    );
}