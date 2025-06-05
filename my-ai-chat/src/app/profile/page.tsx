'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getUserProfile, updateUserProfile, uploadAvatar, updateUser, getUserPermissions } from '@/utils/apiService';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';

interface UserProfile {
  UserID?: number;
  Username: string;
  Email?: string;
  FirstName?: string;
  LastName?: string;
  avatar_url?: string;
  UserRole?: string;
  departments?: Array<{ id: number, name: string }>;
  permissions?: Array<string | { PermissionID: number, PermissionName: string, Description?: string, GrantedAt?: string, GrantedByUsername?: string }>;
  IsActive?: boolean;
}

export default function Profile() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({
    Username: '',
    avatar_url: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfile>({
    Username: '',
    avatar_url: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // Fetch user profile data from the backend
  useEffect(() => {
    const fetchProfileFromAPI = async () => {
      if (isAuthenticated) {
        setIsLoadingProfile(true);
        setError('');

        try {
          // Fetch profile data from the API
          const userProfileData = await getUserProfile();

          // Set default values for missing fields
          const profileData: UserProfile = {
            UserID: userProfileData.UserID,
            Username: userProfileData.Username || 'User',
            Email: userProfileData.Email || '',
            FirstName: userProfileData.FirstName || '',
            LastName: userProfileData.LastName || '',
            avatar_url: userProfileData.avatar_url || '',
            UserRole: userProfileData.UserRole || 'User',
            departments: userProfileData.departments || [],
            permissions: userProfileData.permissions || [],
            IsActive: userProfileData.IsActive !== undefined ? userProfileData.IsActive : true
          };

          setProfile(profileData);
          setTempProfile(profileData);
        } catch (error) {
          console.error('Error fetching profile:', error);
          setError('Failed to load profile data. Please try again later.');
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };

    fetchProfileFromAPI();
  }, [isAuthenticated]);

  const handleSave = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      if (!profile.UserID) {
        throw new Error('User ID not found');
      }

      // Prepare update data
      const updateData = {
        first_name: tempProfile.FirstName,
        last_name: tempProfile.LastName,
        email: tempProfile.Email
      };

      // Update user profile
      const updatedProfile = await updateUserProfile(updateData);

      // If password fields are shown and have values, update password too
      if (showPasswordFields && password.current && password.new && password.confirm) {
        if (password.new !== password.confirm) {
          setPasswordError('New password and confirmation do not match');
          setIsSubmitting(false);
          return;
        }

        // Update the user with the new password
        await updateUser(profile.UserID, {
          password: password.new
        });

        // Reset password fields
        setPassword({ current: '', new: '', confirm: '' });
        setPasswordError('');
      }

      // Update local state
      setProfile({
        ...tempProfile,
        ...updatedProfile
      });
      setIsEditing(false);
      setShowPasswordFields(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTempProfile({
      ...tempProfile,
      [name]: value
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a preview
    const previewUrl = URL.createObjectURL(file);
    setTempProfile(prev => ({
      ...prev,
      avatar_url: previewUrl
    }));

    try {
      setIsSubmitting(true);

      // Upload the avatar to the server
      const formData = new FormData();
      formData.append('avatar', file);

      const result = await uploadAvatar(formData);

      if (result.avatar_url) {
        // Update both profiles with the new avatar URL from the server
        const serverAvatarUrl = result.avatar_url;
        setTempProfile(prev => ({
          ...prev,
          avatar_url: serverAvatarUrl
        }));
        setProfile(prev => ({
          ...prev,
          avatar_url: serverAvatarUrl
        }));
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setError('Failed to upload avatar. Please try again.');

      // Revert to the previous avatar if upload fails
      setTempProfile(prev => ({
        ...prev,
        avatar_url: profile.avatar_url
      }));
    } finally {
      setIsSubmitting(false);
      // Revoke the object URL to avoid memory leaks
      URL.revokeObjectURL(previewUrl);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex pt-16">
      <div className="flex-1">
        <main className="flex-1 flex flex-col items-center p-4">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 max-w-2xl w-full shadow-lg dark:shadow-gray-900">
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 mb-4">
                <div
                  className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center"
                  style={tempProfile.avatar_url ? { backgroundImage: `url(${tempProfile.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                >
                  {!tempProfile.avatar_url && (
                    <svg className="h-16 w-16 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                    </svg>
                  )}
                </div>
                {isEditing && (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 bg-blue-600 dark:bg-blue-500 p-2 rounded-full hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                      disabled={isSubmitting}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>

              {isEditing ? (
                <>
                  <div className="w-full space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                      <input
                        type="text"
                        name="Username"
                        value={tempProfile.Username}
                        onChange={handleInputChange}
                        className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded"
                        disabled // Username is typically not changeable
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                      <input
                        type="Email"
                        name="Email"
                        value={tempProfile.Email || ''}
                        onChange={handleInputChange}
                        className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded"
                      />
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                        <input
                          type="text"
                          name="FirstName"
                          value={tempProfile.FirstName || ''}
                          onChange={handleInputChange}
                          className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                        <input
                          type="text"
                          name="LastName"
                          value={tempProfile.LastName || ''}
                          onChange={handleInputChange}
                          className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded"
                        />
                      </div>
                    </div>

                    {/* Toggle for password change fields */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPasswordFields(!showPasswordFields)}
                        className="text-blue-600 dark:text-blue-400 underline text-sm"
                      >
                        {showPasswordFields ? 'Hide Password Fields' : 'Change Password'}
                      </button>
                    </div>

                    {/* Password Fields (conditionally shown) */}
                    {showPasswordFields && (
                      <div className="space-y-3 p-3 bg-gray-200 dark:bg-gray-700 rounded-lg">
                        {passwordError && (
                          <div className="p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md text-sm">
                            {passwordError}
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                          <input
                            type="password"
                            value={password.current}
                            onChange={(e) => setPassword({ ...password, current: e.target.value })}
                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                          <input
                            type="password"
                            value={password.new}
                            onChange={(e) => setPassword({ ...password, new: e.target.value })}
                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                          <input
                            type="password"
                            value={password.confirm}
                            onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 mb-6 w-full">
                    <button
                      onClick={handleSave}
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setTempProfile(profile);
                        setIsEditing(false);
                        setShowPasswordFields(false);
                        setPassword({ current: '', new: '', confirm: '' });
                        setPasswordError('');
                      }}
                      disabled={isSubmitting}
                      className="flex-1 bg-gray-500 dark:bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-gray-900 dark:text-white text-2xl font-bold mb-2">{profile.Username}</h1>
                  {(profile.FirstName || profile.LastName) && (
                    <h2 className="text-gray-700 dark:text-gray-300 text-lg mb-2">
                      {[profile.FirstName, profile.LastName].filter(Boolean).join(' ')}
                    </h2>
                  )}
                  {profile.Email && (
                    <p className="text-gray-500 dark:text-gray-400 mb-4">{profile.Email}</p>
                  )}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded mb-6 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Edit Profile
                  </button>
                </>
              )}

              <div className="grid grid-cols-2 gap-4 w-full text-center mb-6">
                <div className="bg-gray-200 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="text-gray-900 dark:text-white font-bold">Role</div>
                  <div className="text-gray-600 dark:text-gray-400">{profile.UserRole || 'User'}</div>
                </div>
                <div className="bg-gray-200 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="text-gray-900 dark:text-white font-bold">Account ID</div>
                  <div className="text-gray-600 dark:text-gray-400">#{profile.UserID}</div>
                </div>
              </div>

              {/* Departments Section - Always show if available */}
              {profile.departments && profile.departments.length > 0 && (
                <div className="w-full p-4 bg-gray-200 dark:bg-gray-700 rounded-lg mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Departments</h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.departments.map((dept) => (
                      <span key={dept.id} className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 px-3 py-1 rounded-full text-sm">
                        {dept.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Permissions Section - Always show if available */}
              {profile.permissions && profile.permissions.length > 0 && (
                <div className="w-full p-4 bg-gray-200 dark:bg-gray-700 rounded-lg">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Permissions</h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.permissions.map((perm, index) => {
                      // Handle both string permissions and object permissions
                      const permissionName = typeof perm === 'string'
                        ? perm
                        : perm.PermissionName;

                      return (
                        <span key={index} className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 px-3 py-1 rounded-full text-sm">
                          {permissionName}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
