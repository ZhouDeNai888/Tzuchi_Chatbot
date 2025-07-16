"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/utils/translations";
import { toast } from "react-hot-toast";
import {
  getUser,
  updateUser,
  getDepartments,
  getPermissions,
  addPermissionToUser,
  removePermissionFromUser,
  setUserRole,
  UserUpdateRequest,
  Department,
  Permission,
} from "@/utils/apiService";
import React from "react";
import { useParams } from "next/navigation";

interface DepartmentData {
  id?: number;
  name?: string;
  department_id?: number;
  Name?: string;
}

interface Account {
  id: string;
  username: string;
  email: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  role: string;
  department: string;
  departments?: DepartmentData[];
  department_id?: number;
  selectedDepartments: number[];
  permissions: string[];
  status: "active" | "inactive";
}

// Component to display and manage user permissions
const PermissionDisplay = ({
  userId,
  userPermissions,
  onPermissionChange,
  userRole,
}: {
  userId: string;
  userPermissions: string[];
  onPermissionChange: (newPermissions: string[]) => void;
  userRole: string;
}) => {
  const [availablePermissions, setAvailablePermissions] = useState<
    Permission[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { language } = useLanguage();
  const t = translations[language];

  // Fetch permissions when component mounts or refresh key changes
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setLoading(true);
        const permissions = await getPermissions();
        setAvailablePermissions(permissions);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch permissions:", err);
        setError(
          t.accountEdit?.failedToLoad || "Failed to load available permissions"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [refreshKey, t]);

  const handleTogglePermission = async (
    permissionName: string,
    checked: boolean
  ) => {
    try {
      setLoading(true);

      if (checked) {
        await addPermissionToUser(permissionName, parseInt(userId));
        toast.success(
          `${
            t.accountEdit?.addedPermission || "Added permission"
          }: ${permissionName}`
        );
      } else {
        await removePermissionFromUser(permissionName, parseInt(userId));
        toast.success(
          `${
            t.accountEdit?.removedPermission || "Removed permission"
          }: ${permissionName}`
        );
      }

      // Update the parent component's state
      const newPermissions = checked
        ? [...userPermissions, permissionName]
        : userPermissions.filter((p) => p !== permissionName);

      onPermissionChange(newPermissions);

      // Force refresh permissions list to ensure UI is in sync with backend
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(`Failed to ${checked ? "add" : "remove"} permission:`, err);
      toast.error(
        `${
          checked
            ? t.accountEdit?.failedToAdd || "Failed to add"
            : t.accountEdit?.failedToRemove || "Failed to remove"
        } ${t.accountEdit?.permission || "permission"}: ${permissionName}`
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-4 sm:py-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="py-4 text-center text-red-500">{error}</div>;
  }

  // Group permissions by category if possible
  const groupedPermissions: Record<string, Permission[]> = {};
  availablePermissions.forEach((permission) => {
    const category = permission.permission_name.includes("_")
      ? permission.permission_name.split("_")[0]
      : "general";

    if (!groupedPermissions[category]) {
      groupedPermissions[category] = [];
    }
    groupedPermissions[category].push(permission);
  });

  const isAdmin = userRole === "admin";

  return (
    <div className="mt-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {isAdmin && (
        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">
              {t.accountEdit?.adminPermissions || "Administrator permissions"}:
            </span>{" "}
            {t.accountEdit?.adminHasAllPermissions ||
              "As an admin, this user has all permissions by default."}
          </p>
        </div>
      )}

      <div className="max-h-[300px] sm:max-h-[350px] overflow-y-auto p-2">
        {Object.keys(groupedPermissions).length > 0 ? (
          Object.entries(groupedPermissions).map(([category, permissions]) => (
            <div key={category} className="mb-3 sm:mb-4">
              <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 capitalize mb-2 px-2">
                {category === "general"
                  ? t.accountEdit?.generalPermissions || "General Permissions"
                  : `${category} ${
                      t.accountEdit?.permissions || "Permissions"
                    }`}
              </h3>
              <div className="space-y-1">
                {permissions.map((permission) => (
                  <div
                    key={permission.permission_id}
                    className="flex items-start px-2 sm:px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <div className="flex h-5 items-center mr-2 sm:mr-3 flex-shrink-0">
                      <input
                        type="checkbox"
                        id={`perm-${permission.permission_name}`}
                        checked={
                          userPermissions.includes(
                            permission.permission_name
                          ) || isAdmin
                        }
                        onChange={(e) =>
                          handleTogglePermission(
                            permission.permission_name,
                            e.target.checked
                          )
                        }
                        disabled={isAdmin}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`perm-${permission.permission_name}`}
                        className={`text-xs sm:text-sm font-medium ${
                          isAdmin
                            ? "text-gray-500 dark:text-gray-400"
                            : "text-gray-700 dark:text-gray-300"
                        } cursor-pointer break-words`}
                      >
                        {permission.permission_name}
                      </label>
                      {permission.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">
                          {permission.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-6 sm:py-8">
            {t.accountEdit?.noPermissionsAvailable ||
              "No permissions available"}
          </div>
        )}
      </div>
    </div>
  );
};

export default function EditUserPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [user, setUser] = useState<Account | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { language } = useLanguage();
  const t = translations[language].accountEdit;
  const commonT = translations[language].common;

  const { slug } = params;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const userData = await getUser(slug);
        console.log("User Data:", userData);

        if (!userData) {
          throw new Error("Failed to fetch user data");
        }

        const departmentsData = await getDepartments();
        console.log("Departments:", departmentsData);
        setDepartments(departmentsData || []);

        const userDepartmentIds =
          userData.departments && Array.isArray(userData.departments)
            ? userData.departments.map((dept) =>
                Number(dept.id || (dept as any).DepartmentID)
              )
            : [];
        console.log("User Department IDs:", userDepartmentIds);
        setUser({
          id: String(userData.UserID),
          username: userData.Username,
          email: userData.Email,
          firstname: userData.FirstName || "",
          lastname: userData.LastName || "",
          role: userData.UserRole || "User",
          department:
            userData.departments && userData.departments.length > 0
              ? (userData.departments[0] as any).Name ||
                userData.departments[0].name ||
                ""
              : "",
          departments: userData.departments as unknown as DepartmentData[],
          selectedDepartments: userDepartmentIds,
          permissions:
            userData.permissions && Array.isArray(userData.permissions)
              ? userData.permissions.map((perm) => {
                  if (typeof perm === "object" && perm !== null) {
                    return (
                      (perm as any).PermissionName ||
                      (perm as any).id ||
                      (perm as string)
                    );
                  }
                  return perm as string;
                })
              : [],
          status: userData.IsActive ? "active" : "inactive",
        });
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast.error(t.failedToLoad || "Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [slug, t]);

  const handleUpdateUser = async () => {
    if (!user) return;

    try {
      setSaving(true);

      const updateData: UserUpdateRequest = {
        username: user.username,
        email: user.email,
        first_name: user.firstname,
        last_name: user.lastname,
        user_role: user.role,
        is_active: user.status === "active",
        permissions: user.permissions,
        department_ids: user.selectedDepartments,
      };

      if (user.password && user.password.trim() !== "") {
        updateData.password = user.password;
      }

      await updateUser(user.id, updateData);
      toast.success(t.userUpdated || "User updated successfully");
      router.push("/accounts");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : t.failedToUpdate || "Failed to update user"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center items-center p-4 sm:p-8">
        <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
        <div className="max-w-2xl sm:max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
          <div className="text-center">
            <svg
              className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {t.userNotFound || "User Not Found"}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
              {t.userNotFoundMessage ||
                "The requested account could not be found or you don't have permission to view it."}
            </p>
            <button
              onClick={() => router.push("/accounts")}
              className="w-full sm:w-auto bg-blue-600 dark:bg-blue-500 text-white px-6 py-3 sm:py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm sm:text-base"
            >
              {t.back || "Back to Accounts"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 mt-15">
      <div className="max-w-3xl lg:max-w-4xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 sm:mb-6 gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/accounts")}
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 -ml-1"
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                {user.firstname && user.lastname
                  ? `${user.firstname} ${user.lastname}`
                  : user.username}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 ml-8">
              {t.title || "Edit Account"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-start lg:justify-end">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                user.status === "active"
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
              }`}
            >
              {user.status === "active"
                ? t.status?.active || "Active"
                : t.status?.inactive || "Inactive"}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {user.role === "admin"
                ? t.roles?.administrator || "Administrator"
                : t.roles?.user || "User"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t.accountDetails || "Account Details"}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.form?.username || "Username"} *
                </label>
                <input
                  type="text"
                  value={user.username}
                  onChange={(e) =>
                    setUser({ ...user, username: e.target.value })
                  }
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.email || "Email"} *
                </label>
                <input
                  type="email"
                  value={user.email}
                  onChange={(e) => setUser({ ...user, email: e.target.value })}
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.firstName || "First Name"}
                </label>
                <input
                  type="text"
                  value={user.firstname || ""}
                  onChange={(e) =>
                    setUser({ ...user, firstname: e.target.value })
                  }
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.lastName || "Last Name"}
                </label>
                <input
                  type="text"
                  value={user.lastname || ""}
                  onChange={(e) =>
                    setUser({ ...user, lastname: e.target.value })
                  }
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.form?.password || "Password"}
                </label>
                <input
                  type="password"
                  placeholder={
                    t.form?.passwordPlaceholder || "Enter to change password"
                  }
                  onChange={(e) =>
                    setUser({ ...user, password: e.target.value })
                  }
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full text-base"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t.form?.passwordHint ||
                    "Leave blank to keep current password"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.form?.status || "Status"}
                </label>
                <select
                  value={user.status}
                  onChange={(e) =>
                    setUser({
                      ...user,
                      status: e.target.value as "active" | "inactive",
                    })
                  }
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full text-base"
                >
                  <option value="active">{t.status?.active || "Active"}</option>
                  <option value="inactive">
                    {t.status?.inactive || "Inactive"}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.form?.role || "Role"}
                </label>
                <select
                  value={user.role}
                  onChange={(e) =>
                    setUser({
                      ...user,
                      role: e.target.value as "admin" | "user",
                    })
                  }
                  className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full text-base"
                >
                  <option value="user">{t.roles?.user || "User"}</option>
                  <option value="admin">
                    {t.roles?.administrator || "Administrator"}
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Departments Section */}
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t.form?.department || "Department Access"}
            </h2>

            {departments.length > 0 ? (
              <>
                <div className="mb-4">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {t.selectDepartmentsInfo ||
                      "Select the departments this user can access:"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 sm:max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-3">
                    {departments.map((dept) => {
                      const deptId = dept.id || (dept as any).department_id;
                      const deptName = dept.name || (dept as any).Name;
                      const isSelected = user.selectedDepartments.includes(
                        Number(deptId)
                      );

                      return (
                        <label
                          key={deptId}
                          className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const departmentId = Number(deptId);
                              let newSelectedDepartments;

                              if (isSelected) {
                                newSelectedDepartments =
                                  user.selectedDepartments.filter(
                                    (id) => id !== departmentId
                                  );
                              } else {
                                newSelectedDepartments = [
                                  ...user.selectedDepartments,
                                  departmentId,
                                ];
                              }

                              setUser((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  selectedDepartments: newSelectedDepartments,
                                  departments:
                                    newSelectedDepartments.length > 0
                                      ? departments
                                          .filter((d) =>
                                            newSelectedDepartments.includes(
                                              Number(
                                                d.id || (d as any).DepartmentID
                                              )
                                            )
                                          )
                                          .map((d) => ({
                                            id: Number(
                                              d.id || (d as any).DepartmentID
                                            ),
                                            name: d.name || (d as any).Name,
                                          }))
                                      : [],
                                } as Account;
                              });
                            }}
                            className="h-4 w-4 mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                          />
                          <span className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 break-words">
                            {deptName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {user.selectedDepartments.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t.selectedDepartments || "Selected Departments:"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {user.selectedDepartments.map((deptId) => {
                        const dept = departments.find(
                          (d) =>
                            Number(d.id || (d as any).DepartmentID) === deptId
                        );
                        if (!dept) return null;
                        const deptName = dept.name || (dept as any).Name;

                        return (
                          <div
                            key={deptId}
                            className="inline-flex items-center bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 rounded-full px-3 py-1 text-xs sm:text-sm"
                          >
                            <span className="break-words">{deptName}</span>
                            <button
                              type="button"
                              className="ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 hover:text-blue-600 dark:hover:text-blue-100 focus:outline-none flex-shrink-0"
                              onClick={() => {
                                const newSelectedDepartments =
                                  user.selectedDepartments.filter(
                                    (id) => id !== deptId
                                  );

                                setUser({
                                  ...user,
                                  selectedDepartments: newSelectedDepartments,
                                  departments:
                                    newSelectedDepartments.length > 0
                                      ? departments
                                          .filter((d) =>
                                            newSelectedDepartments.includes(
                                              Number(
                                                d.id || (d as any).DepartmentID
                                              )
                                            )
                                          )
                                          .map((d) => ({
                                            id: Number(
                                              d.id || (d as any).DepartmentID
                                            ),
                                            name: d.name || (d as any).Name,
                                          }))
                                      : [],
                                });
                              }}
                            >
                              <span className="sr-only">
                                {t.remove || "Remove"}
                              </span>
                              <svg
                                className="h-3 w-3"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {t.noDepartments || "No departments available"}
                </p>
              </div>
            )}
          </div>

          {/* Permissions Section */}
          <div className="p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t.form?.permissions || "Permissions"}
            </h2>

            <PermissionDisplay
              userId={user.id}
              userPermissions={user.permissions}
              onPermissionChange={(newPermissions) =>
                setUser({ ...user, permissions: newPermissions })
              }
              userRole={user.role}
            />

            {user.permissions.includes("full_admin") && (
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-3 sm:p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-xs sm:text-sm font-medium text-yellow-800 dark:text-yellow-300">
                      {t.fullAdminAccess || "Full Administrator Access"}
                    </h3>
                    <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-200">
                      <p>
                        {t.fullAdminDescription ||
                          "This user has full administrator privileges with unrestricted access to all system features."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={() => router.push("/accounts")}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm sm:text-base order-2 sm:order-1"
          >
            {commonT.cancel || "Cancel"}
          </button>

          <button
            onClick={handleUpdateUser}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-3 sm:py-2 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 text-sm sm:text-base order-1 sm:order-2"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                {commonT.saving || "Saving..."}
              </>
            ) : (
              t.form?.saveChanges || commonT.saveChanges || "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
