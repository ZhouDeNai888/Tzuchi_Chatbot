'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { login as authLogin, getUserInfo, logout as authLogout, isAuthenticated } from '@/utils/authService';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  departments: { id: number; name: string }[];
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  error: null,
  isAuthenticated: false,
  login: async () => { },
  logout: () => { },
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUserAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    console.log("Authentication status changed: " + isUserAuthenticated);
    console.log("Current user:", user?.Username);
  }, [isUserAuthenticated, user]);

  // Reset all state when component mounts or unmounts
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check token validity first
        if (isAuthenticated()) {
          try {
            // Get user profile if authenticated
            const userData = await getUserInfo();
            setUser(userData);
            setIsAuthenticated(true);
            console.log("Auth initialized with user:", userData?.Username);
          } catch (error) {
            console.error('Failed to load user profile:', error);
            // Clear everything if profile load fails
            handleLogout(false); // Don't redirect on initial load failure
          }
        } else {
          // Clear everything if not authenticated
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Authentication check error:', error);
        setError('Authentication failed');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthentication();

    // Reset all state when component unmounts
    return () => {
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
    };
  }, []);

  const handleLogin = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Clear any old state first
      setUser(null);
      setIsAuthenticated(false);

      // Login using the authService function
      const response = await authLogin(username, password);
      console.log("Login successful:", response);

      // Get user profile after successful login
      const userProfile = await getUserInfo();
      console.log("Fetched user profile:", userProfile?.Username);

      // Update state with new user info
      setUser(userProfile);
      setIsAuthenticated(true);

      // Force a hard navigation with window.location instead of using router
      // This ensures the middleware picks up the authentication cookie
      // and all components are fully re-mounted
      window.location.href = '/';
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = (redirect = true) => {
    console.log("Logging out user:", user?.username);

    // Call the auth service logout function
    authLogout();

    // Clear React state
    setUser(null);
    setIsAuthenticated(false);
    setError(null);

    // Only redirect if requested (usually true except during initial load failure)
    if (redirect) {
      // Use window.location for a complete refresh to clear all component state
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isAuthenticated: isUserAuthenticated,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
