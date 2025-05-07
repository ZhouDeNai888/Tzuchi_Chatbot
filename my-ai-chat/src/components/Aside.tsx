"use client";

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faTimes } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import Navbar from './Navbar';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { translations } from '@/utils/translations';
import { checkUserPermission } from '@/utils/apiService';
import { useRouter, usePathname } from 'next/navigation';

interface MenuPermissions {
    knowledge: boolean;
    agents: boolean;
    history: boolean;
    share: boolean;
    accounts: boolean;
    departments: boolean;
}

const Aside: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { language } = useLanguage();
    const { user } = useAuth();
    const asideRef = React.useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const [permissions, setPermissions] = useState<MenuPermissions>({
        knowledge: false,
        agents: false,
        history: false,
        share: false,
        accounts: false,
        departments: false
    });
    const t = translations[language].nav;

    useEffect(() => {
        const loadPermissions = async () => {
            if (user) {
                const hasKnowledgeAccess = await checkUserPermission('view_knowledge');
                const hasAgentAccess = await checkUserPermission('use_agent');
                const hasHistoryAccess = await checkUserPermission('view_conversations');
                const hasShareAccess = await checkUserPermission('share_agent');
                const hasManageUsers = await checkUserPermission('manage_users');
                const hasDepartmentAdmin = await checkUserPermission('admin_department');
                const hasAllDepartments = await checkUserPermission('view_all_departments');
                const isFullAdmin = await checkUserPermission('full_admin');

                setPermissions({
                    knowledge: hasKnowledgeAccess || isFullAdmin,
                    agents: hasAgentAccess || isFullAdmin,
                    history: hasHistoryAccess || isFullAdmin,
                    share: hasShareAccess || isFullAdmin,
                    accounts: hasManageUsers || isFullAdmin,
                    departments: (hasDepartmentAdmin || hasAllDepartments || isFullAdmin)
                });
            }
        };

        loadPermissions();
    }, [user]);

    useEffect(() => {
        // Close aside when pathname changes
        setIsOpen(false);
    }, [pathname]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (asideRef.current && !asideRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="bg-white dark:bg-gray-900">
            <aside
                ref={asideRef}
                className={`fixed top-0 left-0 z-100 h-full bg-white dark:bg-gray-800 p-6 shadow-lg dark:shadow-gray-900 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64 z-50`}
            >
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute top-4 right-[-40px] bg-blue-600 dark:bg-gray-700 text-white px-2 py-1 rounded shadow-sm hover:bg-blue-700 dark:hover:bg-gray-600 transition-colors"
                >
                    <FontAwesomeIcon icon={isOpen ? faTimes : faBars} />
                </button>
                <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">{t.navigation}</h2>
                <ul className="space-y-2">
                    <li><Link href="/" className="flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.home}</Link></li>

                    {permissions.knowledge && (
                        <>
                            <li className='text-gray-500 dark:text-gray-400'>
                                <i className="fa-solid fa-database w-5 mr-3"></i>
                                <span>{t.knowledgeBase}</span>
                            </li>
                            <li><Link href="/knowledge" className="flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.knowledgeSetting}</Link></li>
                        </>
                    )}

                    {permissions.agents && (
                        <>
                            <li className='text-gray-500 dark:text-gray-400'>
                                <i className="fas fa-robot w-5 mr-3"></i>
                                <span>{t.agents}</span>
                            </li>
                            <li><Link href="/agent" className="flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><span>{t.agentSetting}</span></Link></li>
                        </>
                    )}

                    {permissions.history && (
                        <>
                            <li className='text-gray-500 dark:text-gray-400'>
                                <i className="fa-solid fa-clock-rotate-left w-5 mr-3"></i>
                                <span>{t.history}</span>
                            </li>
                            <li><Link href="/history" className="flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><span>{t.qaHistory}</span></Link></li>
                        </>
                    )}

                    {permissions.share && (
                        <>
                            <li className='text-gray-500 dark:text-gray-400'>
                                <i className="fa-solid fa-share-nodes w-5 mr-3"></i>
                                <span>{t.share}</span>
                            </li>
                            <li><Link href="/share" className="flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.shareSetting}</Link></li>
                        </>
                    )}

                    {(permissions.accounts || permissions.departments) && (
                        <li className='text-gray-500 dark:text-gray-400'>
                            <i className="fa-solid fa-user-gear w-5 mr-3"></i>
                            <span>{t.accounts}</span>
                        </li>
                    )}

                    {permissions.accounts && (
                        <li><Link href="/accounts" className="flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.accountSetting}</Link></li>
                    )}

                    {permissions.departments && (
                        <li><Link href="/departments" className="flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.departmentSetting}</Link></li>
                    )}
                </ul>
            </aside>
        </div>
    );
};

export default Aside;