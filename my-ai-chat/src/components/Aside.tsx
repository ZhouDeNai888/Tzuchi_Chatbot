"use client";

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faL, faTimes } from '@fortawesome/free-solid-svg-icons';
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
    models?: boolean; // Optional for model settings
    home: boolean; // Home is always accessible
}

// Define menu item interface
interface MenuItem {
    key: string;
    label: string;
    icon: string;
    href: string;
    permission: keyof MenuPermissions;
    iconColor: string;
    indent?: boolean;
    isHeader?: boolean;
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
        permissions: false,
        models: false, // Optional for model settings
        home: false, // Home is always accessible
    });
    const t = translations[language].nav;
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    useEffect(() => {
        const loadPermissions = async () => {
            if (user && !permissionsLoaded) {
                const isFullAdmin = await checkUserPermission('full_admin');
                const hasKnowledge = await checkUserPermission('knowledge_setting');
                const hasAgent = await checkUserPermission('agent_setting');
                const hasHistory = await checkUserPermission('history_setting');
                const hasShare = await checkUserPermission('share_setting');
                const hasUser = await checkUserPermission('account_setting');
                const hasDepartments = await checkUserPermission('departments_setting');
                const hasPermission = await checkUserPermission('permission_setting');
                const hasModel = await checkUserPermission('model_setting');
                const hasGeneral = await checkUserPermission('General_Permission');

                setPermissionsLoaded(true);
                setPermissions({
                    home: true, // Home is always accessible
                    knowledge: hasKnowledge || isFullAdmin || hasGeneral,
                    agents: hasAgent || isFullAdmin || hasGeneral,
                    history: hasHistory || isFullAdmin || hasGeneral,
                    share: hasShare || isFullAdmin || hasGeneral,
                    accounts: hasUser || isFullAdmin,
                    departments: (hasDepartments || isFullAdmin),
                    permissions: hasPermission || isFullAdmin,
                    models: hasModel || isFullAdmin
                });
            }
        };

        loadPermissions();
    }, [user, permissionsLoaded]);

    // Generate menu items based on permissions
    useEffect(() => {
        if (permissionsLoaded) {
            const baseMenuItems: MenuItem[] = [
                {
                    key: 'home',
                    label: t.home,
                    icon: 'fa-house',
                    href: '/',
                    permission: 'home', // Everyone can access home
                    iconColor: 'text-blue-500 dark:text-blue-400'
                }
            ];

            const permissionBasedItems: MenuItem[] = [
                {
                    key: 'knowledge',
                    label: t.knowledgeSetting,
                    icon: 'fa-database',
                    href: '/knowledge',
                    permission: 'knowledge',
                    iconColor: 'text-green-500 dark:text-green-400'
                },
                {
                    key: 'agents',
                    label: t.agentSetting,
                    icon: 'fa-robot',
                    href: '/agent',
                    permission: 'agents',
                    iconColor: 'text-purple-500 dark:text-purple-400'
                },
                {
                    key: 'history',
                    label: t.qaHistory,
                    icon: 'fa-clock-rotate-left',
                    href: '/history',
                    permission: 'history',
                    iconColor: 'text-amber-500 dark:text-amber-400'
                },
                {
                    key: 'share',
                    label: t.shareSetting,
                    icon: 'fa-share-nodes',
                    href: '/share',
                    permission: 'share',
                    iconColor: 'text-indigo-500 dark:text-indigo-400'
                },
                {
                    key: 'advanceSetting',
                    label: t.advanceSetting,
                    icon: 'fa-gears',
                    href: '',
                    permission: 'accounts', // Header is visible if any of the sub-items should be visible
                    iconColor: 'text-teal-500 dark:text-teal-400',
                    isHeader: true
                },
                {
                    key: 'accounts',
                    label: t.accountSetting,
                    icon: 'fa-users-gear',
                    href: '/accounts',
                    permission: 'accounts',
                    iconColor: 'text-cyan-500 dark:text-cyan-400',
                    indent: true
                },
                {
                    key: 'departments',
                    label: t.departmentSetting,
                    icon: 'fa-building',
                    href: '/departments',
                    permission: 'departments',
                    iconColor: 'text-rose-500 dark:text-rose-400',
                    indent: true
                },
                {
                    key: 'modelSetting',
                    label: t.modelSetting,
                    icon: 'fa-microchip',
                    href: '/model_setting',
                    permission: 'models',
                    iconColor: 'text-purple-500 dark:text-purple-400',
                    indent: true
                },
                {
                    key: 'permissions',
                    label: t.permissionSetting,
                    icon: 'fa-lock',
                    href: '/permission',
                    permission: 'permissions',
                    iconColor: 'text-red-500 dark:text-red-400',
                    indent: true
                }
            ];

            // Filter items based on permissions
            const filteredItems = permissionBasedItems.filter(item => {
                // Headers are shown if at least one of their children is visible
                if (item.isHeader && item.key === 'advanceSetting') {
                    return permissions.accounts || permissions.departments || permissions.permissions || permissions.models;
                }
                // Normal items are shown based on their own permission
                return permissions[item.permission];
            });

            setMenuItems([...baseMenuItems, ...filteredItems]);
        }
    }, [permissions, t, permissionsLoaded]);

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

    // Render a menu item
    const renderMenuItem = (item: MenuItem) => {
        // If it's a header without a link
        if (item.isHeader) {
            return (
                <li key={item.key} className='flex items-center p-2 rounded-lg'>
                    <i className={`fa-solid ${item.icon} w-5 mr-3 ${item.iconColor}`}></i>
                    <span className="text-gray-800 dark:text-gray-200 font-semibold">{item.label}</span>
                </li>
            );
        }

        // Regular menu item with link
        return (
            <li key={item.key} className={`flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 p-2 ${item.indent ? 'pl-8' : ''} rounded-lg transition-colors`}>
                <i className={`fa-solid ${item.icon} w-5 mr-3 ${item.iconColor}`}></i>
                <Link href={item.href} className="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">{item.label}</Link>
            </li>
        );
    };

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
                    {menuItems.map(item => renderMenuItem(item))}
                </ul>
            </aside>
        </div>
    );
};

export default Aside;