from langchain_community.document_loaders import PyPDFDirectoryLoader, DirectoryLoader, CSVLoader
import pyodbc
from datetime import datetime
import sys
import logging
from dotenv import load_dotenv
import os
import bcrypt

sys.stdout.reconfigure(encoding='utf-8')

# ตั้งค่า logging
log_dir = "/app/data/logs"
os.makedirs(log_dir, exist_ok=True)
logger = logging.getLogger("Database")
file_handler = logging.FileHandler(os.path.join(
    log_dir, 'Database.log'), encoding="utf-8")
console_handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.addHandler(console_handler)
logger.setLevel(logging.INFO)


# load environment variables
load_dotenv()
database_name = os.getenv("DATABASE_NAME", "AIChatDB")  # Default to AIChatDB if not set
database_user = os.getenv("DATABASE_USER")
database_password = os.getenv("DATABASE_PASSWORD")


class Database():
    def __init__(self) -> None:
        self.conn = None  # Database connection object

    # Establish database connection
    def Conn_Sql(self):
        try:
            self.conn = pyodbc.connect(
                "DRIVER={ODBC Driver 17 for SQL Server};"
                "SERVER=host.docker.internal;"
                "DATABASE="+database_name+";"
                "UID="+database_user+";"
                "PWD="+database_password+";"
                "MARS_Connection=Yes;"
            )
            logger.info("Connecting successfully!")
            return self.conn
        except pyodbc.Error as e:
            logger.error("Error: %s", e)
            return None
    
    def close_connection(self):
        """Close the database connection if it exists."""
        if self.conn:
            try:
                self.conn.close()
                logger.info("Connection closed successfully.")
                self.conn = None
            except pyodbc.Error as e:
                logger.error("Error closing connection: %s", e)
    
    # User Management Functions
    def create_user(self, username, email, password, first_name=None, last_name=None, user_role='user', preferred_language='en', department_ids=None, permissions=None):
        """Create a new user in the database using the stored procedure."""
        try:
            if not self.conn:
                self.Conn_Sql()
                
            # Hash the password
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            cursor = self.conn.cursor()
            
            # Convert department_ids list to comma-separated string if provided
            print(department_ids)
            dept_ids_str = None
            if department_ids:
                dept_ids_str = ','.join(map(str, department_ids))
            
            # Call stored procedure to create user
            cursor.execute(
                "EXEC CreateUser @Username=?, @Email=?, @PasswordHash=?, @FirstName=?, @LastName=?, @UserRole=?, @PreferredLanguage=?, @DepartmentIDs=?",
                (username, email, password_hash, first_name, last_name, user_role, preferred_language, dept_ids_str)
            )
            
            self.conn.commit()
            cursor.close()

            print(permissions)

            # Get the user ID in a new cursor
            if permissions:
                cursor = self.conn.cursor()
                cursor.execute("SELECT UserID FROM Users WHERE Username = ?", (username,))
                user_id = cursor.fetchval()
                
                # Add permissions
                if user_id:
                    for permission_name in permissions:
                        # Check if user already has this permission
                        cursor.execute("""
                            SELECT 1 FROM UserPermissions up
                            JOIN Permissions p ON up.PermissionID = p.PermissionID
                            WHERE up.UserID = ? AND p.PermissionName = ?
                        """, (user_id, permission_name))
                        
                        if not cursor.fetchone():
                            try:
                                cursor.execute(
                                    "EXEC GrantPermissionToUser @UserID=?, @PermissionName=?, @GrantedBy=?",
                                    (user_id, permission_name, user_id)
                                )
                            except pyodbc.Error as perm_err:
                                # Log the permission error but continue with other permissions
                                logger.warning(f"Could not add permission '{permission_name}' to user '{username}': {perm_err}")
                                continue
                    
                    self.conn.commit()
                    cursor.close()
                    logger.info(f"User '{username}' created with ID: {user_id} and permissions added")
                    return user_id
            logger.info(f"User '{username}' created successfully")
            return None
        except pyodbc.Error as e:
            logger.error("Error creating user: %s", e)
            if self.conn:
                self.conn.rollback()
            return None
            
        
    
    def get_user_details(self, user_id):
        """Get user details by ID."""
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Get user information
            cursor.execute(
                """
                SELECT u.*, 
                       (SELECT COUNT(*) FROM Conversations WHERE UserID = u.UserID) AS ConversationCount,
                       (SELECT COUNT(*) FROM UserPermissions WHERE UserID = u.UserID) AS PermissionCount
                FROM Users u 
                WHERE u.UserID = ?
                """, 
                (user_id,)
            )
            
            row = cursor.fetchone()
            if not row:
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return None
                
            # Convert to dictionary
            columns = [column[0] for column in cursor.description]
            user = dict(zip(columns, row))
            
            # Get user departments
            cursor.execute(
                """
                SELECT d.* 
                FROM Departments d
                JOIN UserDepartments ud ON d.DepartmentID = ud.DepartmentID
                WHERE ud.UserID = ?
                """, 
                (user_id,)
            )
            
            departments = []
            dept_columns = [column[0] for column in cursor.description]
            for dept_row in cursor.fetchall():
                department = dict(zip(dept_columns, dept_row))
                departments.append(department)
                
            user['departments'] = departments
            
            # Get user permissions
            cursor.execute(
                """
                SELECT p.PermissionID, p.PermissionName, p.Description, 
                       up.GrantedAt, u.Username AS GrantedByUsername
                FROM UserPermissions up
                JOIN Permissions p ON up.PermissionID = p.PermissionID
                JOIN Users u ON up.GrantedBy = u.UserID
                WHERE up.UserID = ?
                """, 
                (user_id,)
            )
            
            permissions = []
            perm_columns = [column[0] for column in cursor.description]
            for perm_row in cursor.fetchall():
                permission = dict(zip(perm_columns, perm_row))
                permissions.append(permission)
                
            user['permissions'] = permissions
            
            cursor.close()
            logger.info(f"Retrieved details for user ID: {user_id}")
            return user
            
        except pyodbc.Error as e:
            logger.error("Error getting user details: %s", e)
            return None
    
    def update_user(self, user_id, **kwargs):
        """Update user details."""
        try:
            if not self.conn:
                self.Conn_Sql()
                
            # Check which fields are being updated
            update_fields = []
            update_values = []
            
            updateable_fields = [
                'Email', 'FirstName', 'LastName', 'IsActive', 
                'UserRole', 'PreferredLanguage', 'ProfileImageURL'
            ]
            
            for field in updateable_fields:
                if (field.lower() in kwargs and field != 'IsActive'):
                    update_fields.append(f"{field} = ?")
                    update_values.append(kwargs[field.lower()])
                elif 'first_name' in kwargs and field == 'FirstName':
                    update_fields.append("FirstName = ?")
                    update_values.append(kwargs['first_name'])
                elif 'last_name' in kwargs and field == 'LastName':
                    update_fields.append("LastName = ?")
                    update_values.append(kwargs['last_name'])
            if 'is_active' in kwargs:
                update_fields.append("IsActive = ?")
                update_values.append(1 if kwargs['is_active'] else 0)
            
            # Handle password update separately (needs hashing)
            if 'password' in kwargs:
                password_hash = bcrypt.hashpw(kwargs['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                update_fields.append("PasswordHash = ?")
                update_values.append(password_hash)
            
            if not update_fields:
                logger.warning("No valid fields provided for user update")
                return False
                
            # Add LastUpdatedAt
            update_fields.append("LastUpdatedAt = GETDATE()")
            
            # Build and execute query
            cursor = self.conn.cursor()
            query = f"UPDATE Users SET {', '.join(update_fields)} WHERE UserID = ?"
            update_values.append(user_id)
            
            cursor.execute(query, update_values)
            
            # If department IDs are provided, update them
            if 'department_ids' in kwargs:
                # First, remove all existing department associations
                cursor.execute("DELETE FROM UserDepartments WHERE UserID = ?", (user_id,))
                
                # Then add new ones
                department_ids = kwargs['department_ids']
                if department_ids:
                    for dept_id in department_ids:
                        cursor.execute(
                            "INSERT INTO UserDepartments (UserID, DepartmentID) VALUES (?, ?)",
                            (user_id, dept_id)
                        )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"User ID {user_id} updated successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error("Error updating user: %s", e)
            if self.conn:
                self.conn.rollback()
            return False
    
    def update_user_detail(self, user_id, **kwargs):
        """
        Update any detail of a user in the database.
        
        Args:
            user_id (int): The ID of the user to update
            **kwargs: Key-value pairs where key is the column name and value is the new value
                     Possible keys include: username, email, password, first_name, last_name,
                     is_active, user_role, preferred_language, profile_image_url, department_ids
        
        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            # Check if user exists
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (user_id,))
            if not cursor.fetchone():
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return False
                
            # These are all possible updateable fields from the Users table
            updateable_fields = {
                'username': 'Username',
                'email': 'Email',
                'first_name': 'FirstName',
                'last_name': 'LastName',
                'is_active': 'IsActive',
                'user_role': 'UserRole',
                'preferred_language': 'PreferredLanguage',
                'profile_image_url': 'ProfileImageURL'
            }
            
            # Build the update query
            update_parts = []
            update_values = []
            
            # Process each provided field
            for field, value in kwargs.items():
                if field == 'password':
                    # Special handling for password - needs hashing
                    password_hash = bcrypt.hashpw(value.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    update_parts.append("PasswordHash = ?")
                    update_values.append(password_hash)
                elif field in updateable_fields:
                    # Regular field update
                    update_parts.append(f"{updateable_fields[field]} = ?")
                    update_values.append(value)
            
            # If no valid update fields were provided, return early
            if not update_parts:
                logger.warning("No valid fields provided for user update")
                cursor.close()
                return False
            
            # Add the timestamp update
            update_parts.append("LastUpdatedAt = GETDATE()")
            
            # Complete the query
            query = f"UPDATE Users SET {', '.join(update_parts)} WHERE UserID = ?"
            update_values.append(user_id)
            
            # Execute the update query
            cursor.execute(query, update_values)
            
            # Handle department IDs if provided
            if 'department_ids' in kwargs:
                department_ids = kwargs['department_ids']
                
                # Remove current department associations
                cursor.execute("DELETE FROM UserDepartments WHERE UserID = ?", (user_id,))
                
                # Add new department associations if any were provided
                if department_ids and isinstance(department_ids, list):
                    for dept_id in department_ids:
                        cursor.execute(
                            "INSERT INTO UserDepartments (UserID, DepartmentID) VALUES (?, ?)",
                            (user_id, dept_id)
                        )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"User ID {user_id} updated successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error updating user: {e}")
            if self.conn:
                self.conn.rollback()
            return False
    
    def authenticate_user(self, username, password):
        """Authenticate a user by username and password."""
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Get user by username
            cursor.execute("SELECT UserID, PasswordHash, UserRole, IsActive FROM Users WHERE Username = ?", (username,))
            user = cursor.fetchone()
            
            if not user:
                logger.warning(f"Authentication failed: User '{username}' not found")
                return {"error_code": 1, "error_message": "Incorrect username or password"}
            
            # Check if account is active
            if not user.IsActive:
                logger.warning(f"Authentication failed: Account for user '{username}' is inactive")
                return {"error_code": 2, "error_message": "Account is inactive"}
                
            # Verify password
            stored_hash = user.PasswordHash
            if bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
                user_id = user.UserID
                
                # Update last login time
                cursor.execute("UPDATE Users SET LastLoginAt = GETDATE() WHERE UserID = ?", (user_id,))
                self.conn.commit()
                
                logger.info(f"User '{username}' authenticated successfully")
                return user
            else:
                logger.warning(f"Authentication failed: Invalid password for user '{username}'")
                return {"error_code": 1, "error_message": "Incorrect username or password"}
                
        except pyodbc.Error as e:
            logger.error("Error authenticating user: %s", e)
            return {"error_code": 3, "error_message": "An error occurred during authentication"}
        finally:
            if cursor:
                cursor.close()
    
    def add_permission_to_user(self, user_id, permission_name, granted_by):
        """
        Add a specific permission to a user.
        This is a wrapper around the stored procedure GrantPermissionToUser.
        
        Args:
            user_id (int): The ID of the user to grant permission to
            permission_name (str): The name of the permission to grant
            granted_by (int): The ID of the user granting the permission
            
        Returns:
            bool: True if permission was granted successfully, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            # Check if user exists and is not an admin (admins already have all permissions)
            cursor = self.conn.cursor()
            cursor.execute("SELECT UserRole FROM Users WHERE UserID = ?", (user_id,))
            user_role = cursor.fetchone()
            
            if not user_role:
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return False
                
            if user_role.UserRole == 'admin':
                logger.info(f"User ID {user_id} is an admin and already has all permissions")
                cursor.close()
                return True
                
            # Check if permission exists
            cursor.execute("SELECT PermissionID FROM Permissions WHERE PermissionName = ?", (permission_name,))
            permission = cursor.fetchone()
            if not permission:
                logger.warning(f"Permission '{permission_name}' does not exist")
                cursor.close()
                return False
            
            # Check if user already has this permission
            cursor.execute("""
                SELECT 1 FROM UserPermissions up
                JOIN Permissions p ON up.PermissionID = p.PermissionID
                WHERE up.UserID = ? AND p.PermissionName = ?
            """, (user_id, permission_name))
            
            if cursor.fetchone():
                logger.info(f"User ID {user_id} already has permission '{permission_name}'")
                cursor.close()
                return True
            
            # Call stored procedure to grant the permission
            cursor.execute(
                "EXEC GrantPermissionToUser @UserID=?, @PermissionName=?, @GrantedBy=?",
                (user_id, permission_name, granted_by)
            )
            
            success = cursor.rowcount > 0
            
            self.conn.commit()
            cursor.close()
            
            if success:
                logger.info(f"Permission '{permission_name}' granted to user ID: {user_id}")
            else:
                logger.warning(f"Failed to grant permission '{permission_name}' to user ID: {user_id}")
            
            return success
            
        except pyodbc.Error as e:
            logger.error(f"Error granting permission: {e}")
            if self.conn:
                self.conn.rollback()
            return False

    def remove_permission_from_user(self, user_id, permission_name, removed_by):
        """
        Remove a specific permission from a user.
        
        Args:
            user_id (int): The ID of the user to remove permission from
            permission_name (str): The name of the permission to remove
            removed_by (int): The ID of the user removing the permission
            
        Returns:
            bool: True if permission was removed successfully, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            # Check if user exists and is not an admin (can't remove permissions from admins)
            cursor = self.conn.cursor()
            cursor.execute("SELECT UserRole FROM Users WHERE UserID = ?", (user_id,))
            user_role = cursor.fetchone()
            
            if not user_role:
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return False
                
            if user_role.UserRole == 'admin':
                logger.warning(f"Cannot remove permissions from admin user (ID: {user_id})")
                cursor.close()
                return False
                
            # Get permission ID
            cursor.execute("SELECT PermissionID FROM Permissions WHERE PermissionName = ?", (permission_name,))
            permission = cursor.fetchone()
            
            if not permission:
                logger.warning(f"Permission '{permission_name}' does not exist")
                cursor.close()
                return False
                
            permission_id = permission.PermissionID
            
            # Check if user has the permission
            cursor.execute(
                "SELECT 1 FROM UserPermissions WHERE UserID = ? AND PermissionID = ?", 
                (user_id, permission_id)
            )
            
            if not cursor.fetchone():
                logger.warning(f"User ID {user_id} does not have permission '{permission_name}'")
                cursor.close()
                return False
                
            # Remove the permission
            cursor.execute(
                "DELETE FROM UserPermissions WHERE UserID = ? AND PermissionID = ?",
                (user_id, permission_id)
            )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Permission '{permission_name}' removed from user ID: {user_id}")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error removing permission: {e}")
            if self.conn:
                self.conn.rollback()
            return False

    def delete_user(self, user_id):
        """
        Delete a user from the database.
        This will also delete all associated data: conversations, messages, permissions, etc.
        
        Args:
            user_id (int): The ID of the user to delete
            
        Returns:
            bool: True if deletion successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if user exists
            cursor.execute("SELECT UserRole FROM Users WHERE UserID = ?", (user_id,))
            row = cursor.fetchone()
            if not row:
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return False
                
            # Don't allow deletion of the last admin user
            if row.UserRole == 'admin':
                cursor.execute("SELECT COUNT(*) AS AdminCount FROM Users WHERE UserRole = 'admin'")
                admin_count = cursor.fetchone().AdminCount
                if admin_count <= 1:
                    logger.warning("Cannot delete the last admin user")
                    cursor.close()
                    return False
            
            # Delete all associated data first
            cursor.execute("DELETE FROM UserPermissions WHERE UserID = ?", (user_id,))
            cursor.execute("DELETE FROM UserDepartments WHERE UserID = ?", (user_id,))
            cursor.execute("DELETE FROM Messages WHERE SenderType = 'user' AND SenderID = ?", (user_id,))
            cursor.execute("DELETE FROM Conversations WHERE UserID = ?", (user_id,))
            cursor.execute("DELETE FROM Users WHERE UserID = ?", (user_id,))
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"User ID {user_id} deleted successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error deleting user: {e}")
            if self.conn:
                self.conn.rollback()
            return False

    def get_all_permissions(self):
        """
        Get all available permissions in the system.
        
        Returns:
            list: List of all permissions
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            cursor.execute("SELECT * FROM Permissions ORDER BY PermissionName")
            
            # Format results
            permissions = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                permission = dict(zip(columns, row))
                permissions.append(permission)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(permissions)} permissions")
            return permissions
            
        except pyodbc.Error as e:
            logger.error(f"Error getting permissions: {e}")
            return []

    def check_user_has_permission(self, user_id, permission_name):
        """
        Check if a user has a specific permission.
        Admins automatically have all permissions.
        
        Args:
            user_id (int): The ID of the user to check
            permission_name (str): The name of the permission to check
            
        Returns:
            bool: True if user has the permission, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if user is an admin
            cursor.execute("SELECT UserRole FROM Users WHERE UserID = ?", (user_id,))
            user_role = cursor.fetchone()
            
            if not user_role:
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return False
                
            # Admins have all permissions
            if user_role.UserRole == 'admin':
                cursor.close()
                return True
                
            # Check specific permission
            cursor.execute(
                """
                SELECT 1 FROM UserPermissions up
                JOIN Permissions p ON up.PermissionID = p.PermissionID
                WHERE up.UserID = ? AND p.PermissionName = ?
                """,
                (user_id, permission_name)
            )
            
            has_permission = cursor.fetchone() is not None
            
            cursor.close()
            
            return has_permission
            
        except pyodbc.Error as e:
            logger.error(f"Error checking user permission: {e}")
            return False

    def set_user_role(self, user_id, role, updated_by):
        """
        Set a user's role.
        Admin role grants all permissions automatically.
        
        Args:
            user_id (int): The ID of the user to update
            role (str): The new role, either 'admin' or 'user'
            updated_by (int): The ID of the user making this change
            
        Returns:
            bool: True if role was updated successfully, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            # Validate role
            if role not in ['admin', 'user']:
                logger.warning(f"Invalid role: {role}. Must be 'admin' or 'user'")
                return False
                
            cursor = self.conn.cursor()
            
            # Check if user exists
            cursor.execute("SELECT UserRole FROM Users WHERE UserID = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return False
                
            # Update role
            cursor.execute(
                "UPDATE Users SET UserRole = ?, LastUpdatedAt = GETDATE() WHERE UserID = ?",
                (role, user_id)
            )
            
            # If role is 'admin', grant all permissions
            if role == 'admin':
                # Find the 'full_admin' permission
                cursor.execute("SELECT PermissionID FROM Permissions WHERE PermissionName = 'full_admin'")
                admin_permission = cursor.fetchone()
                
                if admin_permission:
                    # Check if user already has this permission
                    cursor.execute(
                        "SELECT 1 FROM UserPermissions WHERE UserID = ? AND PermissionID = ?",
                        (user_id, admin_permission.PermissionID)
                    )
                    
                    if not cursor.fetchone():
                        # Grant full_admin permission
                        cursor.execute(
                            "INSERT INTO UserPermissions (UserID, PermissionID, GrantedBy) VALUES (?, ?, ?)",
                            (user_id, admin_permission.PermissionID, updated_by)
                        )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"User ID {user_id} role updated to '{role}'")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error setting user role: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    # Department Management Functions
    def create_department(self, name, description=None):
        """
        Create a new department in the database.
        
        Args:
            name (str): The name of the department
            description (str, optional): A description of the department
            
        Returns:
            int: The ID of the newly created department, or None if failed
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Insert department
            cursor.execute(
                "INSERT INTO Departments (Name, Description) VALUES (?, ?)",
                (name, description)
            )
            
            # Get the department ID from the inserted row
            department_id = cursor.execute("SELECT DepartmentID FROM Departments WHERE Name = ?", (name,)).fetchval()
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Department '{name}' created successfully with ID: {department_id}")
            return department_id
            
        except pyodbc.Error as e:
            logger.error(f"Error creating department: {e}")
            if self.conn:
                self.conn.rollback()
            return None
            
    def get_department(self, department_id):
        """
        Get department details by ID.
        
        Args:
            department_id (int): The ID of the department to retrieve
            
        Returns:
            dict: Department details, or None if not found
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Get department information
            cursor.execute("SELECT * FROM Departments WHERE DepartmentID = ?", (department_id,))
            
            row = cursor.fetchone()
            if not row:
                logger.warning(f"Department ID {department_id} not found")
                cursor.close()
                return None
                
            # Convert to dictionary
            columns = [column[0] for column in cursor.description]
            department = dict(zip(columns, row))
            
            # Get user count
            cursor.execute(
                "SELECT COUNT(*) AS UserCount FROM UserDepartments WHERE DepartmentID = ?", 
                (department_id,)
            )
            count_row = cursor.fetchone()
            department['UserCount'] = count_row.UserCount if count_row else 0
            
            cursor.close()
            logger.info(f"Retrieved details for department ID: {department_id}")
            return department
            
        except pyodbc.Error as e:
            logger.error(f"Error getting department details: {e}")
            return None
            
    def update_department(self, department_id, name=None, description=None):
        """
        Update department details.
        
        Args:
            department_id (int): The ID of the department to update
            name (str, optional): New department name
            description (str, optional): New department description
            
        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            # Check which fields are being updated
            update_fields = []
            update_values = []
            
            if name is not None:
                update_fields.append("Name = ?")
                update_values.append(name)
                
            if description is not None:
                update_fields.append("Description = ?")
                update_values.append(description)
                
            if not update_fields:
                logger.warning("No fields provided for department update")
                return False
                
            # Add LastUpdatedAt
            update_fields.append("LastUpdatedAt = GETDATE()")
            
            # Build and execute query
            cursor = self.conn.cursor()
            query = f"UPDATE Departments SET {', '.join(update_fields)} WHERE DepartmentID = ?"
            update_values.append(department_id)
            
            cursor.execute(query, update_values)
            
            if cursor.rowcount == 0:
                logger.warning(f"Department ID {department_id} not found")
                self.conn.rollback()
                cursor.close()
                return False
                
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Department ID {department_id} updated successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error updating department: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def delete_department(self, department_id):
        """
        Delete a department from the database.
        
        Args:
            department_id (int): The ID of the department to delete
            
        Returns:
            bool: True if deletion successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if department exists
            cursor.execute("SELECT 1 FROM Departments WHERE DepartmentID = ?", (department_id,))
            if not cursor.fetchone():
                logger.warning(f"Department ID {department_id} not found")
                cursor.close()
                return False
                
            # Delete the department (cascades to UserDepartments)
            cursor.execute("DELETE FROM Departments WHERE DepartmentID = ?", (department_id,))
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Department ID {department_id} deleted successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error deleting department: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def get_all_departments(self):
        """
        Get all departments in the database, including user and knowledge base counts.
        
        Returns:
            list: List of all departments with user and knowledge base counts
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            cursor.execute("""
                SELECT d.*, 
                       (SELECT COUNT(*) FROM UserDepartments WHERE DepartmentID = d.DepartmentID) AS UserCount,
                       (SELECT COUNT(*) FROM KnowledgeBases WHERE DepartmentID = d.DepartmentID) AS KnowledgeBaseCount
                FROM Departments d
                ORDER BY d.Name
            """)
            
            # Format results
            departments = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                department = dict(zip(columns, row))
                departments.append(department)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(departments)} departments with user and knowledge base counts")
            return departments
            
        except pyodbc.Error as e:
            logger.error(f"Error getting departments: {e}")
            return []
            
    def get_all_user_details(self):
        """Get detailed information for all users including their departments and permissions."""
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Get all users with basic information and counts
            cursor.execute(
                """
                SELECT u.*, 
                       (SELECT COUNT(*) FROM Conversations WHERE UserID = u.UserID) AS ConversationCount,
                       (SELECT COUNT(*) FROM UserPermissions WHERE UserID = u.UserID) AS PermissionCount
                FROM Users u 
                ORDER BY u.Username
                """
            )
            
            users = []
            user_columns = [column[0] for column in cursor.description]
            
            # Process each user
            for user_row in cursor.fetchall():
                # Convert to dictionary
                user = dict(zip(user_columns, user_row))
                user_id = user["UserID"]
                
                # Get user departments
                cursor.execute(
                    """
                    SELECT d.* 
                    FROM Departments d
                    JOIN UserDepartments ud ON d.DepartmentID = ud.DepartmentID
                    WHERE ud.UserID = ?
                    """, 
                    (user_id,)
                )
                
                departments = []
                dept_columns = [column[0] for column in cursor.description]
                for dept_row in cursor.fetchall():
                    department = dict(zip(dept_columns, dept_row))
                    departments.append(department)
                    
                user['departments'] = departments
                
                # Get user permissions
                cursor.execute(
                    """
                    SELECT p.PermissionID, p.PermissionName, p.Description, 
                           up.GrantedAt, u.Username AS GrantedByUsername
                    FROM UserPermissions up
                    JOIN Permissions p ON up.PermissionID = p.PermissionID
                    JOIN Users u ON up.GrantedBy = u.UserID
                    WHERE up.UserID = ?
                    """, 
                    (user_id,)
                )
                
                permissions = []
                perm_columns = [column[0] for column in cursor.description]
                for perm_row in cursor.fetchall():
                    permission = dict(zip(perm_columns, perm_row))
                    permissions.append(permission)
                    
                user['permissions'] = permissions
                
                users.append(user)
            
            cursor.close()
            logger.info(f"Retrieved details for {len(users)} users")
            return users
            
        except pyodbc.Error as e:
            logger.error(f"Error getting all user details: {e}")
            return []
            
    def add_user_to_department(self, user_id, department_id):
        """
        Add a user to a department.
        
        Args:
            user_id (int): The ID of the user
            department_id (int): The ID of the department
            
        Returns:
            bool: True if added successfully, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if user exists
            cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (user_id,))
            if not cursor.fetchone():
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return False
                
            # Check if department exists
            cursor.execute("SELECT 1 FROM Departments WHERE DepartmentID = ?", (department_id,))
            if not cursor.fetchone():
                logger.warning(f"Department ID {department_id} not found")
                cursor.close()
                return False
                
            # Check if user is already in department
            cursor.execute(
                "SELECT 1 FROM UserDepartments WHERE UserID = ? AND DepartmentID = ?",
                (user_id, department_id)
            )
            if cursor.fetchone():
                logger.info(f"User ID {user_id} is already in Department ID {department_id}")
                cursor.close()
                return True
                
            # Add user to department
            cursor.execute(
                "INSERT INTO UserDepartments (UserID, DepartmentID) VALUES (?, ?)",
                (user_id, department_id)
            )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"User ID {user_id} added to Department ID {department_id}")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error adding user to department: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def remove_user_from_department(self, user_id, department_id):
        """
        Remove a user from a department.
        
        Args:
            user_id (int): The ID of the user
            department_id (int): The ID of the department
            
        Returns:
            bool: True if removed successfully, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Remove user from department
            cursor.execute(
                "DELETE FROM UserDepartments WHERE UserID = ? AND DepartmentID = ?",
                (user_id, department_id)
            )
            
            if cursor.rowcount == 0:
                logger.warning(f"User ID {user_id} not found in Department ID {department_id}")
                cursor.close()
                return False
                
            self.conn.commit()
            cursor.close()
            
            logger.info(f"User ID {user_id} removed from Department ID {department_id}")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error removing user from department: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def get_department_users(self, department_id):
        """
        Get all users in a department.
        
        Args:
            department_id (int): The ID of the department
            
        Returns:
            list: List of users in the department
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if department exists
            cursor.execute("SELECT 1 FROM Departments WHERE DepartmentID = ?", (department_id,))
            if not cursor.fetchone():
                logger.warning(f"Department ID {department_id} not found")
                cursor.close()
                return []
                
            # Get users in the department
            cursor.execute("""
                SELECT u.UserID, u.Username, u.Email, u.FirstName, u.LastName, u.UserRole, u.IsActive
                FROM Users u
                JOIN UserDepartments ud ON u.UserID = ud.UserID
                WHERE ud.DepartmentID = ?
                ORDER BY u.Username
            """, (department_id,))
            
            # Format results
            users = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                user = dict(zip(columns, row))
                users.append(user)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(users)} users for Department ID {department_id}")
            return users
            
        except pyodbc.Error as e:
            logger.error(f"Error getting department users: {e}")
            return []
            
    # Agent Management Functions
    def create_agent(self, agent_key, name, description=None, configuration=None, is_active=True, department_id=None, is_global=False):
        """
        Create a new AI agent in the database.
        
        Args:
            agent_key (str): Unique key for the agent (e.g., 'general', 'code')
            name (str): Display name for the agent
            description (str, optional): Agent description
            configuration (str, optional): JSON configuration string
            is_active (bool, optional): Whether the agent is active
            department_id (int, optional): Department this agent belongs to
            is_global (bool, optional): Whether this agent is available across departments
            
        Returns:
            int: The ID of the newly created agent, or None if failed
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if agent_key already exists
            cursor.execute("SELECT 1 FROM Agents WHERE AgentKey = ?", (agent_key,))
            if cursor.fetchone():
                logger.warning(f"Agent with key '{agent_key}' already exists")
                cursor.close()
                return None
                
            # If department_id provided, check it exists
            if department_id:
                cursor.execute("SELECT 1 FROM Departments WHERE DepartmentID = ?", (department_id,))
                if not cursor.fetchone():
                    logger.warning(f"Department ID {department_id} not found")
                    cursor.close()
                    return None
            
            # Insert agent
            cursor.execute(
                """
                INSERT INTO Agents (AgentKey, Name, Description, Configuration, IsActive, DepartmentID, IsGlobal)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (agent_key, name, description, configuration, 1 if is_active else 0, department_id, 1 if is_global else 0)
            )
            
            # Get the agent ID
            agent_id = cursor.execute("SELECT AgentID FROM Agents WHERE AgentKey = ?", (agent_key,)).fetchval()
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Agent '{name}' created successfully with ID: {agent_id}")
            return agent_id
            
        except pyodbc.Error as e:
            logger.error(f"Error creating agent: {e}")
            if self.conn:
                self.conn.rollback()
            return None
            
    def get_agent(self, agent_id=None, agent_key=None):
        """
        Get agent details by ID or key.
        
        Args:
            agent_id (int, optional): The ID of the agent to retrieve
            agent_key (str, optional): The unique key of the agent to retrieve
            
        Returns:
            dict: Agent details, or None if not found
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            if agent_id:
                # Get agent by ID
                cursor.execute("SELECT * FROM Agents WHERE AgentID = ?", (agent_id,))
            elif agent_key:
                # Get agent by key
                cursor.execute("SELECT * FROM Agents WHERE AgentKey = ?", (agent_key,))
            else:
                logger.warning("Either agent_id or agent_key must be provided")
                cursor.close()
                return None
                
            row = cursor.fetchone()
            if not row:
                id_or_key = agent_id if agent_id else agent_key
                logger.warning(f"Agent with ID/key {id_or_key} not found")
                cursor.close()
                return None
                
            # Convert to dictionary
            columns = [column[0] for column in cursor.description]
            agent = dict(zip(columns, row))
            
            # Get department name if applicable
            if agent.get('DepartmentID'):
                cursor.execute(
                    "SELECT Name FROM Departments WHERE DepartmentID = ?", 
                    (agent['DepartmentID'],)
                )
                dept_row = cursor.fetchone()
                if dept_row:
                    agent['DepartmentName'] = dept_row.Name
            
            cursor.close()
            logger.info(f"Retrieved details for agent ID: {agent.get('AgentID')}")
            return agent
            
        except pyodbc.Error as e:
            logger.error(f"Error getting agent details: {e}")
            return None
            
    def update_agent(self, agent_id, **kwargs):
        """
        Update agent details.
        
        Args:
            agent_id (int): The ID of the agent to update
            **kwargs: Key-value pairs for fields to update.
                      Possible keys: name, description, configuration, 
                      is_active, department_id, is_global
            
        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            # Check if agent exists
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1 FROM Agents WHERE AgentID = ?", (agent_id,))
            if not cursor.fetchone():
                logger.warning(f"Agent ID {agent_id} not found")
                cursor.close()
                return False
                
            # If department_id provided, check it exists
            if 'department_id' in kwargs and kwargs['department_id']:
                cursor.execute("SELECT 1 FROM Departments WHERE DepartmentID = ?", (kwargs['department_id'],))
                if not cursor.fetchone():
                    logger.warning(f"Department ID {kwargs['department_id']} not found")
                    cursor.close()
                    return False
            
            # Map Python variable names to database column names
            field_mapping = {
                'name': 'Name',
                'description': 'Description',
                'configuration': 'Configuration',
                'is_active': 'IsActive',
                'department_id': 'DepartmentID',
                'is_global': 'IsGlobal',
                'agent_key': 'AgentKey'
            }
            
            # Build update query
            update_parts = []
            update_values = []
            
            for field, value in kwargs.items():
                if field in field_mapping:
                    # Special handling for boolean values
                    if field in ['is_active', 'is_global']:
                        value = 1 if value else 0
                        
                    update_parts.append(f"{field_mapping[field]} = ?")
                    update_values.append(value)
            
            if not update_parts:
                logger.warning("No valid fields provided for agent update")
                cursor.close()
                return False
                
            # Add LastUpdatedAt
            update_parts.append("LastUpdatedAt = GETDATE()")
            
            # Complete the query
            query = f"UPDATE Agents SET {', '.join(update_parts)} WHERE AgentID = ?"
            update_values.append(agent_id)
            
            # Execute the update
            cursor.execute(query, update_values)
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Agent ID {agent_id} updated successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error updating agent: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def delete_agent(self, agent_id):
        """
        Delete an agent from the database.
        
        Args:
            agent_id (int): The ID of the agent to delete
            
        Returns:
            bool: True if deletion successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if agent exists
            cursor.execute("SELECT 1 FROM Agents WHERE AgentID = ?", (agent_id,))
            if not cursor.fetchone():
                logger.warning(f"Agent ID {agent_id} not found")
                cursor.close()
                return False
                
            # # Check if agent is referenced by other tables (like Messages)
            # cursor.execute("SELECT COUNT(*) AS MessageCount FROM Messages WHERE AgentID = ?", (agent_id,))
            # message_count = cursor.fetchone().MessageCount
            
            # if message_count > 0:
            #     logger.warning(f"Agent ID {agent_id} has {message_count} messages using it. Cannot delete.")
            #     cursor.close()
            #     return False
                
            # Delete the agent (cascades to AgentKnowledgeBases and SharedAgents)
            cursor.execute("DELETE FROM Agents WHERE AgentID = ?", (agent_id,))
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Agent ID {agent_id} deleted successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error deleting agent: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def get_all_agents(self, department_id=None, include_global=True, active_only=True):
        """
        Get all agents, optionally filtered by department, global status, and active status.
        
        Args:
            department_id (int, optional): Filter by department ID
            include_global (bool): Include global agents (default True)
            active_only (bool): Only include active agents (default True)
            
        Returns:
            list: List of agents
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            query = """
                SELECT a.*, d.Name AS DepartmentName
                FROM Agents a
                LEFT JOIN Departments d ON a.DepartmentID = d.DepartmentID
                WHERE 1=1
            """
            params = []
            
            if active_only:
                query += " AND a.IsActive = 1"
                
            if department_id is not None:
                if isinstance(department_id, list):
                    # Handle list of department IDs
                    print("Department ID is a list")
                    if include_global:
                        query += " AND (a.DepartmentID IN ({}) OR a.IsGlobal = 1)".format(','.join(['?' for _ in department_id]))
                        params.extend(department_id)
                    else:
                        query += " AND a.DepartmentID IN ({})".format(','.join(['?' for _ in department_id]))
                        params.extend(department_id)
                else:
                    # Handle single department ID
                    print("Department ID is a single value")
                    if include_global:
                        query += " AND (a.DepartmentID = ? OR a.IsGlobal = 1)"
                        params.append(department_id)
                    else:
                        query += " AND a.DepartmentID = ?"
                        params.append(department_id)
            elif not include_global:
                query += " AND a.IsGlobal = 0"
                
            query += " ORDER BY a.Name"
            
            cursor.execute(query, params)
            
            # Format results
            agents = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                agent = dict(zip(columns, row))
                agents.append(agent)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(agents)} agents")
            return agents
            
        except pyodbc.Error as e:
            logger.error(f"Error getting agents: {e}")
            return []
            
    def link_agent_to_knowledge_base(self, agent_id, knowledge_base_id):
        """
        Link an agent to a knowledge base.
        
        Args:
            agent_id (int): The ID of the agent
            knowledge_base_id (int): The ID of the knowledge base
            
        Returns:
            bool: True if linked successfully, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if agent exists
            cursor.execute("SELECT 1 FROM Agents WHERE AgentID = ?", (agent_id,))
            if not cursor.fetchone():
                logger.warning(f"Agent ID {agent_id} not found")
                cursor.close()
                return False
                
            # Check if knowledge base exists
            cursor.execute("SELECT 1 FROM KnowledgeBases WHERE KnowledgeBaseID = ?", (knowledge_base_id,))
            if not cursor.fetchone():
                logger.warning(f"Knowledge Base ID {knowledge_base_id} not found")
                cursor.close()
                return False
                
            # Check if link already exists
            cursor.execute(
                "SELECT 1 FROM AgentKnowledgeBases WHERE AgentID = ? AND KnowledgeBaseID = ?",
                (agent_id, knowledge_base_id)
            )
            if cursor.fetchone():
                logger.info(f"Agent ID {agent_id} is already linked to Knowledge Base ID {knowledge_base_id}")
                cursor.close()
                return True
                
            # Create the link
            cursor.execute(
                "INSERT INTO AgentKnowledgeBases (AgentID, KnowledgeBaseID) VALUES (?, ?)",
                (agent_id, knowledge_base_id)
            )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Linked Agent ID {agent_id} to Knowledge Base ID {knowledge_base_id}")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error linking agent to knowledge base: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def unlink_agent_from_knowledge_base(self, agent_id, knowledge_base_id):
        """
        Unlink an agent from a knowledge base.
        
        Args:
            agent_id (int): The ID of the agent
            knowledge_base_id (int): The ID of the knowledge base
            
        Returns:
            bool: True if unlinked successfully, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Remove the link
            cursor.execute(
                "DELETE FROM AgentKnowledgeBases WHERE AgentID = ? AND KnowledgeBaseID = ?",
                (agent_id, knowledge_base_id)
            )
            
            if cursor.rowcount == 0:
                logger.warning(
                    f"No link found between Agent ID {agent_id} and Knowledge Base ID {knowledge_base_id}"
                )
                cursor.close()
                return False
                
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Unlinked Agent ID {agent_id} from Knowledge Base ID {knowledge_base_id}")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error unlinking agent from knowledge base: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def get_agent_knowledge_bases(self, agent_id):
        """
        Get all knowledge bases linked to an agent.
        
        Args:
            agent_id (int): The ID of the agent
            
        Returns:
            list: List of knowledge bases linked to the agent
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if agent exists
            cursor.execute("SELECT 1 FROM Agents WHERE AgentID = ?", (agent_id,))
            if not cursor.fetchone():
                logger.warning(f"Agent ID {agent_id} not found")
                cursor.close()
                return []
                
            # Get knowledge bases linked to agent
            cursor.execute("""
                SELECT kb.*, u.Username AS OwnerName, d.Name AS DepartmentName
                FROM KnowledgeBases kb
                JOIN AgentKnowledgeBases akb ON kb.KnowledgeBaseID = akb.KnowledgeBaseID
                LEFT JOIN Users u ON kb.OwnerID = u.UserID
                LEFT JOIN Departments d ON kb.DepartmentID = d.DepartmentID
                WHERE akb.AgentID = ?
                ORDER BY kb.Name
            """, (agent_id,))
            
            # Format results
            knowledge_bases = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                kb = dict(zip(columns, row))
                knowledge_bases.append(kb)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(knowledge_bases)} knowledge bases for Agent ID {agent_id}")
            return knowledge_bases
            
        except pyodbc.Error as e:
            logger.error(f"Error getting agent knowledge bases: {e}")
            return []
            
    # Knowledge Base Management Functions
    def create_knowledge_base(self, name, description=None, owner_id=None, department_id=None, is_public=False, is_global=False):
        """
        Create a new knowledge base in the database.
        
        Args:
            name (str): Name of the knowledge base
            description (str, optional): Description of the knowledge base
            owner_id (int, optional): UserID of the owner
            department_id (int, optional): DepartmentID this knowledge base belongs to
            is_public (bool): Whether this knowledge base is accessible by all users in the department
            is_global (bool): Whether this knowledge base is accessible across departments
            
        Returns:
            int: The ID of the newly created knowledge base, or None if failed
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if owner exists if provided
            if owner_id:
                cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (owner_id,))
                if not cursor.fetchone():
                    logger.warning(f"Owner User ID {owner_id} not found")
                    cursor.close()
                    return None
            
            # Check if department exists if provided
            if department_id:
                cursor.execute("SELECT 1 FROM Departments WHERE DepartmentID = ?", (department_id,))
                if not cursor.fetchone():
                    logger.warning(f"Department ID {department_id} not found")
                    cursor.close()
                    return None
            
            # Insert knowledge base
            cursor.execute(
                """
                INSERT INTO KnowledgeBases (Name, Description, OwnerID, DepartmentID, IsPublic, IsGlobal)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (name, description, owner_id, department_id, 1 if is_public else 0, 1 if is_global else 0)
            )
            
            # Commit the insert first
            self.conn.commit()

            # Get the knowledge base ID using SELECT
            cursor.execute(
                "SELECT KnowledgeBaseID FROM KnowledgeBases WHERE Name = ? ORDER BY CreatedAt DESC",
                (name,)
            )
            kb_id = cursor.fetchone()[0]
            
            cursor.close()
            
            logger.info(f"Knowledge Base '{name}' created successfully with ID: {kb_id}")
            return kb_id
            
        except pyodbc.Error as e:
            logger.error(f"Error creating knowledge base: {e}")
            if self.conn:
                self.conn.rollback()
            return None
            
    def get_knowledge_base(self, knowledge_base_id):
        """
        Get knowledge base details by ID.
        
        Args:
            knowledge_base_id (int): The ID of the knowledge base to retrieve
            
        Returns:
            dict: Knowledge base details, or None if not found
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Get knowledge base information
            cursor.execute("""
                SELECT kb.*, u.Username AS OwnerName, d.Name AS DepartmentName, d.DepartmentID,
                       (SELECT COUNT(*) FROM KnowledgeDocuments WHERE KnowledgeBaseID = kb.KnowledgeBaseID) AS DocumentCount,
                       (SELECT COUNT(DISTINCT DepartmentID) FROM Users u2 
                        JOIN UserDepartments ud ON u2.UserID = ud.UserID 
                        WHERE u2.UserID = kb.OwnerID) AS OwnerDepartmentCount
                FROM KnowledgeBases kb
                LEFT JOIN Users u ON kb.OwnerID = u.UserID 
                LEFT JOIN Departments d ON kb.DepartmentID = d.DepartmentID
                WHERE kb.KnowledgeBaseID = ?
            """, (knowledge_base_id,))
            
            row = cursor.fetchone()
            if not row:
                logger.warning(f"Knowledge Base ID {knowledge_base_id} not found")
                cursor.close()
                return None
                
            # Convert to dictionary
            columns = [column[0] for column in cursor.description]
            kb = dict(zip(columns, row))
            print(kb)
            cursor.close()
            logger.info(f"Retrieved details for Knowledge Base ID: {knowledge_base_id}")
            return kb
            
        except pyodbc.Error as e:
            logger.error(f"Error getting knowledge base details: {e}")
            return None
            
    def update_knowledge_base(self, knowledge_base_id, **kwargs):
        """
        Update knowledge base details.
        
        Args:
            knowledge_base_id (int): The ID of the knowledge base to update
            **kwargs: Key-value pairs for fields to update.
                      Possible keys: name, description, owner_id, 
                      department_id, is_public, is_global
            
        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            # Check if knowledge base exists
            cursor = self.conn.cursor()
            cursor.execute("SELECT 1 FROM KnowledgeBases WHERE KnowledgeBaseID = ?", (knowledge_base_id,))
            if not cursor.fetchone():
                logger.warning(f"Knowledge Base ID {knowledge_base_id} not found")
                cursor.close()
                return False
                
            # Check if owner exists if provided
            if 'owner_id' in kwargs and kwargs['owner_id']:
                cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (kwargs['owner_id'],))
                if not cursor.fetchone():
                    logger.warning(f"Owner User ID {kwargs['owner_id']} not found")
                    cursor.close()
                    return False
            
            # Check if department exists if provided
            if 'department_id' in kwargs and kwargs['department_id']:
                cursor.execute("SELECT 1 FROM Departments WHERE DepartmentID = ?", (kwargs['department_id'],))
                if not cursor.fetchone():
                    logger.warning(f"Department ID {kwargs['department_id']} not found")
                    cursor.close()
                    return False
            
            # Map Python variable names to database column names
            field_mapping = {
                'name': 'Name',
                'description': 'Description',
                'owner_id': 'OwnerID',
                'department_id': 'DepartmentID',
                'is_public': 'IsPublic',
                'is_global': 'IsGlobal'
            }
            
            # Build update query
            update_parts = []
            update_values = []
            
            for field, value in kwargs.items():
                if field in field_mapping:
                    # Special handling for boolean values
                    if field in ['is_public', 'is_global']:
                        value = 1 if value else 0
                        
                    update_parts.append(f"{field_mapping[field]} = ?")
                    update_values.append(value)
            
            if not update_parts:
                logger.warning("No valid fields provided for knowledge base update")
                cursor.close()
                return False
                
            # Add LastUpdatedAt
            update_parts.append("LastUpdatedAt = GETDATE()")
            
            # Complete the query
            query = f"UPDATE KnowledgeBases SET {', '.join(update_parts)} WHERE KnowledgeBaseID = ?"
            update_values.append(knowledge_base_id)
            
            # Execute the update
            cursor.execute(query, update_values)
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Knowledge Base ID {knowledge_base_id} updated successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error updating knowledge base: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def delete_knowledge_base(self, knowledge_base_id):
        """
        Delete a knowledge base from the database.
        
        Args:
            knowledge_base_id (int): The ID of the knowledge base to delete
            
        Returns:
            bool: True if deletion successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if knowledge base exists
            cursor.execute("SELECT 1 FROM KnowledgeBases WHERE KnowledgeBaseID = ?", (knowledge_base_id,))
            if not cursor.fetchone():
                logger.warning(f"Knowledge Base ID {knowledge_base_id} not found")
                cursor.close()
                return False
                
            # Delete the knowledge base (cascades to KnowledgeDocuments and AgentKnowledgeBases)
            cursor.execute("DELETE FROM KnowledgeBases WHERE KnowledgeBaseID = ?", (knowledge_base_id,))
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Knowledge Base ID {knowledge_base_id} deleted successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error deleting knowledge base: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def get_all_knowledge_bases(self, user_id=None, department_id=None):
        """
        Get all knowledge bases accessible by a user.
        If user_id is provided, uses the stored procedure GetUserAccessibleKnowledgeBases.
        
        Args:
            user_id (int, optional): The ID of the user to check access for
            department_id (int, optional): Filter by department ID
            
        Returns:
            list: List of accessible knowledge bases
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            if user_id:
                # Use stored procedure to get knowledge bases accessible by user
                cursor.execute("EXEC GetUserAccessibleKnowledgeBases @UserID = ?", (user_id,))
            else:
                # Get all knowledge bases, optionally filtered by department
                query = """
                    SELECT kb.*, u.Username AS OwnerName, d.Name AS DepartmentName,
                           (SELECT COUNT(*) FROM KnowledgeDocuments WHERE KnowledgeBaseID = kb.KnowledgeBaseID) AS DocumentCount
                    FROM KnowledgeBases kb
                    LEFT JOIN Users u ON kb.OwnerID = u.UserID
                    LEFT JOIN Departments d ON kb.DepartmentID = d.DepartmentID
                """
                
                if department_id:
                    query += " WHERE kb.DepartmentID = ? OR kb.IsGlobal = 1"
                    cursor.execute(query, (department_id,))
                else:
                    cursor.execute(query)
            
            # Format results
            knowledge_bases = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                kb = dict(zip(columns, row))
                knowledge_bases.append(kb)
            
            cursor.close()
            
            filter_desc = ""
            if user_id:
                filter_desc = f" accessible by User ID {user_id}"
            if department_id:
                filter_desc += f" in Department ID {department_id}"
                
            logger.info(f"Retrieved {len(knowledge_bases)} knowledge bases{filter_desc}")
            return knowledge_bases
            
        except pyodbc.Error as e:
            logger.error(f"Error getting knowledge bases: {e}")
            return []
            
    def add_document_to_knowledge_base(self, knowledge_base_id, title, content=None, file_url=None, file_type=None):
        """
        Add a document to a knowledge base.
        
        Args:
            knowledge_base_id (int): The ID of the knowledge base
            title (str): Title of the document
            content (str, optional): Text content of the document
            file_url (str, optional): URL to the document file
            file_type (str, optional): Type of the document file
            
        Returns:
            int: The ID of the newly created document, or None if failed
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if knowledge base exists
            cursor.execute("SELECT 1 FROM KnowledgeBases WHERE KnowledgeBaseID = ?", (knowledge_base_id,))
            if not cursor.fetchone():
                logger.warning(f"Knowledge Base ID {knowledge_base_id} not found")
                cursor.close()
                return None
                
            # Check that either content or file_url is provided
            if content is None and file_url is None:
                logger.warning("Either content or file_url must be provided")
                cursor.close()
                return None
                
            # Insert document
            cursor.execute(
                """
                INSERT INTO KnowledgeDocuments (KnowledgeBaseID, Title, Content, FileURL, FileType, IsProcessed)
                VALUES (?, ?, ?, ?, ?, 1)
                """,
                (knowledge_base_id, title, content, file_url, file_type)
            )
            
            self.conn.commit()

            # Get the document ID in a separate query
            cursor.execute(
                """
                SELECT DocumentID 
                FROM KnowledgeDocuments 
                WHERE KnowledgeBaseID = ? AND Title = ? 
                ORDER BY CreatedAt DESC
                """, 
                (knowledge_base_id, title)
            )
            document_id = cursor.fetchone()[0]
            
            # Update knowledge base LastUpdatedAt
            cursor.execute(
                "UPDATE KnowledgeBases SET LastUpdatedAt = GETDATE() WHERE KnowledgeBaseID = ?",
                (knowledge_base_id,)
            )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Document '{title}' added to Knowledge Base ID {knowledge_base_id} with ID: {document_id}")
            return document_id
            
        except pyodbc.Error as e:
            logger.error(f"Error adding document to knowledge base: {e}")
            if self.conn:
                self.conn.rollback()
            return None
            
    def update_document(self, document_id, **kwargs):
        """
        Update a document in a knowledge base.
        
        Args:
            document_id (int): The ID of the document to update
            **kwargs: Key-value pairs for fields to update.
                     Possible keys: title, content, file_url, file_type, is_processed
            
        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if document exists
            cursor.execute("SELECT KnowledgeBaseID FROM KnowledgeDocuments WHERE DocumentID = ?", (document_id,))
            row = cursor.fetchone()
            if not row:
                logger.warning(f"Document ID {document_id} not found")
                cursor.close()
                return False
                
            knowledge_base_id = row.KnowledgeBaseID
            
            # Map Python variable names to database column names
            field_mapping = {
                'title': 'Title',
                'content': 'Content',
                'file_url': 'FileURL',
                'file_type': 'FileType',
                'is_processed': 'IsProcessed'
            }
            
            # Build update query
            update_parts = []
            update_values = []
            
            for field, value in kwargs.items():
                if field in field_mapping:
                    # Special handling for boolean values
                    if field == 'is_processed':
                        value = 1 if value else 0
                        
                    update_parts.append(f"{field_mapping[field]} = ?")
                    update_values.append(value)
            
            if not update_parts:
                logger.warning("No valid fields provided for document update")
                cursor.close()
                return False
                
            # Add LastUpdatedAt
            update_parts.append("LastUpdatedAt = GETDATE()")
            
            # Complete the query
            query = f"UPDATE KnowledgeDocuments SET {', '.join(update_parts)} WHERE DocumentID = ?"
            update_values.append(document_id)
            
            # Execute the update
            cursor.execute(query, update_values)
            
            # Update knowledge base LastUpdatedAt
            cursor.execute(
                "UPDATE KnowledgeBases SET LastUpdatedAt = GETDATE() WHERE KnowledgeBaseID = ?",
                (knowledge_base_id,)
            )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Document ID {document_id} updated successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error updating document: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def delete_document(self, document_id):
        """
        Delete a document from a knowledge base.
        
        Args:
            document_id (int): The ID of the document to delete
            
        Returns:
            bool: True if deletion successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if document exists
            cursor.execute("SELECT KnowledgeBaseID FROM KnowledgeDocuments WHERE DocumentID = ?", (document_id,))
            row = cursor.fetchone()
            if not row:
                logger.warning(f"Document ID {document_id} not found")
                cursor.close()
                return False
                
            knowledge_base_id = row.KnowledgeBaseID
            
            # Delete the document
            cursor.execute("DELETE FROM KnowledgeDocuments WHERE DocumentID = ?", (document_id,))
            
            # Update knowledge base LastUpdatedAt
            cursor.execute(
                "UPDATE KnowledgeBases SET LastUpdatedAt = GETDATE() WHERE KnowledgeBaseID = ?",
                (knowledge_base_id,)
            )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Document ID {document_id} deleted successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error deleting document: {e}")
            if self.conn:
                self.conn.rollback()
            return False
            
    def get_documents_in_knowledge_base(self, knowledge_base_id):
        """
        Get all documents in a knowledge base.
        
        Args:
            knowledge_base_id (int): The ID of the knowledge base
            
        Returns:
            list: List of documents in the knowledge base
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if knowledge base exists
            cursor.execute("SELECT 1 FROM KnowledgeBases WHERE KnowledgeBaseID = ?", (knowledge_base_id,))
            if not cursor.fetchone():
                logger.warning(f"Knowledge Base ID {knowledge_base_id} not found")
                cursor.close()
                return []
                
            # Get documents
            cursor.execute(
                "SELECT * FROM KnowledgeDocuments WHERE KnowledgeBaseID = ? ORDER BY Title",
                (knowledge_base_id,)
            )
            
            # Format results
            documents = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                document = dict(zip(columns, row))
                documents.append(document)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(documents)} documents from Knowledge Base ID {knowledge_base_id}")
            return documents
            
        except pyodbc.Error as e:
            logger.error(f"Error getting documents: {e}")
            return []
            
    def get_document(self, document_id):
        """
        Get document details by ID.
        
        Args:
            document_id (int): The ID of the document to retrieve
            
        Returns:
            dict: Document details, or None if not found
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Get document information
            cursor.execute("SELECT * FROM KnowledgeDocuments WHERE DocumentID = ?", (document_id,))
            
            row = cursor.fetchone()
            if not row:
                logger.warning(f"Document ID {document_id} not found")
                cursor.close()
                return None
                
            # Convert to dictionary
            columns = [column[0] for column in cursor.description]
            document = dict(zip(columns, row))
            
            cursor.close()
            logger.info(f"Retrieved details for Document ID: {document_id}")
            return document
            
        except pyodbc.Error as e:
            logger.error(f"Error getting document details: {e}")
            return None
    
    # Conversation Management Functions
    def create_conversation(self, user_id, title=None, department_id=None):
        """
        Create a new conversation using the stored procedure.
        
        Args:
            user_id (int): The ID of the user who owns the conversation
            title (str, optional): Title of the conversation
            department_id (int, optional): Department this conversation belongs to
        
        Returns:
            int: The ID of the newly created conversation, or None if failed    
        
        """
        try:
            logger.info("Starting create_conversation")
            logger.info(f"Parameters - user_id: {user_id}, title: {title}, department_id: {department_id}")

            if not self.conn:
                logger.info("No connection found, connecting to database")
                self.Conn_Sql()
            
            cursor = self.conn.cursor()
            logger.info("Created cursor")
            
            # Check if user exists
            logger.info(f"Checking if user {user_id} exists")
            cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (user_id,))
            if not cursor.fetchone():
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return None
            logger.info("User found")
            
            # If department_id provided, check it exists    
            if department_id:
                logger.info(f"Checking if department {department_id} exists")
                cursor.execute("SELECT 1 FROM Departments WHERE DepartmentID = ?", (department_id,))
                if not cursor.fetchone():
                    logger.warning(f"Department ID {department_id} not found") 
                    cursor.close()
                    return None
                logger.info("Department found")
            
            # Call stored procedure
            logger.info("Inserting new conversation")
            cursor.execute(
                """
                INSERT INTO Conversations (UserID, Title, DepartmentID, IsActive)
                OUTPUT INSERTED.ConversationID
                VALUES (?, ?, ?, 1)
                """,
                (user_id, title, department_id)
            )
            
            # Get conversation ID
            row = cursor.fetchone()
            conversation_id = row.ConversationID if row else None
            logger.info(f"Retrieved conversation ID: {conversation_id}")
            
            self.conn.commit()
            logger.info("Committed transaction")
            
            cursor.close()
            logger.info("Closed cursor")
            
            logger.info(f"Conversation created successfully with ID: {conversation_id}")
            return conversation_id
            
        except pyodbc.Error as e:
            logger.error(f"Error creating conversation: {e}")
            if self.conn:
                self.conn.rollback()
            return None
    
    def get_conversation(self, conversation_id):
        """
        Get conversation details by ID.
        
        Args:
            conversation_id (int): The ID of the conversation to retrieve
            
        Returns:
            dict: Conversation details with messages, or None if not found
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Call stored procedure to get conversation and messages
            cursor.execute("EXEC GetConversationWithMessages @ConversationID=?", (conversation_id,))
            
            # Get conversation details
            row = cursor.fetchone()
            if not row:
                logger.warning(f"Conversation ID {conversation_id} not found")
                cursor.close()
                return None
                
            # Convert to dictionary
            columns = [column[0] for column in cursor.description]
            conversation = dict(zip(columns, row))
            
            # Get messages
            if cursor.nextset():
                messages = []
                message_columns = [column[0] for column in cursor.description]
                
                for message_row in cursor.fetchall():
                    message = dict(zip(message_columns, message_row))
                    messages.append(message)
                    
                conversation['messages'] = messages
            else:
                conversation['messages'] = []
            
            cursor.close()
            logger.info(f"Retrieved details for Conversation ID: {conversation_id}")
            return conversation
            
        except pyodbc.Error as e:
            logger.error(f"Error getting conversation details: {e}")
            return None
    
    def get_user_conversations(self, user_id):
        """
        Get all conversations accessible by a user using the stored procedure.
        
        Args:
            user_id (int): The ID of the user
            
        Returns:
            list: List of conversations accessible by the user
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if user exists
            cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (user_id,))
            if not cursor.fetchone():
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return []
                
            # Call stored procedure
            cursor.execute("EXEC GetUserConversations @UserID=?", (user_id,))
            
            # Format results
            conversations = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                conversation = dict(zip(columns, row))
                conversations.append(conversation)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(conversations)} conversations for User ID {user_id}")
            return conversations
            
        except pyodbc.Error as e:
            logger.error(f"Error getting user conversations: {e}")
            return []
    
    def add_message_to_conversation(self, conversation_id, sender_type, sender_id, content, agent_key=None):
        """
        Add a message to a conversation using the stored procedure.
        
        Args:
            conversation_id (int): The ID of the conversation
            sender_type (str): Type of sender ('user' or 'agent')
            sender_id (int): ID of the sender (UserID or AgentID)
            content (str): Message content
            agent_id (int, optional): ID of the agent that was used
            
        Returns:
            int: The ID of the newly created message, or None if failed
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()


            cursor.execute("SELECT AgentID FROM Agents WHERE AgentKey = ?", (agent_key,))
            agent_row = cursor.fetchone()
            if agent_row:
                agent_id = agent_row.AgentID
            else:
                logger.warning(f"Agent with key '{agent_key}' not found")
                cursor.close() 
                return None
            
            # Check if conversation exists
            cursor.execute("SELECT 1 FROM Conversations WHERE ConversationID = ?", (conversation_id,))
            if not cursor.fetchone():
                logger.warning(f"Conversation ID {conversation_id} not found")
                cursor.close()
                return None
                
            # Validate sender_type
            if sender_type not in ['user', 'agent']:
                logger.warning(f"Invalid sender_type: {sender_type}. Must be 'user' or 'agent'")
                cursor.close()
                return None
                
            # Insert message
            cursor.execute(
                """
                INSERT INTO Messages (ConversationID, SenderType, SenderID, Content, AgentID)
                OUTPUT INSERTED.MessageID
                VALUES (?, ?, ?, ?, ?)
                """,
                (conversation_id, sender_type, sender_id, content, agent_id)
            )
            
            # Get the message ID
            row = cursor.fetchone()
            message_id = row.MessageID if row else None
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Message added to Conversation ID {conversation_id} with Message ID: {message_id}")
            return message_id
            
        except pyodbc.Error as e:
            logger.error(f"Error adding message to conversation: {e}")
            if self.conn:
                self.conn.rollback()
            return None
    
    def update_conversation(self, conversation_id, title=None, is_active=None):
        """
        Update conversation details.
        
        Args:
            conversation_id (int): The ID of the conversation to update
            title (str, optional): New title for the conversation
            is_active (bool, optional): Whether the conversation is active
            
        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if conversation exists
            cursor.execute("SELECT 1 FROM Conversations WHERE ConversationID = ?", (conversation_id,))
            if not cursor.fetchone():
                logger.warning(f"Conversation ID {conversation_id} not found")
                cursor.close()
                return False
                
            # Build update query
            update_parts = []
            update_values = []
            
            if title is not None:
                update_parts.append("Title = ?")
                update_values.append(title)
                
            if is_active is not None:
                update_parts.append("IsActive = ?")
                update_values.append(1 if is_active else 0)
                
            if not update_parts:
                logger.warning("No fields provided for conversation update")
                cursor.close()
                return False
                
            # Complete the query
            query = f"UPDATE Conversations SET {', '.join(update_parts)} WHERE ConversationID = ?"
            update_values.append(conversation_id)
            
            # Execute the update
            cursor.execute(query, update_values)
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Conversation ID {conversation_id} updated successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error updating conversation: {e}")
            if self.conn:
                self.conn.rollback()
            return False
    
    def delete_conversation(self, conversation_id):
        """
        Delete a conversation from the database.
        
        Args:
            conversation_id (int): The ID of the conversation to delete
            
        Returns:
            bool: True if deletion successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if conversation exists
            cursor.execute("SELECT 1 FROM Conversations WHERE ConversationID = ?", (conversation_id,))
            if not cursor.fetchone():
                logger.warning(f"Conversation ID {conversation_id} not found")
                cursor.close()
                return False
                
            # Delete the conversation (cascades to Messages and SharedConversations)
            cursor.execute("DELETE FROM Conversations WHERE ConversationID = ?", (conversation_id,))
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Conversation ID {conversation_id} deleted successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error deleting conversation: {e}")
            if self.conn:
                self.conn.rollback()
            return False

    def add_message_feedback(self, message_id, user_id, comment):
        """
        Add or update a feedback comment for a message without affecting existing rating.
        
        Args:
            message_id (int): The ID of the message
            user_id (int): The ID of the user providing the feedback
            comment (str): Feedback comment
            
        Returns:
            int: The ID of the rating record, or None if failed
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if message exists
            cursor.execute("SELECT 1 FROM Messages WHERE MessageID = ?", (message_id,))
            if not cursor.fetchone():
                logger.warning(f"Message ID {message_id} not found")
                cursor.close()
                return None
                
                
            # Check if rating record already exists
            cursor.execute("""
                SELECT FeedbackID 
                FROM FeedbackRatings 
                WHERE MessageID = ? 
            """, (message_id))
            
            existing_rating = cursor.fetchone()
            
            if existing_rating:
                # Update existing comment
                cursor.execute("""
                    UPDATE FeedbackRatings 
                    SET Comment = ?, LastUpdatedAt = GETDATE()
                    WHERE FeedbackID = ?
                """, (comment, existing_rating[0]))
                rating_id = existing_rating[0]
            else:
                # Insert new record with comment only
                cursor.execute("""
                    INSERT INTO FeedbackRatings (MessageID, Comment)
                    VALUES (?, ?)
                """, (message_id, comment))
                cursor.execute("SELECT FeedbackID FROM FeedbackRatings WHERE MessageID = ? ORDER BY CreatedAt DESC", (message_id,))
                rating_id = cursor.fetchval()
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Feedback comment {'updated' if existing_rating else 'added'} for Message ID {message_id}")
            return rating_id
            
        except pyodbc.Error as e:
            logger.error(f"Error adding/updating feedback comment: {e}")
            if self.conn:
                self.conn.rollback()
            return None

    def add_message_rating(self, message_id, user_id, rating):
        """
        Add or update numerical rating for a message.
        
        Args:
            message_id (int): The ID of the message
            user_id (int): The ID of the user providing the rating
            rating (int): The rating value (1-5)
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if message exists
            cursor.execute("SELECT 1 FROM Messages WHERE MessageID = ?", (message_id,))
            if not cursor.fetchone():
                logger.warning(f"Message ID {message_id} not found")
                cursor.close()
                return False
                
            # Check if user exists
            cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (user_id,))
            if not cursor.fetchone():
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return False
                
            # Check if rating record exists
            cursor.execute("""
                SELECT FeedbackID 
                FROM FeedbackRatings 
                WHERE MessageID = ? 
            """, (message_id))
            
            existing_rating = cursor.fetchone()
            
            if existing_rating:
                # Update existing rating
                cursor.execute("""
                    UPDATE FeedbackRatings 
                    SET Rating = ?,UserID = ?, CreatedAt = GETDATE()
                    WHERE FeedbackID = ?
                """, (rating,user_id, existing_rating[0]))
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Rating {rating} {'updated' if existing_rating else 'added'} for Message ID {message_id}")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error adding/updating rating: {e}")
            if self.conn:
                self.conn.rollback()
            return False
    
    def get_department_messages(self, department_id, start_date=None, end_date=None):
        """
        Get all messages from conversations in a specific department.
        
        Args:
            department_id (int): The ID of the department
            start_date (date, optional): Filter by start date
            end_date (date, optional): Filter by end date
            
        Returns:
            list: List of messages with conversation and user details
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            query = """
                SELECT 
                    m.*,
                    c.Title as ConversationTitle,
                    u.Username as UserName,
                    a.Name as AgentName,
                    d.Name as DepartmentName,
                    fr.Rating,
                    fr.Comment as FeedbackComment
                FROM Messages m
                JOIN Conversations c ON m.ConversationID = c.ConversationID
                LEFT JOIN Users u ON (m.SenderType = 'user' AND m.SenderID = u.UserID)
                LEFT JOIN Agents a ON (m.SenderType = 'agent' AND m.SenderID = a.AgentID)
                LEFT JOIN Departments d ON c.DepartmentID = d.DepartmentID
                LEFT JOIN FeedbackRatings fr ON m.MessageID = fr.MessageID
                WHERE c.DepartmentID = ?
            """
            params = [department_id]
            
            if start_date:
                query += " AND m.Timestamp >= ?"
                params.append(start_date)
                
            if end_date:
                query += " AND m.Timestamp <= ?"
                params.append(end_date)
                
            query += " ORDER BY m.Timestamp DESC"
            
            cursor.execute(query, params)
            
            messages = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                message = dict(zip(columns, row))
                messages.append(message)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(messages)} messages for Department ID {department_id}")
            return messages
            
        except pyodbc.Error as e:
            logger.error(f"Error getting department messages: {e}")
            return []

    def get_all_messages(self, start_date=None, end_date=None, limit=1000):
        """
        Get all messages across all conversations with optional date filtering.
        
        Args:
            start_date (date, optional): Filter by start date
            end_date (date, optional): Filter by end date
            limit (int, optional): Maximum number of messages to return
            
        Returns:
            list: List of messages with conversation, user, and department details
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            query = """
                SELECT TOP (?)
                    m.*,
                    c.Title as ConversationTitle,
                    u.Username as UserName,
                    a.Name as AgentName,
                    d.Name as DepartmentName,
                    fr.Rating,
                    fr.Comment as FeedbackComment
                FROM Messages m
                JOIN Conversations c ON m.ConversationID = c.ConversationID
                LEFT JOIN Users u ON (m.SenderType = 'user' AND m.SenderID = u.UserID)
                LEFT JOIN Agents a ON (m.SenderType = 'agent' AND m.SenderID = a.AgentID)
                LEFT JOIN Departments d ON c.DepartmentID = d.DepartmentID
                LEFT JOIN FeedbackRatings fr ON m.MessageID = fr.MessageID
                WHERE 1=1
            """
            params = [limit]
            
            if start_date:
                query += " AND m.Timestamp >= ?"
                params.append(start_date)
                
            if end_date:
                query += " AND m.Timestamp <= ?"
                params.append(end_date)
                
            query += " ORDER BY m.Timestamp DESC"
            
            cursor.execute(query, params)
            
            messages = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                message = dict(zip(columns, row))
                messages.append(message)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(messages)} messages")
            return messages
            
        except pyodbc.Error as e:
            logger.error(f"Error getting all messages: {e}")
            return []
            
    def get_shared_agents(self, user_id):
        """
        Get all shared agents created by a user.
        
        Args:
            user_id (int): The ID of the user
            
        Returns:
            list: List of shared agents created by the user
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Execute stored procedure
            cursor.execute("EXEC GetUserSharedAgents @UserID=?", (user_id,))
            
            # Format results
            shared_agents = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                shared_agent = dict(zip(columns, row))
                shared_agents.append(shared_agent)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(shared_agents)} shared agents for User ID {user_id}")
            return shared_agents
            
        except pyodbc.Error as e:
            logger.error(f"Error getting shared agents: {e}")
            return []







    # Shared Agent Management Functions
    def create_shared_agent(self, agent_id, shared_by_user_id, name, description=None, allowed_origins=None, usage_limit=None, expires_at=None, api_key=None):
        """
        Create a new shared agent using the stored procedure.
        
        Args:
            agent_id (int): The ID of the agent to share
            shared_by_user_id (int): The ID of the user sharing the agent
            name (str): Display name for the shared agent
            description (str, optional): Description for external users
            allowed_origins (str, optional): Comma-separated list of allowed website origins
            usage_limit (int, optional): Maximum number of API calls allowed
            expires_at (datetime or int, optional): Expiration date or timestamp
            api_key (str, optional): API key for the shared agent
        Returns:
            dict: Details of the newly created shared agent including API key, or None if failed
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if agent exists
            cursor.execute("SELECT 1 FROM Agents WHERE AgentID = ?", (agent_id,))
            if not cursor.fetchone():
                logger.warning(f"Agent ID {agent_id} not found")
                cursor.close()
                return None
                
            # Check if user exists
            cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (shared_by_user_id,))
            if not cursor.fetchone():
                logger.warning(f"User ID {shared_by_user_id} not found")
                cursor.close()
                return None
            
            # Handle expires_at conversion to SQL Server compatible datetime
            sql_expires_at = None
            if expires_at is not None:
                try:
                    # If it's already a datetime object, use it directly
                    if isinstance(expires_at, datetime):
                        sql_expires_at = expires_at
                    # If it's an integer (timestamp), convert to datetime
                    elif isinstance(expires_at, int):
                        sql_expires_at = datetime.fromtimestamp(expires_at)
                    # Otherwise try to convert from string format
                    else:
                        logger.info(f"Converting expires_at value: {expires_at}")
                        sql_expires_at = datetime.fromtimestamp(expires_at)
                except Exception as e:
                    logger.error(f"Error converting expires_at to datetime: {e}")
                    logger.info(f"Setting expires_at to None due to conversion error")
                    sql_expires_at = None
                
                # Ensure date is within SQL Server's valid range
                min_date = datetime(1753, 1, 1)
                max_date = datetime(9999, 12, 31)
                if sql_expires_at and (sql_expires_at < min_date or sql_expires_at > max_date):
                    logger.warning(f"expires_at date {sql_expires_at} out of range for SQL Server datetime, using NULL")
                    sql_expires_at = None
            
            # Call stored procedure with properly converted datetime
            cursor.execute(
                """
                INSERT INTO SharedAgents (
                    AgentID, SharedByUserID, Name, Description, 
                    AllowedOrigins, UsageLimit, ExpiresAt, ApiKey, IsActive, CreatedAt
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, GETDATE())
                """,
                (agent_id, shared_by_user_id, name, description, allowed_origins, usage_limit, sql_expires_at, api_key)
            )
            
            # Manually fetch the results since some ODBC drivers don't handle
            # stored procedures that both modify data and return results well
            shared_agent = None
            
            # Check if there are results to fetch
            if cursor.description:
                # Get the result from the stored procedure
                row = cursor.fetchone()
                if row:
                    columns = [column[0] for column in cursor.description]
                    shared_agent = dict(zip(columns, row))
            
            # If no results from fetch, we need to execute another query to get the shared agent details
            if not shared_agent:
                # Get the ShareID of the newly created shared agent
                cursor.execute("""
                    SELECT ShareID FROM SharedAgents 
                    WHERE AgentID = ? AND SharedByUserID = ? AND Name = ?
                    ORDER BY CreatedAt DESC
                """, (agent_id, shared_by_user_id, name))
                
                share_id_row = cursor.fetchone()
                if not share_id_row:
                    logger.warning("Failed to retrieve ShareID of newly created shared agent")
                    self.conn.rollback()
                    cursor.close()
                    return None
                
                share_id = share_id_row[0]
                
                # Now get the complete shared agent details
                cursor.execute("""
                    SELECT sa.*, a.Name AS AgentName, a.Description AS AgentDescription
                    FROM SharedAgents sa
                    JOIN Agents a ON sa.AgentID = a.AgentID
                    WHERE sa.ShareID = ?
                """, (share_id,))
                
                row = cursor.fetchone()
                if not row:
                    logger.warning(f"Failed to retrieve details for ShareID {share_id}")
                    self.conn.rollback()
                    cursor.close()
                    return None
                
                columns = [column[0] for column in cursor.description]
                shared_agent = dict(zip(columns, row))
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Agent ID {agent_id} shared successfully with Share ID: {shared_agent.get('ShareID')}")
            return shared_agent
            
        except pyodbc.Error as e:
            logger.error(f"Error creating shared agent: {e}")
            if self.conn:
                self.conn.rollback()
            return None
    
    def get_shared_agent_by_api_key(self, api_key):
        """
        Get shared agent details by API key.
        
        Args:
            api_key (str): The API key of the shared agent
            
        Returns:
            dict: Shared agent details, or None if not found
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Query shared agent by API key
            cursor.execute("SELECT * FROM SharedAgents WHERE ApiKey = ?", (api_key,))
            row = cursor.fetchone()

            print(f'Row: {row}')
            
            if not row:
                logger.warning(f"No shared agent found with API key '{api_key}'")
                cursor.close()
                return None
                
            # Convert to dictionary
            columns = [column[0] for column in cursor.description]
            shared_agent = dict(zip(columns, row))
            
            cursor.close()
            logger.info(f"Retrieved shared agent with API key: {api_key}")
            return shared_agent
            
        except pyodbc.Error as e:
            logger.error(f"Error getting shared agent by API key: {e}")
            return None
    
    def get_user_shared_agents(self, user_id):
        """
        Get all shared agents created by a user using the stored procedure.
        
        Args:
            user_id (int): The ID of the user
            
        Returns:
            list: List of shared agents created by the user
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if user exists
            cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (user_id,))
            if not cursor.fetchone():
                logger.warning(f"User ID {user_id} not found")
                cursor.close()
                return []
                
            # Call stored procedure
            cursor.execute("EXEC GetUserSharedAgents @UserID=?", (user_id,))
            
            # Format results
            shared_agents = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                shared_agent = dict(zip(columns, row))
                shared_agents.append(shared_agent)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(shared_agents)} shared agents for User ID {user_id}")
            return shared_agents
            
        except pyodbc.Error as e:
            logger.error(f"Error getting user shared agents: {e}")
            return []
    
    def update_shared_agent(self, share_id, **kwargs):
        """
        Update shared agent details.
        
        Args:
            share_id (int): The ID of the shared agent to update
            **kwargs: Key-value pairs for fields to update.
                     Possible keys: name, description, allowed_origins, 
                     usage_limit, is_active, expires_at
            
        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if shared agent exists
            cursor.execute("SELECT 1 FROM SharedAgents WHERE ShareID = ?", (share_id,))
            if not cursor.fetchone():
                logger.warning(f"Shared Agent ID {share_id} not found")
                cursor.close()
                return False
                
            # Map Python variable names to database column names
            field_mapping = {
                'name': 'Name',
                'description': 'Description',
                'allowed_origins': 'AllowedOrigins',
                'usage_limit': 'UsageLimit',
                'is_active': 'IsActive',
                'expires_at': 'ExpiresAt'
            }
            
            # Build update query
            update_parts = []
            update_values = []
            
            for field, value in kwargs.items():
                if field in field_mapping:
                    # Special handling for boolean values
                    if field == 'is_active':
                        value = 1 if value else 0
                        
                    update_parts.append(f"{field_mapping[field]} = ?")
                    update_values.append(value)
            
            if not update_parts:
                logger.warning("No valid fields provided for shared agent update")
                cursor.close()
                return False
                
            # Complete the query
            query = f"UPDATE SharedAgents SET {', '.join(update_parts)} WHERE ShareID = ?"
            update_values.append(share_id)
            
            # Execute the update
            cursor.execute(query, update_values)
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Shared Agent ID {share_id} updated successfully")
            return True
            
        except pyodbc.Error as e:
            logger.error(f"Error updating shared agent: {e}")
            if self.conn:
                self.conn.rollback()
            return False
    
    def delete_shared_agent(self, share_id):
        """
        Delete a shared agent by ID.
        
        Args:
            share_id (int): The ID of the shared agent to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Delete the shared agent record
            cursor.execute("DELETE FROM SharedAgents WHERE ShareID = ?", (share_id,))
            
            self.conn.commit()
            result = cursor.rowcount > 0
            cursor.close()
            
            logger.info(f"Shared agent with ID {share_id} deleted successfully: {result}")
            return result
            
        except pyodbc.Error as e:
            logger.error(f"Error deleting shared agent: {e}")
            if self.conn:
                self.conn.rollback()
            return False
    
    def share_conversation(self, conversation_id, shared_by_user_id, expires_at=None):
        """
        Share a conversation by creating a unique share code.
        
        Args:
            conversation_id (int): The ID of the conversation to share
            shared_by_user_id (int): The ID of the user sharing the conversation
            expires_at (datetime, optional): Expiration date
            
        Returns:
            str: The generated share code, or None if failed
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if conversation exists
            cursor.execute("SELECT 1 FROM Conversations WHERE ConversationID = ?", (conversation_id,))
            if not cursor.fetchone():
                logger.warning(f"Conversation ID {conversation_id} not found")
                cursor.close()
                return None
                
            # Check if user exists
            cursor.execute("SELECT 1 FROM Users WHERE UserID = ?", (shared_by_user_id,))
            if not cursor.fetchone():
                logger.warning(f"User ID {shared_by_user_id} not found")
                cursor.close()
                return None
                
            # Generate a unique share code (12 alphanumeric characters)
            import random
            import string
            share_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))
            
            # Insert shared conversation
            cursor.execute(
                """
                INSERT INTO SharedConversations (ConversationID, SharedByUserID, SharedCode, IsActive, ExpiresAt)
                VALUES (?, ?, ?, 1, ?)
                """,
                (conversation_id, shared_by_user_id, share_code, expires_at)
            )
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Conversation ID {conversation_id} shared with code: {share_code}")
            return share_code
            
        except pyodbc.Error as e:
            logger.error(f"Error sharing conversation: {e}")
            if self.conn:
                self.conn.rollback()
            return None
    
    def get_shared_conversation(self, share_code):
        """
        Get a shared conversation by its share code.
        
        Args:
            share_code (str): The unique code for the shared conversation
            
        Returns:
            dict: Conversation details with messages, or None if not found/expired
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Check if share exists and is valid
            cursor.execute(
                """
                SELECT sc.ConversationID 
                FROM SharedConversations sc
                WHERE sc.SharedCode = ?
                AND sc.IsActive = 1
                AND (sc.ExpiresAt IS NULL OR sc.ExpiresAt > GETDATE())
                """, 
                (share_code,)
            )
            
            row = cursor.fetchone()
            if not row:
                logger.warning(f"Shared conversation with code '{share_code}' not found or expired")
                cursor.close()
                return None
                
            conversation_id = row.ConversationID
            
            # Get conversation with messages
            conversation = self.get_conversation(conversation_id)
            
            cursor.close()
            
            logger.info(f"Retrieved shared conversation with code: {share_code}")
            return conversation
            
        except pyodbc.Error as e:
            logger.error(f"Error getting shared conversation: {e}")
            return None
    
    # Usage Statistics Functions
    def log_usage_statistic(self, user_id=None, agent_id=None, department_id=None, 
                            conversation_id=None, shared_agent_id=None, 
                            request_count=1, tokens_used=0):
        """
        Log a usage statistic entry.
        
        Args:
            user_id (int, optional): The ID of the user
            agent_id (int, optional): The ID of the agent used
            department_id (int, optional): The ID of the department
            conversation_id (int, optional): The ID of the conversation
            shared_agent_id (int, optional): The ID of the shared agent if used externally
            request_count (int): Number of requests (default 1)
            tokens_used (int): Number of tokens used (default 0)
            
        Returns:
            int: The ID of the newly created statistic, or None if failed
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Insert usage statistic
            cursor.execute(
                """
                INSERT INTO UsageStatistics (
                    UserID, AgentID, DepartmentID, ConversationID, SharedAgentID,
                    RequestCount, TokensUsed, Date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, CAST(GETDATE() AS DATE))
                """,
                (user_id, agent_id, department_id, conversation_id, shared_agent_id, 
                 request_count, tokens_used)
            )
            
            # Get the statistic ID
            stat_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchval()
            
            self.conn.commit()
            cursor.close()
            
            logger.info(f"Usage statistic logged with ID: {stat_id}")
            return stat_id
            
        except pyodbc.Error as e:
            logger.error(f"Error logging usage statistic: {e}")
            if self.conn:
                self.conn.rollback()
            return None
    
    def get_usage_statistics(self, start_date=None, end_date=None, user_id=None, 
                             agent_id=None, department_id=None):
        """
        Get usage statistics with optional filtering.
        
        Args:
            start_date (date, optional): Filter by start date
            end_date (date, optional): Filter by end date
            user_id (int, optional): Filter by user ID
            agent_id (int, optional): Filter by agent ID
            department_id (int, optional): Filter by department ID
            
        Returns:
            list: List of usage statistics
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Build query with filters
            query = """
                SELECT us.*, 
                       u.Username,
                       a.Name AS AgentName,
                       d.Name AS DepartmentName
                FROM UsageStatistics us
                LEFT JOIN Users u ON us.UserID = u.UserID
                LEFT JOIN Agents a ON us.AgentID = a.AgentID
                LEFT JOIN Departments d ON us.DepartmentID = d.DepartmentID
                WHERE 1=1
            """
            params = []
            
            if start_date:
                query += " AND us.Date >= ?"
                params.append(start_date)
                
            if end_date:
                query += " AND us.Date <= ?"
                params.append(end_date)
                
            if user_id:
                query += " AND us.UserID = ?"
                params.append(user_id)
                
            if agent_id:
                query += " AND us.AgentID = ?"
                params.append(agent_id)
                
            if department_id:
                query += " AND us.DepartmentID = ?"
                params.append(department_id)
                
            query += " ORDER BY us.Date DESC, us.StatID DESC"
            
            cursor.execute(query, params)
            
            # Format results
            statistics = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                statistic = dict(zip(columns, row))
                statistics.append(statistic)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(statistics)} usage statistics")
            return statistics
            
        except pyodbc.Error as e:
            logger.error(f"Error getting usage statistics: {e}")
            return []
    
    def get_aggregated_usage_statistics(self, group_by, start_date=None, end_date=None):
        """
        Get aggregated usage statistics grouped by a specific field.
        
        Args:
            group_by (str): Field to group by ('user', 'agent', 'department', 'date')
            start_date (date, optional): Filter by start date
            end_date (date, optional): Filter by end date
            
        Returns:
            list: List of aggregated statistics
        """
        try:
            if not self.conn:
                self.Conn_Sql()
                
            cursor = self.conn.cursor()
            
            # Map group_by to SQL query parts
            group_by_map = {
                'user': {
                    'select': 'us.UserID, u.Username, u.Email',
                    'join': 'LEFT JOIN Users u ON us.UserID = u.UserID',
                    'group': 'us.UserID, u.Username, u.Email',
                    'order': 'SUM(us.RequestCount) DESC'
                },
                'agent': {
                    'select': 'us.AgentID, a.Name AS AgentName, a.AgentKey',
                    'join': 'LEFT JOIN Agents a ON us.AgentID = a.AgentID',
                    'group': 'us.AgentID, a.Name, a.AgentKey',
                    'order': 'SUM(us.RequestCount) DESC'
                },
                'department': {
                    'select': 'us.DepartmentID, d.Name AS DepartmentName',
                    'join': 'LEFT JOIN Departments d ON us.DepartmentID = d.DepartmentID',
                    'group': 'us.DepartmentID, d.Name',
                    'order': 'SUM(us.RequestCount) DESC'
                },
                'date': {
                    'select': 'us.Date',
                    'join': '',
                    'group': 'us.Date',
                    'order': 'us.Date DESC'
                }
            }
            
            if group_by not in group_by_map:
                logger.warning(f"Invalid group_by: {group_by}")
                cursor.close()
                return []
                
            query_parts = group_by_map[group_by]
            
            # Build query
            query = f"""
                SELECT {query_parts['select']},
                       COUNT(us.StatID) AS TotalRecords,
                       SUM(us.RequestCount) AS TotalRequests,
                       SUM(us.TokensUsed) AS TotalTokens
                FROM UsageStatistics us
                {query_parts['join']}
                WHERE 1=1
            """
            
            params = []
            
            if start_date:
                query += " AND us.Date >= ?"
                params.append(start_date)
                
            if end_date:
                query += " AND us.Date <= ?"
                params.append(end_date)
                
            query += f" GROUP BY {query_parts['group']}"
            query += f" ORDER BY {query_parts['order']}"
            
            cursor.execute(query, params)
            
            # Format results
            statistics = []
            columns = [column[0] for column in cursor.description]
            
            for row in cursor.fetchall():
                statistic = dict(zip(columns, row))
                statistics.append(statistic)
            
            cursor.close()
            
            logger.info(f"Retrieved {len(statistics)} aggregated usage statistics grouped by {group_by}")
            return statistics
            
        except pyodbc.Error as e:
            logger.error(f"Error getting aggregated statistics: {e}")
            return []



