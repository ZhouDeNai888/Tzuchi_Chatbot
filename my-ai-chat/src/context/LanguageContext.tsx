'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'zh-TW';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    // Try to get language from localStorage, then browser, then default to 'en'
    const savedLang = localStorage.getItem('language') as Language;
    const browserLang = navigator.language;
    const initialLang = savedLang || (browserLang.startsWith('zh') ? 'zh-TW' : 'en');
    setLanguage(initialLang);
    localStorage.setItem('language', initialLang);
  }, []);

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'zh-TW' : 'en';
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
    document.documentElement.lang = newLang;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
