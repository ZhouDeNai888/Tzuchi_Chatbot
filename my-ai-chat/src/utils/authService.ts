/**
 * Authentication services for handling tokens and user authentication
 */


/**
 * Set a cookie with the given name and value
 */
const setCookie = (name: string, value: string, expiryDays: number = 7) => {
  const date = new Date();
  date.setTime(date.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=Strict`;
};

/**
 * Get a cookie by name
 */
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null; // Server-side check
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
};

/**
 * Delete a cookie by name
 */
const deleteCookie = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

/**
 * Login user and save authentication tokens
 */
export const login = async (username: string, password: string): Promise<void> => {
  try {
    const response = await fetch(`/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
      credentials: 'include', // Important for handling cookies
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Save token to localStorage for JavaScript access
    localStorage.setItem('access_token', data.access_token);
    
    // Save expiration time
    if (data.expires_at) {
      localStorage.setItem('expires_at', data.expires_at.toString());
    }
    
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Get user profile information
 */
export const getUserInfo = async (): Promise<any> => {
  try {
    const response = await fetch(`/api/users/me`, {
      method: 'GET',
      credentials: 'include', // Important for handling cookies
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        const refreshed = await refreshToken();
        if (refreshed) {
          // Retry with new token
          return getUserInfo();
        } else {
          throw new Error('Session expired');
        }
      }
      throw new Error('Failed to get user profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Get user profile error:', error);
    throw error;
  }
};

/**
 * Refresh authentication token
 */
export const refreshToken = async (): Promise<boolean> => {
  try {
    const response = await fetch(`/api/token/refresh`, {
      method: 'POST',
      credentials: 'include', // Important for handling cookies
    });

    if (!response.ok) {
      // If refresh failed, clear tokens and return false
      logout();
      return false;
    }

    const data = await response.json();
    localStorage.setItem('access_token', data.access_token);
    
    // Update expiration time if provided
    if (data.expires_at) {
      localStorage.setItem('expires_at', data.expires_at.toString());
    }
    
    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    logout();
    return false;
  }
};

/**
 * Log out user by clearing authentication data
 */
export const logout = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('expires_at');
  deleteCookie('access_token');
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('access_token') || getCookie('access_token');
  console.log("isAuthenticated: " + !!token);
  const expiresAt = localStorage.getItem('expires_at');
  
  if (!token) {
    return false;
  }
  
  // Check if token is expired
  if (expiresAt) {
    const expirationTime = parseInt(expiresAt, 10);
    return expirationTime > Date.now() / 1000;
  }
  
  // If no expiration time is set, just check for token existence
  return !!token;
};