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
  logout: (redirect?: boolean) => void;
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
    let isMounted = true;
    const checkAuthentication = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Set a timeout to prevent hanging authentication checks
        const timeoutId = setTimeout(() => {
          if (isMounted) {
            console.log("Authentication check timed out");
            setIsLoading(false);
            setIsAuthenticated(false);
          }
        }, 8000); // 8 seconds timeout

        // Check token validity first
        if (isAuthenticated()) {
          try {
            // Get user profile if authenticated
            const userData = await getUserInfo();

            if (isMounted) {
              console.log("✅ getUserInfo success", userData);
              setUser(userData);
              setIsAuthenticated(true);

              // Clear any cached permissions by requesting a fresh check
              // This ensures permissions are up-to-date after login
              if (userData && userData.user_id) {
                try {
                  // Make a dummy permission check to refresh the cache
                  await fetch(`/api/permissions/check/dummy?t=${Date.now()}`, {
                    headers: {
                      'Cache-Control': 'no-cache, no-store',
                      'Pragma': 'no-cache'
                    },
                    credentials: 'include',
                    cache: 'no-store'
                  });
                } catch (permErr) {
                  console.error("Permission refresh error:", permErr);
                  // Non-critical, so continue even if this fails
                }
              }

              console.log("Auth initialized with user:", userData?.Username);
            }
          } catch (error) {
            // Error handling for getUserInfo
            if (isMounted) {
              console.error("Failed to get user info:", error);
              handleLogout(false); // Don't redirect on initial load failure
            }
          }
        } else {
          // Clear everything if not authenticated
          if (isMounted) {
            setUser(null);
            setIsAuthenticated(false);
          }
        }

        // Clear timeout if auth check completes
        clearTimeout(timeoutId);
      } catch (error: any) {
        console.error("❌ getUserInfo FAILED:", error.message || error);
        console.error('Authentication check error:', error);

        if (isMounted) {
          setError('Authentication failed');
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuthentication();

    // Reset all state when component unmounts
    return () => {
      isMounted = false;
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
    };
  }, []);

  const handleLogin = async (username: string, password: string) => {
    console.log('handleLogin called with username:', username);
    try {
      setIsLoading(true);
      setError(null);

      // Clear any old state first
      setUser(null);
      setIsAuthenticated(false);

      // Login using the authService function
      const response = await authLogin(username, password);
      console.log("Login API response received:", response);

      if (!response || !response.success) {
        throw new Error('Login API returned unsuccessful response');
      }

      // Get user profile after successful login
      try {
        const userProfile = await getUserInfo();
        console.log("Fetched user profile:", userProfile?.Username);

        // Update state with new user info
        setUser(userProfile);
        setIsAuthenticated(true);

        console.log("Login successful, preparing navigation to home page");

        // Get redirect URL from search params if available
        let redirectUrl = '/';
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const redirectParam = urlParams.get('redirect');
          if (redirectParam) {
            redirectUrl = redirectParam;
          }
        } catch (error) {
          console.error('Error parsing redirect URL:', error);
        }

        // Add cache-busting parameter
        const separator = redirectUrl.includes('?') ? '&' : '?';
        redirectUrl = `${redirectUrl}${separator}t=${Date.now()}`;

        console.log("Redirecting to:", redirectUrl);

        // Use Next.js 15 compatible hard navigation
        setTimeout(() => {
          console.log("Executing navigation");
          // Save intended destination before navigation
          sessionStorage.setItem('post_login_redirect', redirectUrl);
          // Use direct location change for more reliable redirect in Next.js
          window.location.replace(redirectUrl);
        }, 300);

      } catch (profileError) {
        console.error("Error fetching user profile:", profileError);
        // Even if profile fetch fails, consider auth successful if we have token
        setIsAuthenticated(true);

        // Use same simple redirect strategy
        console.log("Login successful without profile, redirecting anyway");
        setTimeout(() => {
          window.location.replace('/?t=' + Date.now());
        }, 100);
      }

      return response; // Return the response for further handling
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

  const handleLogout = async (redirect = true) => {
    console.log("Logging out user:", user?.Username);
    setIsLoading(true);

    try {
      // Call the auth service logout function
      await authLogout();

      // Clear React state
      setUser(null);
      setIsAuthenticated(false);
      setError(null);

      // Navigate only after state has been cleared
      if (redirect) {
        console.log("Logout successful, redirecting to login page");
        setTimeout(() => {
          console.log("Executing navigation to login page");
          window.location.href = '/login';
        }, 100);
      }
    } catch (error) {
      console.error("Logout error:", error);

      // แม้จะมีข้อผิดพลาด ก็ยังควรล้างสถานะและ redirect
      setUser(null);
      setIsAuthenticated(false);

      if (redirect) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 100);
      }
    } finally {
      setIsLoading(false);
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
