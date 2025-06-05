/**
 * Authentication services for handling tokens and user authentication
 */


/**
 * Set a cookie with the given name and value
 */
const setCookie = (name: string, value: string, expiryDays: number = 7) => {
  try {
    const date = new Date();
    date.setTime(date.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=Strict`;
    console.log(`Cookie ${name} set successfully`);
  } catch (e) {
    console.error('Error setting cookie:', e);
  }
};

/**
 * Get a cookie by name
 */
const getCookie = (name: string): string | null => {
  try {
    if (typeof document === 'undefined') return null; // Server-side check
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  } catch (e) {
    console.error('Error getting cookie:', e);
    return null;
  }
};

/**
 * Delete a cookie by name
 */
const deleteCookie = (name: string) => {
  try {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    console.log(`Cookie ${name} deleted`);
  } catch (e) {
    console.error('Error deleting cookie:', e);
  }
};

/**
 * Login user and save authentication tokens
 */
export const login = async (username: string, password: string): Promise<any> => {
  console.log('Login called with username:', username);
  try {
    // Force clear any existing tokens first
    localStorage.removeItem('access_token');
    localStorage.removeItem('expires_at');
    deleteCookie('access_token');

    const response = await fetch(`/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ username, password }),
      credentials: 'include', // Important for handling cookies
      cache: 'no-store', // Prevent caching
    });

    const data = await response.json();
    console.log('Login response data:', data);

    if (!response.ok) {
      console.error('Login error response:', response.status, data);
      throw new Error(data.error || 'Login failed');
    }

    // Save token to localStorage for JavaScript access
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      // Also set a client-side cookie as backup in case localStorage is cleared
      setCookie('access_token_js', data.access_token, 1); // 1 day expiry for backup
      console.log('Token stored in localStorage and cookie');

      // Force refresh permission checks by making a request with cache prevention
      try {
        // We don't need the result, just making the request to invalidate cache
        await fetch('/api/permissions/check/dummy?t=' + Date.now(), {
          headers: {
            'Authorization': `Bearer ${data.access_token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          cache: 'no-store'
        });
      } catch (e) {
        console.warn('Permission cache clear request failed:', e);
        // Non-critical, so continue even if this fails
      }
    } else {
      console.warn('No access token in response');
    }

    // Save expiration time
    if (data.expires_at) {
      localStorage.setItem('expires_at', data.expires_at.toString());
      console.log('Expiration time stored in localStorage');
    }

    // Set a flag to indicate successful login for redirection handling
    localStorage.setItem('login_timestamp', Date.now().toString());
    // Set a session flag to maintain login state across page reloads
    sessionStorage.setItem('auth_success', 'true');

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
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
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
          console.error('Session expired and refresh failed');
          throw new Error('Session expired');
        }
      }
      console.error('getUserInfo error:', response.status);
      throw new Error('Failed to get user profile');
    }

    // Parse the response and add a timestamp to help debug cache issues
    const data = await response.json();
    data._fetchTime = new Date().toISOString();
    return data;
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
      localStorage.removeItem('access_token');
      localStorage.removeItem('expires_at');
      return false;
    }

    const data = await response.json();

    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }

    // Update expiration time if provided
    if (data.expires_at) {
      localStorage.setItem('expires_at', data.expires_at.toString());
    }

    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    localStorage.removeItem('access_token');
    localStorage.removeItem('expires_at');
    return false;
  }
};

/**
 * Log out user by clearing authentication data
 */
export const logout = async (): Promise<void> => {
  try {
    // First remove local storage items to prevent any redirect loops
    localStorage.removeItem('access_token');
    localStorage.removeItem('expires_at');

    // Clear all cookies related to authentication
    deleteCookie('access_token');

    // Then make the logout API call
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(err => {
      console.error('Logout API error:', err);
      // Even if API fails, we've already cleared local storage
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still remove items even if there's an error
    localStorage.removeItem('access_token');
    localStorage.removeItem('expires_at');
    deleteCookie('access_token');
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  try {
    // Check both localStorage and cookies for the token
    const token = localStorage.getItem('access_token') || getCookie('access_token');
    const expiresAt = localStorage.getItem('expires_at');

    if (!token) {
      return false;
    }

    // Check if token is expired
    if (expiresAt) {
      const expirationTime = parseInt(expiresAt, 10);
      if (expirationTime < Date.now() / 1000) {
        // Token is expired, clear authentication data
        localStorage.removeItem('access_token');
        localStorage.removeItem('expires_at');
        deleteCookie('access_token');
        return false;
      }
      return true;
    }

    // If no expiration time is set, just check for token existence
    return !!token;
  } catch (error) {
    console.error('isAuthenticated error:', error);
    return false;
  }
};