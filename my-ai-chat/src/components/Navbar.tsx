"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Aside from "@/components/Aside";
import { useAuth } from "@/context/AuthContext";
import { translations, getTranslation } from "@/utils/translations";
import { useLanguage } from "@/context/LanguageContext";

interface NavbarProps {
  isAsideOpen: boolean;
}

export default function Navbar({ isAsideOpen }: NavbarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const { language, toggleLanguage } = useLanguage();
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const profileRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const getBreadcrumbs = (path: string) => {
    const segments = path.split("/").filter(Boolean);
    return segments.map((segment, index) => {
      const url = `/${segments.slice(0, index + 1).join("/")}`;
      const translationKey = segment.toLowerCase();
      return {
        name:
          translations[language].breadcrumbs[
            translationKey as keyof (typeof translations)[typeof language]["breadcrumbs"]
          ] || segment,
        url,
      };
    });
  };

  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav
      className={`fixed top-0 right-0 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-gray-800 z-40 transition-all duration-300 shadow-sm ${
        isAsideOpen ? "lg:left-64" : "left-0"
      }`}
    >
      <div className="px-2 sm:px-4">
        <div className="flex items-center justify-between h-14">
          {/* Left side - Mobile menu button + Breadcrumbs */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
            >
              <i
                className={`fas ${
                  isMobileMenuOpen ? "fa-times" : "fa-bars"
                } text-lg`}
              ></i>
            </button>

            {/* Breadcrumbs - hidden on mobile, visible on tablet+ */}
            <div className="hidden sm:flex text-gray-500 dark:text-gray-400 text-sm items-center gap-2 lg:ml-10">
              <Link
                href="/"
                className="font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white"
              >
                {translations[language].breadcrumbs.home}
              </Link>
              {getBreadcrumbs(pathname).map((segment, index) => (
                <div key={segment.url} className="flex items-center gap-2">
                  <span className="text-gray-300 dark:text-gray-600">&gt;</span>
                  <Link
                    href={segment.url}
                    className="font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white truncate max-w-32"
                  >
                    {segment.name}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Center - Logo and System Name - responsive sizing */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="TzuChi Logo"
                className="h-6 w-6 sm:h-8 sm:w-8"
              />
              <span className="text-sm sm:text-lg font-semibold text-gray-700 dark:text-gray-200 hidden sm:block">
                TzuChi AI System
              </span>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 sm:hidden">
                TzuChi
              </span>
            </div>
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative" ref={profileRef}>
              <button
                onClick={toggleProfile}
                className="flex items-center space-x-1 sm:space-x-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center shadow-sm">
                  <i className="fas fa-user text-gray-500 dark:text-gray-300 text-sm"></i>
                </div>
                <span className="text-xs sm:text-sm font-medium mr-1 sm:mr-2 hidden sm:block">
                  {user?.Username}
                </span>
                <i
                  className={`fas fa-chevron-down text-xs transition-transform duration-200 ${
                    isProfileOpen ? "rotate-180" : ""
                  }`}
                ></i>
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-1 w-48 sm:w-56 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                  <Link
                    href="/profile"
                    className="flex items-center px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 hover:text-blue-600 dark:hover:bg-gray-700"
                  >
                    <i className="fas fa-user-circle w-5"></i>
                    <span>{getTranslation(language, "nav.profile")}</span>
                  </Link>

                  {/* <Link
                    href="/settings"
                    className="flex items-center px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 hover:text-blue-600 dark:hover:bg-gray-700"
                  >
                    <i className="fas fa-cog w-5"></i>
                    <span>{getTranslation(language, "nav.settings")}</span>
                  </Link> */}
                  {/* Theme Toggle Switch */}
                  <div className="flex items-center mr-4 px-4 py-2 text-sm text-gray-600">
                    <div className="relative inline-flex items-center">
                      <i className="fas fa-moon text-gray-500 dark:text-gray-400 mr-2"></i>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={theme === "light"}
                          onChange={toggleTheme}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                      <i className="fas fa-sun text-gray-500 dark:text-gray-400 ml-2"></i>
                    </div>
                  </div>

                  {/* Language Selector */}
                  <div className="flex items-center px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                    <select
                      value={language}
                      onChange={(e) => toggleLanguage()}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="en">
                        English {language === "en" && "✓"}
                      </option>
                      <option value="zh-TW">
                        中文 {language === "zh-TW" && "✓"}
                      </option>
                    </select>
                  </div>

                  <hr className="border-gray-100 dark:border-gray-700 my-1" />

                  <button
                    onClick={() => logout()}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 hover:text-blue-600 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <i className="fas fa-sign-out-alt w-5"></i>
                    <span>{getTranslation(language, "nav.signOut")}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="lg:hidden fixed inset-0 top-14 bg-white dark:bg-slate-900 z-50 border-t border-gray-100 dark:border-gray-800"
        >
          <div className="p-4 space-y-4">
            {/* Mobile breadcrumbs */}
            <div className="pb-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Navigation
              </h3>
              <div className="space-y-2">
                <Link
                  href="/"
                  className="block text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {translations[language].breadcrumbs.home}
                </Link>
                {getBreadcrumbs(pathname).map((segment, index) => (
                  <Link
                    key={segment.url}
                    href={segment.url}
                    className="block text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white py-2 pl-4"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {segment.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Mobile user info */}
            <div className="pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                  <i className="fas fa-user text-gray-500 dark:text-gray-300"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.Username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Signed in
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile menu items */}
            <div className="space-y-2">
              <Link
                href="/profile"
                className="flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white py-3"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-user-circle w-5"></i>
                <span>{getTranslation(language, "nav.profile")}</span>
              </Link>

              <Link
                href="/settings"
                className="flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white py-3"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-cog w-5"></i>
                <span>{getTranslation(language, "nav.settings")}</span>
              </Link>

              {/* Mobile Theme Toggle */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <i className="fas fa-moon text-gray-500 dark:text-gray-400 w-5"></i>
                  <span className="text-gray-600 dark:text-gray-300">
                    Theme
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme === "light"}
                    onChange={toggleTheme}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Mobile Language Selector */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <i className="fas fa-globe text-gray-500 dark:text-gray-400 w-5"></i>
                  <span className="text-gray-600 dark:text-gray-300">
                    Language
                  </span>
                </div>
                <select
                  value={language}
                  onChange={(e) => toggleLanguage()}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-1 text-sm cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">English {language === "en" && "✓"}</option>
                  <option value="zh-TW">
                    中文 {language === "zh-TW" && "✓"}
                  </option>
                </select>
              </div>

              {/* Mobile Logout */}
              <button
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white py-3 w-full"
              >
                <i className="fas fa-sign-out-alt w-5"></i>
                <span>{getTranslation(language, "nav.signOut")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
