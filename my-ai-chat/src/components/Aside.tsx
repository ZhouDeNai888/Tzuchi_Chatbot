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
    permissions: boolean;
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
        departments: false,
        permissions: false
    });
    const t = translations[language].nav;
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);

    useEffect(() => {
        const loadPermissions = async () => {
            if (user && !permissionsLoaded) {
                const hasKnowledgeAccess = await checkUserPermission('view_knowledge');
                const hasAgentAccess = await checkUserPermission('use_agent');
                const hasHistoryAccess = await checkUserPermission('view_conversations');
                const hasShareAccess = await checkUserPermission('share_agent');
                const hasManageUsers = await checkUserPermission('manage_users');
                const hasDepartmentAdmin = await checkUserPermission('admin_department');
                const hasAllDepartments = await checkUserPermission('view_all_departments');
                const hasPermissionAdmin = await checkUserPermission('manage_permissions');
                const isFullAdmin = await checkUserPermission('full_admin');
                setPermissionsLoaded(true);
                setPermissions({
                    knowledge: hasKnowledgeAccess || isFullAdmin,
                    agents: hasAgentAccess || isFullAdmin,
                    history: hasHistoryAccess || isFullAdmin,
                    share: hasShareAccess || isFullAdmin,
                    accounts: hasManageUsers || isFullAdmin,
                    departments: (hasDepartmentAdmin || hasAllDepartments || isFullAdmin),
                    permissions: hasPermissionAdmin || isFullAdmin
                });
            }
        };

        loadPermissions();
    }, [user, permissionsLoaded]);

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
                    <li className='flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors'>
                        <i className="fa-solid fa-house w-5 mr-3 text-blue-500 dark:text-blue-400"></i>
                        <Link href="/" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{t.home}</Link>
                    </li>
                    {permissions.knowledge && (
                        <>
                            <li className='flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors'>
                                <i className="fa-solid fa-database w-5 mr-3 text-green-500 dark:text-green-400"></i>
                                <Link href="/knowledge" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{t.knowledgeSetting}</Link>
                                {/* <span>{t.knowledgeBase}</span> */}
                            </li>
                            {/* <li><Link href="/knowledge" className="flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.knowledgeSetting}</Link></li> */}
                        </>
                    )}

                    {permissions.agents && (
                        <>
                            <li className='flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors'>
                                <i className="fas fa-robot w-5 mr-3 text-purple-500 dark:text-purple-400"></i>
                                <Link href="/agent" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{t.agentSetting}</Link>
                                {/* <span>{t.agents}</span> */}
                            </li>
                            {/* <li><Link href="/agent" className="flex items-center px-8 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><span>{t.agentSetting}</span></Link></li> */}
                        </>
                    )}

                    {permissions.history && (
                        <>
                            <li className='flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors'>
                                <i className="fa-solid fa-clock-rotate-left w-5 mr-3 text-amber-500 dark:text-amber-400"></i>
                                <Link href="/history" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{t.qaHistory}</Link>
                            </li>
                        </>
                    )}

                    {permissions.share && (
                        <>
                            <li className='flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors'>
                                <i className="fa-solid fa-share-nodes w-5 mr-3 text-indigo-500 dark:text-indigo-400"></i>
                                <Link href="/share" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{t.shareSetting}</Link>
                            </li>
                        </>
                    )}

                    {(permissions.accounts || permissions.departments) && (
                        <li className='flex items-center p-2 rounded-lg'>
                            <i className="fa-solid fa-gears w-5 mr-3 text-teal-500 dark:text-teal-400"></i>
                            <span className="text-gray-800 dark:text-gray-200 font-semibold">{t.advanceSetting}</span>
                        </li>
                    )}

                    {permissions.accounts && (
                        <li className='flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 pl-8 rounded-lg transition-colors'>
                            <i className="fa-solid fa-users-gear w-5 mr-3 text-cyan-500 dark:text-cyan-400"></i>
                            <Link href="/accounts" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{t.accountSetting}</Link>
                        </li>
                    )}

                    {permissions.departments && (
                        <li className='flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 pl-8 rounded-lg transition-colors'>
                            <i className="fa-solid fa-building w-5 mr-3 text-rose-500 dark:text-rose-400"></i>
                            <Link href="/departments" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{t.departmentSetting}</Link>
                        </li>
                    )}

                    {permissions.accounts && (
                        <li className='flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 pl-8 rounded-lg transition-colors'>
                            <i className="fa-solid fa-microchip w-5 mr-3 text-purple-500 dark:text-purple-400"></i>
                            <Link href="/model_setting" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{t.modelSetting}</Link>
                        </li>
                    )}

                    {permissions.permissions && (
                        <li className='flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 pl-8 rounded-lg transition-colors'>
                            <i className="fa-solid fa-lock w-5 mr-3 text-red-500 dark:text-red-400"></i>
                            <Link href="/permission" className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{t.permissionSetting}</Link>
                        </li>
                    )}
                </ul>
            </aside>
        </div>
    );
};

export default Aside;