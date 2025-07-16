"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/utils/translations";
import apiService from "@/utils/apiService"; // Import apiService

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderTimeout, setRenderTimeout] = useState(false);
  // New state variables for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalMessage, setModalMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  // New state variables for forgot password modal
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] =
    useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isForgotPasswordSubmitting, setIsForgotPasswordSubmitting] =
    useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoading, login, isAuthenticated } = useAuth();
  const { language } = useLanguage();

  // Force render login form after timeout to prevent infinite loading
  useEffect(() => {
    console.log("Login Page Mounted");
    const timeoutId = setTimeout(() => {
      console.log("Login render timeout - forcing display");
      setRenderTimeout(true);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, []);

  // Handle redirect after login
  useEffect(() => {
    // Debug authentication state
    console.log("Login page - Auth state:", { isAuthenticated, isLoading });

    // Check if user has just completed authentication (using session marker)
    const authSuccess = sessionStorage.getItem("auth_success");

    if (isAuthenticated && !isLoading) {
      console.log("Already authenticated, preparing redirect from login page");

      // Get the intended redirect destination
      let redirectPath = searchParams.get("redirect") || "/";

      // If we've already saved a post-login destination, use that
      const savedRedirect = sessionStorage.getItem("post_login_redirect");
      if (savedRedirect) {
        redirectPath = savedRedirect;
        // Clear it once used
        sessionStorage.removeItem("post_login_redirect");
      }

      console.log("Will redirect to:", redirectPath);
      setIsRedirecting(true);

      // Add a small delay to ensure cookie is properly set
      setTimeout(() => {
        try {
          // Use a stronger approach: location.replace
          const redirectUrl = `${redirectPath}${
            redirectPath.includes("?") ? "&" : "?"
          }t=${Date.now()}`;
          console.log("Redirecting to:", redirectUrl);
          window.location.replace(redirectUrl);
        } catch (e) {
          console.error("Navigation error:", e);
          // Fallback
          window.location.href = "/";
        }
      }, 300);
    }

    // Clear the auth success flag after we've handled it
    if (authSuccess) {
      sessionStorage.removeItem("auth_success");
    }
  }, [isAuthenticated, isLoading, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login form submitted");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
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
      setError(err.message || "Login failed. Please try again.");
      setIsRedirecting(false);
    } finally {
      setIsLoadingLocal(false);
    }
  };

  const handleContactAdminClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
    // Reset form and message when opening modal
    setEmail("");
    setFeedback("");
    setModalMessage(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!email.trim() || !feedback.trim()) {
      setModalMessage({
        type: "error",
        text:
          language === "en" ? "Please fill out all fields" : "請填寫所有欄位",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setModalMessage({
        type: "error",
        text:
          language === "en"
            ? "Please enter a valid email address"
            : "請輸入有效的電子郵件地址",
      });
      return;
    }

    setIsSubmitting(true);
    setModalMessage(null);

    try {
      // Use the contactAdmin API service instead of simulating
      await apiService.contactAdmin({
        email: email,
        content: feedback,
      });

      setModalMessage({
        type: "success",
        text:
          language === "en"
            ? "Your request has been submitted. An administrator will contact you soon."
            : "您的請求已提交。管理員將很快與您聯繫。",
      });

      // Optionally close the modal after success
      setTimeout(() => {
        setIsModalOpen(false);
      }, 3000);
    } catch (error) {
      setModalMessage({
        type: "error",
        text:
          language === "en"
            ? "Failed to submit your request. Please try again."
            : "提交請求失敗。請再試一次。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsForgotPasswordModalOpen(true);
    // Reset form and message when opening modal
    setForgotPasswordEmail("");
    setForgotPasswordMessage(null);
  };

  const handleForgotPasswordModalClose = () => {
    setIsForgotPasswordModalOpen(false);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordMessage({
        type: "error",
        text:
          language === "en"
            ? "Please enter your email address"
            : "請輸入您的電子郵件地址",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      setForgotPasswordMessage({
        type: "error",
        text:
          language === "en"
            ? "Please enter a valid email address"
            : "請輸入有效的電子郵件地址",
      });
      return;
    }

    setIsForgotPasswordSubmitting(true);
    setForgotPasswordMessage(null);

    try {
      // Use the forgotPassword API service instead of simulating
      await apiService.forgotPassword(forgotPasswordEmail);

      setForgotPasswordMessage({
        type: "success",
        text:
          language === "en"
            ? "Password reset instructions have been sent to your email address."
            : "密碼重置說明已發送到您的電子郵件地址。",
      });

      // Optionally close the modal after success
      setTimeout(() => {
        setIsForgotPasswordModalOpen(false);
      }, 3000);
    } catch (error) {
      setForgotPasswordMessage({
        type: "error",
        text:
          language === "en"
            ? "Failed to process your request. Please try again."
            : "處理您的請求失敗。請再試一次。",
      });
    } finally {
      setIsForgotPasswordSubmitting(false);
    }
  };

  // Show loading spinner when redirecting
  if (isRedirecting) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50">
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
        <p className="mt-4 text-lg font-medium text-gray-700">
          {language === "en" ? "Signing you in..." : "登入中..."}
        </p>
      </div>
    );
  }

  // Show loading spinner only during initial auth check (and before timeout)
  if (isLoading && !renderTimeout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
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
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  // Otherwise, show login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl space-y-8 transform transition-all border border-gray-200">
        <div className="flex flex-col items-center">
          <div className="mb-8 relative">
            <div className="absolute -z-10 w-32 h-32 bg-blue-50 rounded-full blur-xl opacity-70 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
            <Image
              src="/logo.png"
              alt="Logo"
              width={160}
              height={160}
              className="mx-auto drop-shadow-md"
            />
          </div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            AI Chat
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {language === "en" ? "Sign in to your account" : "登入您的帳戶"}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center">
            <svg
              className="h-5 w-5 mr-3 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {language === "en" ? "Username" : "使用者名稱"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all"
                  placeholder={
                    language === "en" ? "Enter your username" : "輸入使用者名稱"
                  }
                  disabled={isLoadingLocal}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {language === "en" ? "Password" : "密碼"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all"
                  placeholder={
                    language === "en" ? "Enter your password" : "輸入密碼"
                  }
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                disabled={isLoadingLocal}
              />
              <label
                htmlFor="remember_me"
                className="ml-2 block text-sm text-gray-700 cursor-pointer"
              >
                {language === "en" ? "Remember me" : "記住我"}
              </label>
            </div>
            <div className="text-sm">
              <a
                href="#"
                onClick={handleForgotPasswordClick}
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                {language === "en" ? "Forgot password?" : "忘記密碼？"}
              </a>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoadingLocal}
            className={`group relative w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
              isLoadingLocal ? "opacity-70 cursor-not-allowed" : ""
            } transform hover:translate-y-[-1px] active:translate-y-[1px] transition-transform`}
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg
                className={`h-5 w-5 text-blue-300 group-hover:text-blue-200 transition-colors ${
                  isLoadingLocal ? "animate-spin" : ""
                }`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </span>
            {isLoadingLocal
              ? language === "en"
                ? "Signing in..."
                : "登入中..."
              : language === "en"
              ? "Sign in"
              : "登入"}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">
                {language === "en" ? "Or" : "或"}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-center text-sm text-gray-600">
              {language === "en" ? "Need an account?" : "需要一個帳戶？"}{" "}
              <a
                href="#"
                onClick={handleContactAdminClick}
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                {language === "en" ? "Contact administrator" : "聯繫管理員"}
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Contact Administrator Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={handleModalClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {language === "en" ? "Contact Administrator" : "聯繫管理員"}
            </h2>

            <p className="text-gray-600 mb-6">
              {language === "en"
                ? "Fill out this form to request an account or assistance from an administrator."
                : "填寫此表格以向管理員請求帳戶或協助。"}
            </p>

            {modalMessage && (
              <div
                className={`p-4 mb-4 rounded-lg ${
                  modalMessage.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {modalMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {language === "en" ? "Email Address" : "電子郵件地址"}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all"
                  placeholder={
                    language === "en"
                      ? "your.email@example.com"
                      : "您的郵箱@example.com"
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label
                  htmlFor="feedback"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {language === "en" ? "Message" : "訊息"}
                </label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all"
                  placeholder={
                    language === "en"
                      ? "Describe why you need an account or any other assistance..."
                      : "描述您為什麼需要帳戶或任何其他協助..."
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                    isSubmitting ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {language === "en" ? "Submitting..." : "提交中..."}
                    </>
                  ) : language === "en" ? (
                    "Submit Request"
                  ) : (
                    "提交請求"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {isForgotPasswordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={handleForgotPasswordModalClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {language === "en" ? "Reset Password" : "重設密碼"}
            </h2>

            <p className="text-gray-600 mb-6">
              {language === "en"
                ? "Enter your email address and we will send you instructions to reset your password."
                : "輸入您的電子郵件地址，我們將向您發送重設密碼的說明。"}
            </p>

            {forgotPasswordMessage && (
              <div
                className={`p-4 mb-4 rounded-lg ${
                  forgotPasswordMessage.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {forgotPasswordMessage.text}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="forgotPasswordEmail"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {language === "en" ? "Email Address" : "電子郵件地址"}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                      />
                    </svg>
                  </div>
                  <input
                    id="forgotPasswordEmail"
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all"
                    placeholder={
                      language === "en"
                        ? "your.email@example.com"
                        : "您的郵箱@example.com"
                    }
                    disabled={isForgotPasswordSubmitting}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isForgotPasswordSubmitting}
                  className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                    isForgotPasswordSubmitting
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isForgotPasswordSubmitting ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {language === "en" ? "Sending..." : "發送中..."}
                    </>
                  ) : language === "en" ? (
                    "Send Reset Instructions"
                  ) : (
                    "發送重設說明"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
