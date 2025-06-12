// src/utils/apiService.ts

/**
 * Type definitions for chat API
 */
export interface ChatMessage {
  content: string;
  role: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  department_id?: number;
  conversation_id?: number;
  stream?: boolean;
  agent_key?: string;
}

/**
 * Interface for User data
 */
export interface User {
  UserID: number | string;
  id?: number | string;  // Adding id field to match usage
  Username: string;
  Email: string;
  FirstName?: string;
  LastName?: string;
  UserRole: string;
  departments?: Array<{ id: number, name: string }>;
  permissions?: string[];
  IsActive?: boolean;
}

/**
 * Interface for User creation request
 */
export interface UserCreateRequest {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  department_ids?: number[];
  user_role?: string;
  permissions?: string[];
}

/**
 * Interface for User update request
 */
export interface UserUpdateRequest {
  username?: string;
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  department_ids?: number[];
  user_role?: string;
  permissions?: string[];
  is_active?: boolean;
}

/**
 * Interface for Department data
 */
export interface Department {
  id?: number;
  department_id?: number;  // Adding this to match API response
  name: string;
  description?: string;
  user_count?: number;
  created_at?: string;
  last_updated_at?: string;
}

/**
 * Interface for Agent data
 */
export interface Agent {
  id: number;
  agent_key: string;
  name: string;
  description?: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  knowledge_base_ids: number[] | number | null;
  is_active: boolean;
  department_id?: number;
  department_name?: string;
  is_global: boolean;
  created_at?: string;
  last_updated_at?: string;
  nftext?: string;  // Optional field for NFT text
}

/**
 * Interface for Knowledge Base data
 */
export interface KnowledgeBase {
  id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  owner_id?: number;
  owner_name?: string;
  department_id?: number;
  department_name?: string;
  document_count: number;  // Added required field
  is_public: boolean;
  is_global: boolean;
}

/**
 * Interface for Knowledge Data Item
 */
export interface KnowledgeDataItem {
  id: string;
  knowledge_base_id: number;
  type: 'file' | 'link';
  file_name?: string;
  file_size?: number;
  url?: string;
  status: 'processing' | 'finished';
  created_at: string;
}

/**
 * Interface for Document data
 */
export interface Document {
  document_id: number;
  knowledge_base_id: number;
  title: string;
  content?: string;
  file_url?: string;
  file_type?: string;
  file_size?: number;
  is_processed: boolean;
  created_at?: string;
  last_updated_at?: string;
}

/**
 * Interface for Document create request
 */
export interface DocumentCreateRequest {
  knowledge_base_id: number;
  title?: string;
  content?: string;
  file_url?: string;
  file_type?: string;
}

/**
 * Interface for SharedAgent data
 */
export interface SharedAgentData {
  name: string;
  description: string;
  allowedOrigins: string;
  usageLimit: number | null;
  expiryDays: number | null;
}

export interface SharedAgent {
  id: string;
  apiKey: string;
  agentId: number;
  name: string;
  description: string;
  allowedOrigins: string[];
  usageLimit: number | null;
  usageCount: number;
  createdAt: string;
  expiresAt: string | null;
  agentDetails?: Agent | null;
}

/**
 * Interface for Permission data
 */
export interface Permission {
  permission_id: number;
  permission_name: string;
  description?: string;
}

/**
 * Interface for Permission request
 */
export interface PermissionRequest {
  permission_name: string;
  user_id?: number;
}

/**
 * Interface for Permission response from the check endpoint
 */
export interface PermissionCheckResponse {
  has_permission: boolean;
}

/**
 * Interface for Message feedback
 */
export interface MessageFeedback {
  feedback: string;
}

/**
 * Interface for Message History
 */
export interface MessageHistory {
  MessageID: number;
  Content: string;
  Response: string;
  Timestamp: string;
  FeedbackComment?: string;
  Rating?: number;
  ConversationID?: number;
  AgentName?: string;
}

/**
 * Utility function to handle API calls with authentication
 */
const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // Get the token from localStorage
  const token = localStorage.getItem('access_token');

  // Set Authorization header if token exists
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache'
    };
  } else {
    options.headers = {
      ...options.headers,
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache'
    };
  }

  // Make the API call
  const response = await fetch(url, options);

  // If unauthorized (401), attempt to refresh token
  if (response.status === 401) {
    // Try to refresh the token
    const refreshSuccess = await handleTokenRefresh();

    if (refreshSuccess) {
      // Get the new token
      const newToken = localStorage.getItem('access_token');

      // Update Authorization header with new token
      if (newToken) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        };

        // Retry the original request with new token
        return fetch(url, options);
      }
    }
  }

  return response;
};

/**
 * Handle token refresh internally to avoid circular dependency
 */
const handleTokenRefresh = async (): Promise<boolean> => {
  try {
    const token = localStorage.getItem('access_token');

    if (!token) {
      return false;
    }

    const response = await fetch(`/api/token/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If refresh failed, clear tokens and return false
      clearAuthTokens();
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
    clearAuthTokens();
    return false;
  }
};

/**
 * Clear authentication tokens (used internally)
 */
const clearAuthTokens = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('expires_at');
};


/**
 * Get user profile - this is now redundant but kept for API compatibility
 * Applications should use authService.getUserInfo() instead
 */
export const getUserProfile = async (): Promise<any> => {
  try {
    const response = await fetchWithAuth(`/api/users/me`);

    if (!response.ok) {
      throw new Error('Failed to get user profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Get user profile error:', error);
    throw error;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userData: {
  first_name?: string;
  last_name?: string;
  email?: string;
  bio?: string;
}): Promise<any> => {
  try {
    const response = await fetchWithAuth(`/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
};

/**
 * Upload avatar image
 */
export const uploadAvatar = async (formData: FormData): Promise<{ avatar_url: string }> => {
  try {
    const response = await fetchWithAuth(`/api/users/avatar`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to upload avatar');
    }

    return await response.json();
  } catch (error) {
    console.error('Upload avatar error:', error);
    throw error;
  }
};

/**
 * Submit feedback for a chat message
 */
export const submitMessageFeedback = async (messageId: number, feedback: string): Promise<boolean> => {
  console.log('Submitting feedback for message ID:', messageId, 'Feedback:', feedback);
  try {
    const response = await fetchWithAuth(`/api/messages/${messageId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ feedback })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to submit feedback');
    }

    return true;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return false;
  }
};

/**
 * Submit a rating (1-5) for a chat message
 */
export const addMessageRating = async (messageId: number, rating: number): Promise<boolean> => {
  try {
    console.log('Submitting rating for message ID:', messageId, 'Rating:', rating);
    const response = await fetchWithAuth(`/api/messages/${messageId}/rating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rating)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to submit rating');
    }

    return true;
  } catch (error) {
    console.error('Error submitting rating:', error);
    return false;
  }
};

/**
 * Get all message history
 */
export const getAllMessages = async (
  startDate?: string,
  endDate?: string,
  limit: number = 1000
): Promise<MessageHistory[]> => {
  let url = `/api/messages?limit=${limit}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;

  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error('Failed to fetch message history');
  }

  const data = await response.json();
  console.log('All messages:', data); // Debugging line to check all messages
  return data.messages;
};

/**
 * Get department messages
 */
export const getDepartmentMessages = async (
  departmentIds?: number[],
  startDate?: string,
  endDate?: string,
  dept?: Department
): Promise<MessageHistory[]> => {
  let url = `/api/messages/department`;
  if (departmentIds) {
    const params = new URLSearchParams();
    departmentIds.forEach(id => params.append("department_ids", id.toString()));
    url += `?${params.toString()}`;
  }
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;


  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error('Failed to fetch department messages');
  }

  const data = await response.json();
  console.log('Department messages:', data); // Debugging line to check department messages
  return data.messages;
};

/**
 * Get all users
 */
export const getUsers = async (): Promise<User[]> => {
  try {
    const response = await fetch('/api/users', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get users');
    }

    const data = await response.json();

    // Transform backend format to frontend format if needed
    return (data.users || []).map((user: any) => ({
      id: user.UserID || user.user_id,
      Username: user.Username || user.username,  // Using consistent Username casing
      Email: user.Email || user.email,
      FirstName: user.FirstName || user.first_name,
      LastName: user.LastName || user.last_name,
      UserRole: user.UserRole || user.user_role,
      departments: user.departments || [],
      permissions: user.permissions || [],
      IsActive: user.IsActive || user.is_active
    }));
  } catch (error) {
    console.error('Get users error:', error);
    return [];
  }
};

/**
 * Get all users with detailed information
 */
export const getAllUserDetails = async (): Promise<User[]> => {
  try {
    const response = await fetchWithAuth(`/api/users/all`);

    if (!response.ok) {
      throw new Error('Failed to get all user details');
    }

    const data = await response.json();

    // Transform backend format to frontend format if needed
    return (data.users || []).map((user: any) => ({
      UserID: user.UserID || user.user_id,
      Username: user.Username || user.username,
      Email: user.Email || user.email,
      FirstName: user.FirstName || user.first_name,
      LastName: user.LastName || user.last_name,
      UserRole: user.UserRole || user.user_role,
      departments: user.departments || [],
      permissions: user.permissions || [],
      IsActive: user.IsActive || user.is_active
    }));
  } catch (error) {
    console.error('Get all user details error:', error);
    return [];
  }
};

/**
 * Get a specific user by ID
 */
export const getUser = async (userId: number | string): Promise<User | null> => {
  try {
    const response = await fetchWithAuth(`/api/users/${userId}`);

    if (!response.ok) {
      throw new Error('Failed to get user');
    }

    const userData = await response.json();

    // Transform backend format to frontend format
    return {
      UserID: userData.UserID || userData.user_id,
      Username: userData.Username || userData.username,  // Using Username to match interface
      Email: userData.Email || userData.email,
      FirstName: userData.FirstName || userData.first_name,
      LastName: userData.LastName || userData.last_name,
      UserRole: userData.UserRole || userData.user_role,
      departments: userData.departments || [],
      permissions: userData.permissions || [],
      IsActive: userData.IsActive || userData.is_active
    };
  } catch (error) {
    console.error(`Get user error for ID ${userId}:`, error);
    return null;
  }
};

/**
 * Create a new user
 */
export const createUser = async (userData: UserCreateRequest): Promise<{ user_id: number; message: string }> => {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create user');
    }

    return await response.json();
  } catch (error) {
    console.error('Create user error:', error);
    throw error;
  }
};

/**
 * Update an existing user
 */
export const updateUser = async (userId: number | string, userData: UserUpdateRequest): Promise<User> => {
  try {
    const response = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update user');
    }

    return await response.json();
  } catch (error) {
    console.error(`Update user error for ID ${userId}:`, error);
    throw error;
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (userId: number | string): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete user');
    }

    return true;
  } catch (error) {
    console.error(`Delete user error for ID ${userId}:`, error);
    throw error;
  }
};

/**
 * Set a user's role
 */
export const setUserRole = async (userId: number | string, role: 'admin' | 'user'): Promise<User> => {
  try {
    const response = await fetchWithAuth(`/api/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update user role');
    }

    return await response.json();
  } catch (error) {
    console.error(`Set user role error for ID ${userId}:`, error);
    throw error;
  }
};

/**
 * Get all departments
 */
export const getDepartments = async (): Promise<Department[]> => {
  try {
    const response = await fetchWithAuth(`/api/departments`);

    if (!response.ok) {
      throw new Error(`Failed to fetch departments: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching departments:', error);
    return [];
  }
};

/**
 * Get a specific department by ID
 */
export const getDepartment = async (departmentId: number | string): Promise<Department | null> => {
  try {
    const response = await fetchWithAuth(`/api/departments/${departmentId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch department: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching department ${departmentId}:`, error);
    return null;
  }
};

/**
 * Get users in a department
 */
export const getDepartmentUsers = async (departmentId: number | string): Promise<User[]> => {
  try {
    const response = await fetchWithAuth(`/api/departments/${departmentId}/users`);

    if (!response.ok) {
      throw new Error(`Failed to fetch department users: ${response.status}`);
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error(`Error fetching users for department ${departmentId}:`, error);
    return [];
  }
};

/**
 * Add a user to a department
 */
export const addUserToDepartment = async (departmentId: number | string, userId: number | string): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/api/departments/${departmentId}/users/${userId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to add user to department');
    }

    return true;
  } catch (error) {
    console.error(`Error adding user ${userId} to department ${departmentId}:`, error);
    return false;
  }
};

/**
 * Remove a user from a department
 */
export const removeUserFromDepartment = async (departmentId: number | string, userId: number | string): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/api/departments/${departmentId}/users?user_id=${userId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to remove user from department');
    }

    return true;
  } catch (error) {
    console.error(`Error removing user ${userId} from department ${departmentId}:`, error);
    return false;
  }
};

/**
 * Create a new department
 */
export const createDepartment = async (departmentData: { name: string; description?: string }): Promise<Department | null> => {
  try {
    const response = await fetchWithAuth(`/api/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(departmentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create department');
    }

    return await response.json();
  } catch (error) {
    console.error('Create department error:', error);
    return null;
  }
};

/**
 * Update an existing department
 */
export const updateDepartment = async (departmentId: number | string, departmentData: { name?: string; description?: string }): Promise<Department | null> => {
  try {
    const response = await fetchWithAuth(`/api/departments/${departmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(departmentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update department');
    }

    return await response.json();
  } catch (error) {
    console.error(`Update department error for ID ${departmentId}:`, error);
    return null;
  }
};

/**
 * Delete a department
 */
export const deleteDepartment = async (departmentId: number | string): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/api/departments/${departmentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete department');
    }

    return true;
  } catch (error) {
    console.error(`Delete department error for ID ${departmentId}:`, error);
    return false;
  }
};

// All other API services - these use fetchWithAuth to handle authentication

export const getAgents = async (): Promise<Agent[]> => {
  try {
    console.log('Fetching agents...');
    // Get current user profile to check role
    const userProfile = await getUserProfile();
    console.log('User Profile:', userProfile);
    let url = `/api/agents`;

    // If user is not admin, add department IDs to query params
    if (userProfile?.UserRole !== 'admin') {
      // console.log('User is a regular user, filtering agents by department...');
      // console.log('User Departments:', userProfile);
      const departmentIds = userProfile.departments.map((dept: { id?: number; DepartmentID?: number }) =>
        dept.id || dept.DepartmentID
      ).join(',');
      if (departmentIds.length > 1) {
        url += `?department_ids=${departmentIds}`;
      } else {
        url += `?department_id=${userProfile.departments[0].DepartmentID}`;
      }

      console.log(`Fetching agents for department IDs: ${departmentIds}`);
    }
    else {
      console.log('User is an admin, fetching all agents...');
    }

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      throw new Error('Failed to get agents');
    }

    const data = await response.json();

    // If no agents are found, return a special array with a noAgentsFound flag
    if (!data || data.length === 0) {
      const emptyResult: Agent[] = [];
      (emptyResult as any).noAgentsFound = true;
      return emptyResult;
    }

    // Transform from backend format to frontend format
    return data.map((agent: any) => ({
      id: agent.agent_id,
      agent_key: agent.agent_key,
      name: agent.name,
      description: agent.description,
      model: agent.configuration ? JSON.parse(agent.configuration).model || "gpt-4o-mini" : "gpt-4o-mini",
      temperature: agent.configuration ? JSON.parse(agent.configuration).temperature || 0.7 : 0.7,
      max_tokens: agent.configuration ? JSON.parse(agent.configuration).max_tokens || 2000 : 2000,
      system_prompt: agent.configuration ? JSON.parse(agent.configuration).system_prompt || "" : "",
      knowledge_base_ids: agent.configuration ? JSON.parse(agent.configuration).knowledge_base_ids || null : null,
      is_active: agent.is_active,
      department_id: agent.department_id,
      department_name: agent.department_name,
      is_global: agent.is_global,
      created_at: agent.created_at,
      last_updated_at: agent.last_updated_at,
      nftext: agent.configuration ? JSON.parse(agent.configuration).nftext || '' : ''
    }));
  } catch (error) {
    console.error('Get agents error:', error);
    // Return an empty array with the noAgentsFound flag set to true
    const emptyResult: Agent[] = [];
    (emptyResult as any).noAgentsFound = true;
    return emptyResult;
  }
};

/**
 * Get a specific agent by ID
 */
export const getAgent = async (agentId: number): Promise<Agent | null> => {
  try {
    const response = await fetchWithAuth(`/api/agents/${agentId}`);

    if (!response.ok) {
      throw new Error('Failed to get agent');
    }

    const agent = await response.json();

    // Transform from backend format to frontend format
    return {
      id: agent.agent_id,
      agent_key: agent.agent_key,
      name: agent.name,
      description: agent.description,
      model: agent.configuration ? JSON.parse(agent.configuration).model || "gpt-4o-mini" : "gpt-4o-mini",
      temperature: agent.configuration ? JSON.parse(agent.configuration).temperature || 0.7 : 0.7,
      max_tokens: agent.configuration ? JSON.parse(agent.configuration).max_tokens || 2000 : 2000,
      system_prompt: agent.configuration ? JSON.parse(agent.configuration).system_prompt || "" : "",
      knowledge_base_ids: agent.configuration ? JSON.parse(agent.configuration).knowledge_base_ids || null : null,
      is_active: agent.is_active,
      department_id: agent.department_id,
      department_name: agent.department_name,
      is_global: agent.is_global,
      created_at: agent.created_at,
      last_updated_at: agent.last_updated_at,
      nftext: agent.configuration ? JSON.parse(agent.configuration).nftext || '' : ''
    };
  } catch (error) {
    console.error(`Get agent error for ID ${agentId}:`, error);
    return null;
  }
};

/**
 * Create a new agent
 */
export const createAgent = async (agentData: Partial<Agent>): Promise<Agent> => {
  try {
    const backendData = {
      name: agentData.name,
      agent_key: agentData.agent_key || generateAgentKey(agentData.name || ''),
      description: agentData.description || '',
      configuration: JSON.stringify({
        model: agentData.model || 'gpt-4o-mini',
        temperature: agentData.temperature || 0.7,
        max_tokens: agentData.max_tokens || 2000,
        system_prompt: agentData.system_prompt || '',
        knowledge_base_ids: agentData.knowledge_base_ids || null,
        nftext: agentData.nftext || '',
        description: agentData.description || '' // Added description to configuration as well
      }),
      is_active: agentData.is_active !== undefined ? agentData.is_active : true,
      department_id: agentData.department_id || null,
      is_global: agentData.is_global || false
    };

    const response = await fetchWithAuth(`/api/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create agent');
    }

    return await response.json();
  } catch (error) {
    console.error('Create agent error:', error);
    throw error;
  }
};

/**
 * Update an existing agent
 */
export const updateAgent = async (agentId: number, agentData: Partial<Agent>): Promise<Agent> => {
  try {
    const backendData = {
      name: agentData.name,
      agent_key: agentData.agent_key || generateAgentKey(agentData.name || ''),
      description: agentData.description || '',
      configuration: JSON.stringify({
        model: agentData.model || 'gpt-4o-mini',
        temperature: agentData.temperature || 0.7,
        max_tokens: agentData.max_tokens || 2000,
        system_prompt: agentData.system_prompt || '',
        knowledge_base_ids: agentData.knowledge_base_ids || null,
        nftext: agentData.nftext || '',
        description: agentData.description || '' // Added description to configuration as well
      }),
      is_active: agentData.is_active !== undefined ? agentData.is_active : true,
      department_id: agentData.department_id || null,
      is_global: agentData.is_global || false
    };

    const response = await fetchWithAuth(`/api/agents/${agentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update agent');
    }

    return await response.json();
  } catch (error) {
    console.error(`Update agent error for ID ${agentId}:`, error);
    throw error;
  }
};

/**
 * Delete an agent
 */
export const deleteAgent = async (agentId: number): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/api/agents/${agentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete agent');
    }

    return true;
  } catch (error) {
    console.error(`Delete agent error for ID ${agentId}:`, error);
    throw error;
  }
};

/**
 * Helper function to generate an agent key from a name
 */
const generateAgentKey = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 30);
};

/**
 * Creates a new conversation
 */
export const createConversation = async (title: string, department_id: number): Promise<any> => {
  try {
    const response = await fetchWithAuth(`/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, department_id }),
    });

    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }

    return await response.json();
  } catch (error) {
    console.error('Create conversation error:', error);
    throw error;
  }
};

/**
 * Sends a chat message
 */
export const sendChatMessage = async (chatRequest: ChatRequest): Promise<any> => {
  try {
    const response = await fetchWithAuth(`/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatRequest),
    });

    if (!response.ok) {
      throw new Error('Failed to send chat message');
    }

    return await response.json();
  } catch (error) {
    console.error('Send chat message error:', error);
    throw error;
  }
};

/**
 * Sets up streaming for chat responses
 */
export const streamChatResponse = (chatRequest: ChatRequest) => {
  // Make sure streaming is enabled
  chatRequest.stream = true;

  const fetchWithAuthStreaming = (): Promise<Response> => {
    const token = localStorage.getItem('access_token');

    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
      },
      body: JSON.stringify(chatRequest),
      // Enable streaming mode
      mode: 'cors',
      credentials: 'include',
    };

    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    return fetch(`/api/chat`, options);
  };

  return {
    connectToStream: async (
      onMessage: (content: string) => void,
      onID: (id: number) => void,
      onError: (error: Error) => void,
      onComplete: () => void
    ) => {
      try {
        const response = await fetchWithAuthStreaming();


        if (!response.ok) {
          throw new Error(`Failed to connect to stream: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body available');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            if (buffer) {
              // Process any remaining data in buffer
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const parsed = JSON.parse(line);
                    if (parsed.answer_chunk) {
                      onMessage(parsed.answer_chunk);
                    }
                    if (parsed.agent_msg_id) {
                      onID(parsed.agent_msg_id);
                    }
                  } catch (e) {
                    console.error('Error parsing JSON in final buffer:', e);
                  }
                }
              }
            }
            onComplete();
            break;
          }
          console.log('chunk raw:', decoder.decode(value));


          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // Keep the last line in buffer as it might be incomplete
          buffer = lines.pop() || '';

          // Process complete lines
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.answer_chunk) {
                  onMessage(parsed.answer_chunk);
                }
                if (parsed.agent_msg_id) {
                  onID(parsed.agent_msg_id);
                }
              } catch (e) {
                console.error('Error parsing JSON:', e);
              }
            }
          }
        }

      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };
};

/**
 * Get knowledge bases from the server
 */
export const getKnowledgeBases = async (departmentId?: number, userId?: number): Promise<KnowledgeBase[]> => {
  try {
    let url = `/api/knowledge-bases`;

    // Add query parameters if departmentId or userId is provided
    const params = new URLSearchParams();
    if (departmentId) params.append('department_id', departmentId.toString());
    if (userId) params.append('user_id', userId.toString());

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      throw new Error('Failed to get knowledge bases');
    }

    const data = await response.json();

    // Transform from backend format to frontend format if needed
    return data.map((kb: any) => ({
      id: kb.knowledge_base_id,
      title: kb.name || kb.title,
      description: kb.description,
      created_at: kb.created_at,
      updated_at: kb.updated_at,
      owner_id: kb.owner_id,
      owner_name: kb.owner_name,
      department_id: kb.department_id,
      department_name: kb.department_name,
      document_count: kb.document_count || 0,  // Ensure document_count is always defined
      is_public: kb.is_public,
      is_global: kb.is_global
    }));
  } catch (error) {
    console.error('Get knowledge bases error:', error);
    return [];
  }
};

/**
 * Get a specific knowledge base by ID
 */
export const getKnowledgeBase = async (knowledgeBaseId: number): Promise<KnowledgeBase | null> => {
  try {
    const response = await fetchWithAuth(`/api/knowledge-bases/${knowledgeBaseId}`);

    if (!response.ok) {
      throw new Error('Failed to get knowledge base');
    }

    const kb = await response.json();

    // Transform from backend format to frontend format
    return {
      id: kb.knowledge_base_id,
      title: kb.name,
      description: kb.description,
      created_at: kb.created_at,
      updated_at: kb.updated_at,
      owner_id: kb.owner_id,
      department_id: kb.department_id,
      document_count: kb.document_count || 0,  // Added required field
      is_public: kb.is_public,
      is_global: kb.is_global
    };
  } catch (error) {
    console.error(`Get knowledge base error for ID ${knowledgeBaseId}:`, error);
    return null;
  }
};

/**
 * Create a new knowledge base
 */
export const createKnowledgeBase = async (data: Partial<KnowledgeBase>): Promise<KnowledgeBase> => {
  try {
    const response = await fetchWithAuth(`/api/knowledge-bases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.title,
        description: data.description,
        department_id: data.department_id,
        is_public: data.is_public,
        is_global: data.is_global
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create knowledge base');
    }

    const kb_data = await response.json();

    // Transform backend format to frontend format
    return {
      id: kb_data.KnowledgeBaseID || kb_data.knowledge_base_id,
      title: kb_data.Name || kb_data.name,
      description: kb_data.Description || kb_data.description,
      created_at: kb_data.CreatedAt || kb_data.created_at,
      updated_at: kb_data.LastUpdatedAt || kb_data.last_updated_at,
      owner_id: kb_data.OwnerID || kb_data.owner_id,
      owner_name: kb_data.OwnerName || kb_data.owner_name,
      department_id: kb_data.DepartmentID || kb_data.department_id,
      department_name: kb_data.DepartmentName || kb_data.department_name,
      document_count: kb_data.DocumentCount || kb_data.document_count || 0,
      is_public: kb_data.IsPublic !== undefined ? Boolean(kb_data.IsPublic) : Boolean(kb_data.is_public),
      is_global: kb_data.IsGlobal !== undefined ? Boolean(kb_data.IsGlobal) : Boolean(kb_data.is_global)
    };
  } catch (error) {
    console.error('Create knowledge base error:', error);
    throw error;
  }
};

/**
 * Update an existing knowledge base
 */
export const updateKnowledgeBase = async (knowledgeBaseId: number, data: Partial<KnowledgeBase>): Promise<KnowledgeBase> => {
  try {
    const response = await fetchWithAuth(`/api/knowledge-bases/${knowledgeBaseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        department_id: data.department_id,
        is_public: data.is_public,
        is_global: data.is_global
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update knowledge base');
    }

    return await response.json();
  } catch (error) {
    console.error(`Update knowledge base error for ID ${knowledgeBaseId}:`, error);
    throw error;
  }
};

/**
 * Delete a knowledge base
 */
export const deleteKnowledgeBase = async (knowledgeBaseId: number): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/api/knowledge-bases/${knowledgeBaseId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete knowledge base');
    }

    return true;
  } catch (error) {
    console.error(`Delete knowledge base error for ID ${knowledgeBaseId}:`, error);
    throw error;
  }
};

/**
 * Get all data items for a knowledge base
 */
export const getKnowledgeDataItems = async (knowledgeBaseId: number): Promise<KnowledgeDataItem[]> => {
  try {
    const response = await fetchWithAuth(`/api/knowledge-bases/${knowledgeBaseId}/documents`);

    if (!response.ok) {
      throw new Error('Failed to get knowledge base data items');
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error(`Get knowledge base data items error for ID ${knowledgeBaseId}:`, error);
    return [];
  }
};

/**
 * Add a file to a knowledge base
 */
export const addKnowledgeFile = async (knowledgeBaseId: number, file: File): Promise<KnowledgeDataItem> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchWithAuth(`/api/knowledge-bases/${knowledgeBaseId}/files`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to upload file');
    }

    return await response.json();
  } catch (error) {
    console.error(`Add knowledge file error for knowledge base ID ${knowledgeBaseId}:`, error);
    throw error;
  }
};

/**
 * Add a link to a knowledge base
 */
export const addKnowledgeLink = async (knowledgeBaseId: number, url: string): Promise<KnowledgeDataItem> => {
  try {
    const response = await fetchWithAuth(`/api/knowledge-bases/${knowledgeBaseId}/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to add link');
    }

    return await response.json();
  } catch (error) {
    console.error(`Add knowledge link error for knowledge base ID ${knowledgeBaseId}:`, error);
    throw error;
  }
};

/**
 * Delete a knowledge base data item
 */
export const deleteKnowledgeDataItem = async (knowledgeBaseId: number, itemId: string): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/api/knowledge-bases/${knowledgeBaseId}/items/${itemId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete knowledge data item');
    }

    return true;
  } catch (error) {
    console.error(`Delete knowledge data item error for ID ${itemId}:`, error);
    throw error;
  }
};

/**
 * Get all documents in a knowledge base
 */
export const getDocumentsInKnowledgeBase = async (knowledgeBaseId: number): Promise<Document[]> => {
  try {
    const response = await fetchWithAuth(`/api/knowledge-bases/${knowledgeBaseId}/documents`);

    if (!response.ok) {
      throw new Error(`Failed to fetch documents: ${response.status}`);
    }

    // Get the documents from the API
    const data = await response.json();

    // Log current processing status of documents
    console.log('Documents processing status:', data.map((doc: Document) => ({
      id: doc.document_id,
      title: doc.title,
      is_processed: doc.is_processed
    })));

    return data;
  } catch (error) {
    console.error(`Error fetching documents for knowledge base ${knowledgeBaseId}:`, error);
    return [];
  }
};

/**
 * Get a specific document by ID
 */
export const getDocument = async (documentId: number): Promise<Document | null> => {
  try {
    const response = await fetchWithAuth(`/api/documents/${documentId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching document ${documentId}:`, error);
    return null;
  }
};

/**
 * Create a new document with a file upload
 */
export const createDocumentWithFile = async (
  knowledgeBaseId: number,
  file: File,
  fileType: string,
  title?: string
): Promise<Document | null> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document', JSON.stringify({
      knowledge_base_id: knowledgeBaseId,
      file_type: fileType,
      title: title || file.name,
    }));

    const response = await fetchWithAuth(`/api/documents`, {
      method: 'POST',

      body: formData, // Removed duplex property
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to upload document');
    }

    return await response.json();
  } catch (error) {
    console.error('Create document with file error:', error);
    return null;
  }
};

/**
 * Create a new document with a URL link
 */
export const createDocumentWithURL = async (
  knowledgeBaseId: number,
  url: string,
  title?: string
): Promise<Document | null> => {
  try {


    const formData = new FormData();


    // Create a document data object
    const documentData: DocumentCreateRequest = {
      knowledge_base_id: knowledgeBaseId,
      file_url: url,
      title: title || url,
      file_type: 'url'
    };


    formData.append('document', JSON.stringify(documentData)); // ส่งเป็น string

    console.log('Form data:', formData.get('document'));




    // Send the request as formData
    const response = await fetchWithAuth(`/api/documents`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create document from URL');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Create document with URL error:', error);
    return null;
  }
};

/**
 * Update an existing document
 */
export const updateDocument = async (
  documentId: number,
  data: { title?: string; content?: string }
): Promise<Document | null> => {
  try {
    const response = await fetchWithAuth(`/api/documents/${documentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update document');
    }

    return await response.json();
  } catch (error) {
    console.error(`Update document error for ID ${documentId}:`, error);
    return null;
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (documentId: number): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/api/documents/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete document');
    }

    return true;
  } catch (error) {
    console.error(`Delete document error for ID ${documentId}:`, error);
    return false;
  }
};

/**
 * Share an agent via API key
 */
export const shareAgent = async (agentId: number, data: SharedAgentData): Promise<SharedAgent> => {
  try {
    // Convert expiryDays to a proper datetime string if present
    // const expiresAt = data.expiryDays
    //   ? new Date(Date.now() + data.expiryDays * 86400000)
    //   : null;


    // console.log('expiresAt:', expiresAt); // Debug log to check the formatted date
    const shareData = {
      agent_id: agentId,
      name: data.name,
      description: data.description,
      allowed_origins: data.allowedOrigins,
      usage_limit: data.usageLimit,
      expires_at: data.expiryDays
    };

    const response = await fetchWithAuth(`/api/agents/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shareData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to share agent');
    }

    const result = await response.json();

    return {
      id: result.id,
      apiKey: result.api_key,
      agentId: result.agent_id,
      name: result.name,
      description: result.description || '',
      allowedOrigins: result.allowed_origins ? result.allowed_origins.split(',') : ['*'],
      usageLimit: result.usage_limit,
      usageCount: result.usage_count || 0,
      createdAt: result.created_at,
      expiresAt: result.expires_at
    };
  } catch (error) {
    console.error('Share agent error:', error);
    throw error;
  }
};

/**
 * Get all shared agents for the current user
 */
export const getSharedAgents = async (): Promise<SharedAgent[]> => {
  try {
    const response = await fetchWithAuth(`/api/agents/shared`);

    if (!response.ok) {
      throw new Error('Failed to get shared agents');
    }

    const data = await response.json();
    console.log('Shared agents response:', data); // Debug log to see the actual response format

    // Check if we have data in the expected format or handle alternative formats
    let agentsArray: any[] = [];
    if (Array.isArray(data)) {
      // If the response is directly an array
      agentsArray = data;
    } else if (data.sharedAgents && Array.isArray(data.sharedAgents)) {
      // If the response has a sharedAgents property that's an array
      agentsArray = data.sharedAgents;
    } else if (typeof data === 'object' && data !== null) {
      // If it's another object format, try to extract an array from it
      // This is a fallback in case the API returns a different structure
      const possibleArrays = Object.values(data).find(val => Array.isArray(val));
      if (possibleArrays) {
        agentsArray = possibleArrays as any[];
      }
    }

    // If we still don't have an array, return an empty array
    if (!agentsArray.length) {
      console.warn('No shared agents found in API response');
      return [];
    }

    return agentsArray.map((agent: any) => ({
      id: agent.id || agent.ShareID || '',
      apiKey: agent.apiKey || agent.api_key || '',
      agentId: parseInt(String(agent.agentId || agent.agent_id || agent.AgentID || '0')),
      name: agent.name || agent.Name || '',
      description: agent.description || agent.Description || '',
      allowedOrigins: typeof agent.allowedOrigins === 'string'
        ? agent.allowedOrigins.split(',')
        : (typeof agent.allowed_origins === 'string'
          ? agent.allowed_origins.split(',')
          : (Array.isArray(agent.allowedOrigins)
            ? agent.allowedOrigins
            : (Array.isArray(agent.allowed_origins)
              ? agent.allowed_origins
              : ['*']))),
      usageLimit: agent.usageLimit || agent.usage_limit || null,
      usageCount: agent.usageCount || agent.usage_count || 0,
      createdAt: agent.createdAt || agent.created_at || '',
      expiresAt: agent.expiresAt || agent.expires_at || null
    }));
  } catch (error) {
    console.error('Get shared agents error:', error);
    return [];
  }
};

/**
 * Revoke a shared agent
 */
export const revokeSharedAgent = async (apiKey: string): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/api/agents/share/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to revoke shared agent');
    }

    return true;
  } catch (error) {
    console.error('Revoke shared agent error:', error);
    throw error;
  }
};

/**
 * Get a specific shared agent by API key
 */
export const getSharedAgentByApiKey = async (apiKey: string): Promise<SharedAgent | null> => {
  try {
    const response = await fetch(`/api/agents/shared/${apiKey}`);

    if (!response.ok) {
      throw new Error('Failed to get shared agent');
    }

    const agent = await response.json();

    return {
      id: agent.id,
      apiKey: agent.api_key,
      agentId: parseInt(agent.agent_id),
      name: agent.name,
      description: agent.description || '',
      allowedOrigins: typeof agent.allowed_origins === 'string' ? agent.allowed_origins.split(',') : agent.allowed_origins || ['*'],
      usageLimit: agent.usage_limit,
      usageCount: agent.usage_count || 0,
      createdAt: agent.created_at,
      expiresAt: agent.expires_at
    };
  } catch (error) {
    console.error(`Get shared agent error for API key ${apiKey}:`, error);
    return null;
  }
};

/**
 * Get embed.js script for external embedding
 */
export const getEmbedScript = async (): Promise<string> => {
  try {
    const response = await fetch(`/api/embed.js`);

    if (!response.ok) {
      throw new Error('Failed to get embed script');
    }

    return await response.text();
  } catch (error) {
    console.error('Get embed script error:', error);
    throw error;
  }
};

/**
 * Get all available permissions
 */
export const getPermissions = async (): Promise<Permission[]> => {
  try {
    const response = await fetchWithAuth(`/api/permissions`);

    if (!response.ok) {
      throw new Error(`Failed to get permissions: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get permissions error:', error);
    return [];
  }
};

/**
 * Add a permission to a user
 */
export const addPermissionToUser = async (permissionName: string, userId?: number): Promise<boolean> => {
  try {
    const data: PermissionRequest = {
      permission_name: permissionName
    };

    if (userId) {
      data.user_id = userId;
    }

    const response = await fetchWithAuth(`/api/permissions/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify(data),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to add permission '${permissionName}'`);
    }

    // Force browser to clear cache for this permission
    await fetchWithAuth(`/api/permissions/check/${permissionName}?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    return true;
  } catch (error) {
    console.error(`Add permission error:`, error);
    throw error;
  }
};

/**
 * Remove a permission from a user
 */
export const removePermissionFromUser = async (permissionName: string, userId?: number): Promise<boolean> => {
  try {
    const data: PermissionRequest = {
      permission_name: permissionName
    };

    if (userId) {
      data.user_id = userId;
    };

    const response = await fetchWithAuth(`/api/permissions/user`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify(data),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to remove permission '${permissionName}'`);
    }

    // Force browser to clear cache for this permission
    await fetchWithAuth(`/api/permissions/check/${permissionName}?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    return true;
  } catch (error) {
    console.error(`Remove permission error:`, error);
    throw error;
  }
};

/**
 * Check if a user has a specific permission
 */
export const checkUserPermission = async (permissionName: string, userId?: number): Promise<boolean> => {
  try {
    // Add timestamp to prevent caching
    const timestamp = Date.now();
    let url = `/api/permissions/check/${permissionName}?t=${timestamp}`;

    if (userId) {
      url += `&user_id=${userId}`;
    }

    const response = await fetchWithAuth(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to check permission: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as PermissionCheckResponse;
    return data.has_permission;
  } catch (error) {
    console.error(`Check permission error for '${permissionName}':`, error);
    return false;
  }
};

/**
 * Get user permissions
 */
export const getUserPermissions = async (userId: number | string): Promise<Permission[]> => {
  try {
    const userData = await getUser(userId);

    if (!userData || !userData.permissions) {
      return [];
    }

    // Handle both array of string permission names or array of permission objects
    return userData.permissions.map((perm: any) => {
      if (typeof perm === 'string') {
        return {
          permission_id: 0, // We don't have the ID in this case
          permission_name: perm,
          description: perm // Use the name as description
        };
      } else if (typeof perm === 'object') {
        return {
          permission_id: perm.permission_id || perm.PermissionID || 0,
          permission_name: perm.permission_name || perm.PermissionName || '',
          description: perm.description || perm.Description || ''
        };
      }
      return null;
    }).filter(Boolean) as Permission[];
  } catch (error) {
    console.error(`Get user permissions error for ID ${userId}:`, error);
    return [];
  }
};

/**
 * Get available models from the server
 */
export const getAvailableModels = async (): Promise<string[]> => {
  try {
    const response = await fetchWithAuth(`/api/models`);

    if (!response.ok) {
      throw new Error('Failed to get available models');
    }

    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return ['gpt-4o-mini']; // Default fallback model
  }
};

/**
 * Create a new AI model
 */
export const addModel = async (
  platform: string,
  modelName: string,
  createdBy: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetchWithAuth(`/api/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform, model_name: modelName, created_by: createdBy }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create model');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating model:', error);
    throw error;
  }
};


/**
 * Delete an AI model by ID
 */
export const deleteModel = async (modelId: number): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetchWithAuth(`/api/models/`, {
      method: 'DELETE',
      body: JSON.stringify({ model_id: modelId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete model');
    }

    return await response.json();
  } catch (error) {
    console.error(`Error deleting model with ID ${modelId}:`, error);
    throw error;
  }
};

/**
 * Get all AI models including details from the database
 */
export const getAllModels = async (): Promise<any[]> => {
  try {
    const response = await fetchWithAuth(`/api/all_models`);

    if (!response.ok) {
      throw new Error('Failed to get all models');
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('Error fetching all models:', error);
    return [];
  }
};






export default {
  fetchWithAuth,
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  getUsers,
  getAllUserDetails,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  setUserRole,
  getDepartments,
  getDepartment,
  getDepartmentUsers,
  addUserToDepartment,
  removeUserFromDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  getKnowledgeBases,
  getKnowledgeBase,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeDataItems,
  addKnowledgeFile,
  addKnowledgeLink,
  deleteKnowledgeDataItem,
  createConversation,
  sendChatMessage,
  streamChatResponse,
  getDocumentsInKnowledgeBase,
  getDocument,
  createDocumentWithFile,
  createDocumentWithURL,
  updateDocument,
  deleteDocument,
  shareAgent,
  getSharedAgents,
  revokeSharedAgent,
  getSharedAgentByApiKey,
  getEmbedScript,
  getPermissions,
  addPermissionToUser,
  removePermissionFromUser,
  checkUserPermission,
  getUserPermissions,
  getAvailableModels,
  submitMessageFeedback,
  addMessageRating,
  getAllMessages,
  getDepartmentMessages,
  addModel,
  deleteModel,
  getAllModels
};