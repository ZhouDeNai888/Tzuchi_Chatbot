-- Drop the database if it exists
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'AIChatDB')
BEGIN
    ALTER DATABASE AIChatDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE AIChatDB;
END
GO

CREATE DATABASE AIChatDB;
GO

USE AIChatDB;
GO

-- Create Users table
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FirstName NVARCHAR(100),
    LastName NVARCHAR(100),
    IsActive BIT DEFAULT 1 NOT NULL,
    UserRole NVARCHAR(50) DEFAULT 'user' NOT NULL, -- 'admin', 'user', etc.
    PreferredLanguage NVARCHAR(10) DEFAULT 'en' NOT NULL, -- 'en', 'zh', etc.
    ProfileImageURL NVARCHAR(500),
    CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    LastLoginAt DATETIME,
    LastUpdatedAt DATETIME DEFAULT GETDATE() NOT NULL
);
GO

-- Create Departments table
CREATE TABLE Departments (
    DepartmentID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    LastUpdatedAt DATETIME DEFAULT GETDATE() NOT NULL
);
GO

-- Create UserDepartments junction table
CREATE TABLE UserDepartments (
    UserID INT NOT NULL,
    DepartmentID INT NOT NULL,
    PRIMARY KEY (UserID, DepartmentID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (DepartmentID) REFERENCES Departments(DepartmentID) ON DELETE CASCADE
);
GO

-- Create Permissions table for defining access rights
CREATE TABLE Permissions (
    PermissionID INT IDENTITY(1,1) PRIMARY KEY,
    PermissionName NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(500)
);
GO

-- Create UserPermissions junction table
CREATE TABLE UserPermissions (
    UserID INT NOT NULL,
    PermissionID INT NOT NULL,
    GrantedBy INT NOT NULL, -- Admin who granted this permission
    GrantedAt DATETIME DEFAULT GETDATE() NOT NULL,
    PRIMARY KEY (UserID, PermissionID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (PermissionID) REFERENCES Permissions(PermissionID) ON DELETE CASCADE,
    FOREIGN KEY (GrantedBy) REFERENCES Users(UserID)
);
GO

-- Create Agents table
CREATE TABLE Agents (
    AgentID INT IDENTITY(1,1) PRIMARY KEY,
    AgentKey NVARCHAR(50) NOT NULL UNIQUE, -- e.g., 'general', 'code', 'writing'
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    Configuration NVARCHAR(MAX), -- JSON configuration
    IsActive BIT DEFAULT 1 NOT NULL,
    DepartmentID INT, -- Optional department assignment
    IsGlobal BIT DEFAULT 0 NOT NULL, -- If true, accessible across departments
    CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    LastUpdatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    FOREIGN KEY (DepartmentID) REFERENCES Departments(DepartmentID) ON DELETE SET NULL
);
GO

-- Create SharedAgents table for making agents available to external websites
CREATE TABLE SharedAgents (
    ShareID INT IDENTITY(1,1) PRIMARY KEY,
    AgentID INT NOT NULL,
    SharedByUserID INT NOT NULL,
    ApiKey NVARCHAR(MAX) NOT NULL UNIQUE, -- API key for external access
    Name NVARCHAR(100) NOT NULL, -- Display name for the shared agent
    Description NVARCHAR(500), -- Optional description for external users
    AllowedOrigins NVARCHAR(MAX), -- Comma-separated list of allowed website origins
    UsageLimit INT DEFAULT NULL, -- Maximum number of API calls allowed (NULL = unlimited)
    UsageCount INT DEFAULT 0 NOT NULL, -- Current count of API calls made
    IsActive BIT DEFAULT 1 NOT NULL,
    ExpiresAt DATETIME, -- Optional expiration date
    CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    LastUsedAt DATETIME,
    FOREIGN KEY (AgentID) REFERENCES Agents(AgentID) ON DELETE CASCADE,
    FOREIGN KEY (SharedByUserID) REFERENCES Users(UserID) ON DELETE CASCADE
);
GO

-- Create KnowledgeBases table
CREATE TABLE KnowledgeBases (
    KnowledgeBaseID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    OwnerID INT,
    DepartmentID INT, -- Department this knowledge base belongs to
    IsPublic BIT DEFAULT 0 NOT NULL, -- If true, accessible by all users in the department
    IsGlobal BIT DEFAULT 0 NOT NULL, -- If true, accessible across departments
    CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    LastUpdatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    FOREIGN KEY (OwnerID) REFERENCES Users(UserID) ON DELETE SET NULL,
    FOREIGN KEY (DepartmentID) REFERENCES Departments(DepartmentID) ON DELETE SET NULL
);
GO

-- Create KnowledgeDocuments table
CREATE TABLE KnowledgeDocuments (
    DocumentID INT IDENTITY(1,1) PRIMARY KEY,
    KnowledgeBaseID INT NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Content NVARCHAR(MAX),
    FileURL NVARCHAR(500),
    FileType NVARCHAR(50),
    IsProcessed BIT DEFAULT 0 NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    LastUpdatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    FOREIGN KEY (KnowledgeBaseID) REFERENCES KnowledgeBases(KnowledgeBaseID) ON DELETE CASCADE
);
GO

-- -- Create AgentKnowledgeBases junction table
-- CREATE TABLE AgentKnowledgeBases (
--     AgentID INT NOT NULL,
--     KnowledgeBaseID INT NOT NULL,
--     PRIMARY KEY (AgentID, KnowledgeBaseID),
--     FOREIGN KEY (AgentID) REFERENCES Agents(AgentID) ON DELETE CASCADE,
--     FOREIGN KEY (KnowledgeBaseID) REFERENCES KnowledgeBases(KnowledgeBaseID) ON DELETE CASCADE
-- );
-- GO

-- Create Conversations table
CREATE TABLE Conversations (
    ConversationID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT,
    DepartmentID INT, -- Department this conversation belongs to
    Title NVARCHAR(255),
    StartedAt DATETIME DEFAULT GETDATE() NOT NULL,
    LastMessageAt DATETIME DEFAULT GETDATE() NOT NULL,
    IsActive BIT DEFAULT 1 NOT NULL,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE SET NULL,
    FOREIGN KEY (DepartmentID) REFERENCES Departments(DepartmentID) ON DELETE SET NULL
);
GO

-- Create Messages table
CREATE TABLE Messages (
    MessageID INT IDENTITY(1,1) PRIMARY KEY,
    ConversationID INT NOT NULL,
    SenderType NVARCHAR(20) NOT NULL, -- 'user' or 'agent'
    SenderID INT, -- UserID or AgentID
    Content NVARCHAR(MAX) NOT NULL,
    AgentID INT, -- Which agent was used for this message
    Timestamp DATETIME DEFAULT GETDATE() NOT NULL,
    FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID) ON DELETE CASCADE,
    FOREIGN KEY (AgentID) REFERENCES Agents(AgentID) ON DELETE SET NULL
);
GO

-- -- Create SharedConversations table for sharing chat histories
-- CREATE TABLE SharedConversations (
--     ShareID INT IDENTITY(1,1) PRIMARY KEY,
--     ConversationID INT NOT NULL,
--     SharedByUserID INT NOT NULL,
--     SharedCode NVARCHAR(50) NOT NULL UNIQUE,
--     IsActive BIT DEFAULT 1 NOT NULL,
--     ExpiresAt DATETIME,
--     CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
--     FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID) ON DELETE CASCADE,
--     FOREIGN KEY (SharedByUserID) REFERENCES Users(UserID) ON DELETE CASCADE
-- );
-- GO

-- -- Create UserAPIKeys table
-- CREATE TABLE UserAPIKeys (
--     KeyID INT IDENTITY(1,1) PRIMARY KEY,
--     UserID INT NOT NULL,
--     KeyName NVARCHAR(100) NOT NULL,
--     APIKey NVARCHAR(255) NOT NULL UNIQUE,
--     LastUsedAt DATETIME,
--     IsActive BIT DEFAULT 1 NOT NULL,
--     CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
--     ExpiresAt DATETIME,
--     FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
-- );
-- GO

-- -- Create UserSessionTokens table
-- CREATE TABLE UserSessionTokens (
--     TokenID INT IDENTITY(1,1) PRIMARY KEY,
--     UserID INT NOT NULL,
--     Token NVARCHAR(255) NOT NULL UNIQUE,
--     ExpiresAt DATETIME NOT NULL,
--     CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
--     LastUsedAt DATETIME,
--     UserAgent NVARCHAR(500),
--     IPAddress NVARCHAR(50),
--     FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
-- );
-- GO

-- -- Create UsageStatistics table
-- CREATE TABLE UsageStatistics (
--     StatID INT IDENTITY(1,1) PRIMARY KEY,
--     UserID INT,
--     AgentID INT,
--     DepartmentID INT, -- Department this usage belongs to
--     ConversationID INT,
--     SharedAgentID INT, -- ID from SharedAgents table if used externally
--     RequestCount INT DEFAULT 1 NOT NULL,
--     TokensUsed INT DEFAULT 0 NOT NULL,
--     Date DATE DEFAULT GETDATE() NOT NULL,
--     FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE SET NULL,
--     FOREIGN KEY (AgentID) REFERENCES Agents(AgentID) ON DELETE SET NULL,
--     FOREIGN KEY (DepartmentID) REFERENCES Departments(DepartmentID) ON DELETE SET NULL,
--     FOREIGN KEY (ConversationID) REFERENCES Conversations(ConversationID) ON DELETE SET NULL,
--     FOREIGN KEY (SharedAgentID) REFERENCES SharedAgents(ShareID) ON DELETE NO ACTION
-- );
-- GO

-- Create FeedbackRatings table
CREATE TABLE FeedbackRatings (
    FeedbackID INT IDENTITY(1,1) PRIMARY KEY,
    MessageID INT NOT NULL,
    UserID INT,
    Rating INT NULL, -- 1-5 stars
    Comment NVARCHAR(500),
    CreatedAt DATETIME DEFAULT GETDATE() NOT NULL,
    FOREIGN KEY (MessageID) REFERENCES Messages(MessageID) ON DELETE CASCADE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE SET NULL
);
GO

-- -- Insert default permissions
-- INSERT INTO Permissions (PermissionName, Description)
-- VALUES 
--     ('view_knowledge', 'Can view knowledge bases'),
--     ('edit_knowledge', 'Can create and edit knowledge bases'),
--     ('use_agent', 'Can use chat agents'),
--     ('view_conversations', 'Can view conversation history'),
--     ('view_department_data', 'Can view data from their department'),
--     ('admin_department', 'Can manage department settings'),
--     ('view_all_departments', 'Can view data from all departments'),
--     ('manage_users', 'Can manage user permissions'),
--     ('share_agent', 'Can share agents for external use'),
--     ('full_admin', 'Has complete administrative control');
-- GO

-- -- Insert default agents
-- INSERT INTO Agents (AgentKey, Name, Description, IsGlobal)
-- VALUES 
--     ('general', 'General Assistant', 'General knowledge, daily tasks, and basic information', 1),
--     ('code', 'Code Expert', 'Programming, software development, and technical solutions', 1),
--     ('writing', 'Writing Assistant', 'Content creation, grammar, and writing improvement', 1);
-- GO

-- Insert admin user with hashed password (password: admin1234)
-- Note: In a production environment, use a proper password hashing function
INSERT INTO Users (Username, Email, PasswordHash, FirstName, LastName, UserRole, IsActive)
VALUES ('admin', 'admin@example.com', 
        -- This is a bcrypt hash of 'admin1234'
        '$2b$12$pMtKDqzCvp3JJmMRpv.TZuIzILuuHN7z8kAAttyTEdchLUEsXPKt.', 
        'System', 'Administrator', 'admin', 1);

INSERT INTO Permissions (PermissionName, Description)
VALUES 
('General_Permission', 'General Permission for General person'),
('knowledge_setting', 'Permission to manage the knowledge base, including adding, editing, or deleting content used by the system to answer questions.'),
('agent_setting', 'Permission to configure agents or bots, such as changing their name, response behavior, or personality.'),
('history_setting', 'Permission to view or delete usage history, such as user conversations or system activity logs.'),
('share_setting', 'Permission to manage sharing settings, including enabling public links or sharing content between users.'),
('account_setting', 'Permission to manage user accounts, including adding new users, editing profiles, or removing users.'),
('departments_setting', 'Permission to manage departments or organizational units, including assigning managers or customizing department settings.'),
('permission_setting', 'Permission to manage access rights and roles, including granting or restricting specific permissions to users.'),
('model_setting', 'Permission to manage AI model configurations, such as selecting models, adjusting accuracy, or updating versions.'),
('basic_permission', 'super low permission for login');
GO

-- Create indexes for performance
CREATE INDEX IX_Messages_ConversationID ON Messages(ConversationID);
CREATE INDEX IX_Messages_Timestamp ON Messages(Timestamp);
CREATE INDEX IX_Conversations_UserID ON Conversations(UserID);
CREATE INDEX IX_Conversations_DepartmentID ON Conversations(DepartmentID);
CREATE INDEX IX_KnowledgeBases_DepartmentID ON KnowledgeBases(DepartmentID);
CREATE INDEX IX_KnowledgeDocuments_KnowledgeBaseID ON KnowledgeDocuments(KnowledgeBaseID);
-- CREATE INDEX IX_UserSessionTokens_Token ON UserSessionTokens(Token);
CREATE INDEX IX_UserDepartments_DepartmentID ON UserDepartments(DepartmentID);
CREATE INDEX IX_Agents_DepartmentID ON Agents(DepartmentID);
CREATE INDEX IX_SharedAgents_ApiKey ON SharedAgents(ApiKey);
GO

-- Create stored procedures for common operations

-- Get conversation with messages
CREATE PROCEDURE GetConversationWithMessages
    @ConversationID INT
AS
BEGIN
    -- Get conversation details
    SELECT * FROM Conversations WHERE ConversationID = @ConversationID;
    
    -- Get all messages in the conversation
    SELECT * FROM Messages 
    WHERE ConversationID = @ConversationID
    ORDER BY Timestamp;
END;
GO

-- Get user conversations
CREATE PROCEDURE GetUserConversations
    @UserID INT
AS
BEGIN
    -- Get user's role
    DECLARE @IsAdmin BIT = 0;
    SELECT @IsAdmin = 1 FROM UserPermissions up
    JOIN Permissions p ON up.PermissionID = p.PermissionID
    WHERE up.UserID = @UserID AND p.PermissionName = 'history_setting';
    
    IF @IsAdmin = 1
    BEGIN
        -- Admin can see all conversations
        SELECT c.*, 
               (SELECT TOP 1 Content FROM Messages WHERE ConversationID = c.ConversationID ORDER BY Timestamp DESC) AS LastMessage,
               (SELECT COUNT(*) FROM Messages WHERE ConversationID = c.ConversationID) AS MessageCount,
               d.Name AS DepartmentName
        FROM Conversations c
        LEFT JOIN Departments d ON c.DepartmentID = d.DepartmentID
        ORDER BY c.LastMessageAt DESC;
    END
    ELSE
    BEGIN
        -- Get departments the user belongs to
        DECLARE @CanViewAllDepts BIT = 0;
        SELECT @CanViewAllDepts = 1 FROM UserPermissions up
        JOIN Permissions p ON up.PermissionID = p.PermissionID
        WHERE up.UserID = @UserID AND p.PermissionName = 'departments_setting';
        
        IF @CanViewAllDepts = 1
        BEGIN
            -- User can see conversations from all departments
            SELECT c.*, 
                   (SELECT TOP 1 Content FROM Messages WHERE ConversationID = c.ConversationID ORDER BY Timestamp DESC) AS LastMessage,
                   (SELECT COUNT(*) FROM Messages WHERE ConversationID = c.ConversationID) AS MessageCount,
                   d.Name AS DepartmentName
            FROM Conversations c
            LEFT JOIN Departments d ON c.DepartmentID = d.DepartmentID
            ORDER BY c.LastMessageAt DESC;
        END
        ELSE
        BEGIN
            -- User can only see their own conversations and those from their departments
            SELECT c.*, 
                   (SELECT TOP 1 Content FROM Messages WHERE ConversationID = c.ConversationID ORDER BY Timestamp DESC) AS LastMessage,
                   (SELECT COUNT(*) FROM Messages WHERE ConversationID = c.ConversationID) AS MessageCount,
                   d.Name AS DepartmentName
            FROM Conversations c
            LEFT JOIN Departments d ON c.DepartmentID = d.DepartmentID
            WHERE c.UserID = @UserID 
               OR c.DepartmentID IN (SELECT DepartmentID FROM UserDepartments WHERE UserID = @UserID)
            ORDER BY c.LastMessageAt DESC;
        END
    END
END;
GO

-- Add message to conversation
CREATE PROCEDURE AddMessageToConversation
    @ConversationID INT,
    @SenderType NVARCHAR(20),
    @SenderID INT,
    @Content NVARCHAR(MAX),
    @AgentID INT = NULL
AS
BEGIN
    -- Insert the message
    INSERT INTO Messages (ConversationID, SenderType, SenderID, Content, AgentID)
    VALUES (@ConversationID, @SenderType, @SenderID, @Content, @AgentID);
    
    -- Update the conversation's last message timestamp
    UPDATE Conversations
    SET LastMessageAt = GETDATE()
    WHERE ConversationID = @ConversationID;
    
    -- Return the inserted message ID
    SELECT SCOPE_IDENTITY() AS MessageID;
END;
GO

-- Create a new user
CREATE PROCEDURE CreateUser
    @Username NVARCHAR(100),
    @Email NVARCHAR(255),
    @PasswordHash NVARCHAR(255),
    @FirstName NVARCHAR(100) = NULL,
    @LastName NVARCHAR(100) = NULL,
    @UserRole NVARCHAR(50) = 'user',
    @PreferredLanguage NVARCHAR(10) = 'en',
    @DepartmentIDs NVARCHAR(MAX) = NULL -- Comma-separated department IDs
AS
BEGIN
    DECLARE @UserID INT;
    
    BEGIN TRANSACTION;
    
    -- Insert user
    INSERT INTO Users (Username, Email, PasswordHash, FirstName, LastName, UserRole, PreferredLanguage)
    VALUES (@Username, @Email, @PasswordHash, @FirstName, @LastName, @UserRole, @PreferredLanguage);
    
    SET @UserID = SCOPE_IDENTITY();
    
    -- Add default permission for basic access
    INSERT INTO UserPermissions (UserID, PermissionID, GrantedBy)
    SELECT @UserID, PermissionID, @UserID
    FROM Permissions
    WHERE PermissionName = 'departments_setting';
    
    -- Add user to departments if specified
    IF @DepartmentIDs IS NOT NULL
    BEGIN
        -- Parse comma-separated department IDs
        WITH SplitDepartments AS (
            SELECT value AS DepartmentID
            FROM STRING_SPLIT(@DepartmentIDs, ',')
        )
        INSERT INTO UserDepartments (UserID, DepartmentID)
        SELECT @UserID, CAST(DepartmentID AS INT)
        FROM SplitDepartments;
    END
    
    -- Grant admin permissions if user role is admin
    IF @UserRole = 'admin'
    BEGIN
        INSERT INTO UserPermissions (UserID, PermissionID, GrantedBy)
        SELECT @UserID, PermissionID, @UserID
        FROM Permissions
        WHERE PermissionName IN ('permission_setting', 'account_setting', 'departments_setting', 
                                'knowledge_setting', 'agent_setting', 'model_setting', 
                                'share_setting', 'history_setting');
    END
    
    COMMIT;
    
    SELECT @UserID AS UserID;
END;
GO

-- Create a new conversation
CREATE PROCEDURE CreateConversation
    @UserID INT,
    @Title NVARCHAR(255) = NULL,
    @DepartmentID INT = NULL
AS
BEGIN
    -- If no title provided, generate a default one with date
    IF @Title IS NULL
        SET @Title = 'Conversation ' + CONVERT(NVARCHAR, GETDATE(), 120);
    
    -- If no department provided but user belongs to departments, use their first department
    IF @DepartmentID IS NULL
    BEGIN
        SELECT TOP 1 @DepartmentID = DepartmentID 
        FROM UserDepartments 
        WHERE UserID = @UserID;
    END
        
    INSERT INTO Conversations (UserID, Title, DepartmentID)
    VALUES (@UserID, @Title, @DepartmentID);
    
    SELECT SCOPE_IDENTITY() AS ConversationID;
END;
GO

-- Create a new agent share
CREATE PROCEDURE CreateSharedAgent
    @AgentID INT,
    @SharedByUserID INT,
    @Name NVARCHAR(100),
    @Description NVARCHAR(500) = NULL,
    @AllowedOrigins NVARCHAR(MAX) = NULL, -- Comma-separated list of allowed website origins
    @UsageLimit INT = NULL,
    @ExpiresAt DATETIME = NULL
AS
BEGIN
    -- Check if user has permission to share agents
    IF NOT EXISTS (
        SELECT 1 FROM UserPermissions up
        JOIN Permissions p ON up.PermissionID = p.PermissionID
        WHERE up.UserID = @SharedByUserID 
        AND p.PermissionName = 'share_setting'
    )
    BEGIN
        RAISERROR('User does not have permission to share agents', 16, 1);
        RETURN;
    END
    
    -- Generate unique API key
    DECLARE @ApiKey NVARCHAR(64);
    SET @ApiKey = CONVERT(NVARCHAR(36), NEWID()) + CONVERT(NVARCHAR(36), NEWID());
    SET @ApiKey = REPLACE(@ApiKey, '-', '');
    
    -- Create shared agent
    INSERT INTO SharedAgents (
        AgentID, 
        SharedByUserID, 
        ApiKey, 
        Name, 
        Description, 
        AllowedOrigins, 
        UsageLimit, 
        ExpiresAt
    )
    VALUES (
        @AgentID, 
        @SharedByUserID, 
        @ApiKey, 
        @Name, 
        @Description, 
        @AllowedOrigins, 
        @UsageLimit, 
        @ExpiresAt
    );
    
    -- Return the shared agent details
    SELECT 
        sa.*,
        a.Name AS AgentName,
        a.Description AS AgentDescription
    FROM SharedAgents sa
    JOIN Agents a ON sa.AgentID = a.AgentID
    WHERE sa.ShareID = SCOPE_IDENTITY();
END;
GO

-- Get shared agent by API key
CREATE PROCEDURE GetSharedAgentByApiKey
    @ApiKey NVARCHAR(255)
AS
BEGIN
    -- Get shared agent details
    SELECT 
        sa.*,
        a.Name AS AgentName,
        a.Description AS AgentDescription,
        a.Configuration AS AgentConfiguration,
        u.Username AS SharedByUsername
    FROM SharedAgents sa
    JOIN Agents a ON sa.AgentID = a.AgentID
    JOIN Users u ON sa.SharedByUserID = u.UserID
    WHERE sa.ApiKey = @ApiKey
    AND sa.IsActive = 1
    AND (sa.ExpiresAt IS NULL OR sa.ExpiresAt > GETDATE())
    AND (sa.UsageLimit IS NULL OR sa.UsageCount < sa.UsageLimit);
    
    -- Update last used timestamp and increment usage count if found
    IF @@ROWCOUNT > 0
    BEGIN
        UPDATE SharedAgents
        SET LastUsedAt = GETDATE(),
            UsageCount = UsageCount + 1
        WHERE ApiKey = @ApiKey;
    END
END;
GO

-- Get user department knowledge bases
CREATE PROCEDURE GetUserAccessibleKnowledgeBases
    @UserID INT
AS
BEGIN
    -- Check if user is admin or has special permissions
    DECLARE @IsAdmin BIT = 0;
    DECLARE @CanViewAllDepts BIT = 0;
    
    SELECT @IsAdmin = 1 FROM UserPermissions up
    JOIN Permissions p ON up.PermissionID = p.PermissionID
    WHERE up.UserID = @UserID AND p.PermissionName = 'knowledge_setting';
    
    SELECT @CanViewAllDepts = 1 FROM UserPermissions up
    JOIN Permissions p ON up.PermissionID = p.PermissionID
    WHERE up.UserID = @UserID AND p.PermissionName = 'departments_setting';
    
    IF @IsAdmin = 1 OR @CanViewAllDepts = 1
    BEGIN
        -- Admin or users with special permissions can see all knowledge bases
        SELECT kb.*, u.Username AS OwnerName, d.Name AS DepartmentName
        FROM KnowledgeBases kb
        LEFT JOIN Users u ON kb.OwnerID = u.UserID
        LEFT JOIN Departments d ON kb.DepartmentID = d.DepartmentID
        ORDER BY kb.LastUpdatedAt DESC;
    END
    ELSE
    BEGIN
        -- Regular users can only see knowledge bases from their departments and global ones
        SELECT kb.*, u.Username AS OwnerName, d.Name AS DepartmentName
        FROM KnowledgeBases kb
        LEFT JOIN Users u ON kb.OwnerID = u.UserID
        LEFT JOIN Departments d ON kb.DepartmentID = d.DepartmentID
        WHERE kb.IsGlobal = 1
           OR kb.OwnerID = @UserID
           OR (kb.IsPublic = 1 AND kb.DepartmentID IN (SELECT DepartmentID FROM UserDepartments WHERE UserID = @UserID))
        ORDER BY kb.LastUpdatedAt DESC;
    END
END;
GO

-- Get user shared agents
CREATE PROCEDURE GetUserSharedAgents
    @UserID INT
AS
BEGIN
    -- Check if user is admin
    DECLARE @IsAdmin BIT = 0;
    SELECT @IsAdmin = 1 FROM UserPermissions up
    JOIN Permissions p ON up.PermissionID = p.PermissionID
    WHERE up.UserID = @UserID AND p.PermissionName = 'share_setting';
    
    IF @IsAdmin = 1
    BEGIN
        -- Admin can see all shared agents
        SELECT 
            sa.*,
            a.Name AS AgentName,
            a.Description AS AgentDescription,
            u.Username AS SharedByUsername
        FROM SharedAgents sa
        JOIN Agents a ON sa.AgentID = a.AgentID
        JOIN Users u ON sa.SharedByUserID = u.UserID
        ORDER BY sa.CreatedAt DESC;
    END
    ELSE
    BEGIN
        -- Regular users can only see their own shared agents
        SELECT 
            sa.*,
            a.Name AS AgentName,
            a.Description AS AgentDescription,
            u.Username AS SharedByUsername
        FROM SharedAgents sa
        JOIN Agents a ON sa.AgentID = a.AgentID
        JOIN Users u ON sa.SharedByUserID = u.UserID
        WHERE sa.SharedByUserID = @UserID
        ORDER BY sa.CreatedAt DESC;
    END
END;
GO

-- Grant permission to user
CREATE PROCEDURE GrantPermissionToUser
    @UserID INT,
    @PermissionName NVARCHAR(100),
    @GrantedBy INT
AS
BEGIN
    DECLARE @PermissionID INT;
    
    -- Get permission ID
    SELECT @PermissionID = PermissionID 
    FROM Permissions 
    WHERE PermissionName = @PermissionName;
    
    IF @PermissionID IS NULL
    BEGIN
        RAISERROR('Permission not found', 16, 1);
        RETURN;
    END
    
    -- Check if permission already exists
    IF EXISTS (SELECT 1 FROM UserPermissions WHERE UserID = @UserID AND PermissionID = @PermissionID)
    BEGIN
        RAISERROR('User already has this permission', 16, 1);
        RETURN;
    END
    
    -- Grant permission
    INSERT INTO UserPermissions (UserID, PermissionID, GrantedBy)
    VALUES (@UserID, @PermissionID, @GrantedBy);
    
    SELECT 'Permission granted successfully' AS Result;
END;
GO


CREATE TABLE [dbo].[AIModels](
    [ModelID] INT IDENTITY(1,1) PRIMARY KEY,
    [Platform] NVARCHAR(100) NOT NULL,
    [ModelName] NVARCHAR(100) NOT NULL,
    [CreatedBy] INT NOT NULL,
    [IsActive] BIT NOT NULL DEFAULT 1,
    [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
    [ApiKey] VARCHAR(255) NULL,
    [ApiVersion] VARCHAR(255) NULL,
    FOREIGN KEY ([CreatedBy]) REFERENCES [dbo].[Users] ([UserID]) ON DELETE CASCADE
);
GO
CREATE TABLE ApiPermissions (
    ApiPermissionID INT IDENTITY(1,1) PRIMARY KEY,
    PathPattern NVARCHAR(255) NOT NULL,
    Method NVARCHAR(10) NOT NULL,
    RequiredPermission NVARCHAR(100) NOT NULL
);
GO






INSERT INTO ApiPermissions (PathPattern, Method, RequiredPermission)
VALUES
('/api/users/me', 'GET', 'General_Permission'),
('/api/token', 'POST', 'General_Permission'),
('/api/permissions/check/{permission_name}', 'GET', 'General_Permission'),
('/api/token/refresh', 'POST', 'General_Permission'),
('/api/knowledge-bases', 'GET', 'General_Permission'),
('/api/knowledge-bases', 'POST', 'General_Permission'),
('/api/knowledge-bases/{knowledge_base_id}', 'GET', 'General_Permission'),
('/api/knowledge-bases/{knowledge_base_id}', 'PUT', 'General_Permission'),
('/api/knowledge-bases/{knowledge_base_id}', 'DELETE', 'General_Permission'),
('/api/knowledge-bases/{knowledge_base_id}/documents', 'GET', 'General_Permission'),
('/api/users/me', 'GET', 'basic_permission'),
('/api/token', 'POST', 'basic_permission'),
('/api/token/refresh', 'POST', 'basic_permission'),
('/api/agents', 'GET', 'General_Permission'),
('/api/agents', 'POST', 'General_Permission'),
('/api/agents/{agent_id}', 'GET', 'General_Permission'),
('/api/agents/{agent_id}', 'PUT', 'General_Permission'),
('/api/agents/{agent_id}', 'DELETE', 'General_Permission'),
('/api/agents/shared', 'GET', 'General_Permission'),
('/api/agents/share', 'POST', 'General_Permission'),
('/api/agents/share/revoke', 'POST', 'General_Permission'),
('/api/all_models', 'GET', 'General_Permission'),
('/api/conversations', 'POST', 'General_Permission'),
('/api/conversations', 'GET', 'General_Permission'),
('/api/conversations/{conversation_id}', 'GET', 'General_Permission'),
('/api/conversations/{conversation_id}', 'DELETE', 'General_Permission'),
('/api/chat', 'POST', 'General_Permission'),
('/api/messages', 'GET', 'General_Permission'),
('/api/messages/department', 'GET', 'General_Permission'),
('/api/messages/{message_id}/rating', 'POST', 'General_Permission'),
('/api/agents', 'GET', 'agent_setting'),
('/api/agents', 'POST', 'agent_setting'),
('/api/agents/{agent_id}', 'GET', 'agent_setting'),
('/api/agents/{agent_id}', 'PUT', 'agent_setting'),
('/api/agents/{agent_id}', 'DELETE', 'agent_setting'),
('/api/departments', 'GET', 'departments_setting'),
('/api/departments', 'POST', 'departments_setting'),
('/api/departments/{department_id}', 'GET', 'departments_setting'),
('/api/departments/{department_id}', 'PUT', 'departments_setting'),
('/api/departments/{department_id}', 'DELETE', 'departments_setting'),
('/api/departments/{department_id}/users', 'GET', 'departments_setting'),
('/api/knowledge-bases', 'GET', 'departments_setting'),
('/api/all_models', 'GET', 'agent_setting'),
('/api/departments', 'GET', 'agent_setting'),
('/api/knowledge-bases', 'GET', 'agent_setting'),
('/api/messages', 'GET', 'history_setting'),
('/api/messages/{message_id}/rating', 'POST', 'history_setting'),
('/api/agents/shared', 'GET', 'share_setting'),
('/api/agents', 'GET', 'share_setting'),
('/api/agents/share', 'POST', 'share_setting'),
('/api/agents/share/revoke', 'POST', 'share_setting'),
('/api/agents/{agent_id}', 'GET', 'share_setting'),
('/api/departments', 'GET', 'account_setting'),
('/api/permissions', 'GET', 'account_setting'),
('/api/users/all', 'GET', 'account_setting'),
('/api/users', 'POST', 'account_setting'),
('/api/permissions/user', 'POST', 'account_setting'),
('/api/permissions/user', 'DELETE', 'account_setting'),
('/api/permissions/check/{permission_name}', 'GET', 'basic_permission'),
('/api/messages/department', 'GET', 'history_setting'),
('/api/departments/{department_id}', 'GET', 'agent_setting'),
('/api/agents', 'GET', 'basic_permission'),
('/api/chat', 'POST', 'basic_permission'),
('/api/conversations', 'POST', 'basic_permission'),
('/api/messages/{message_id}/feedback', 'POST', 'share_setting'),
('/api/knowledge-bases', 'GET', 'knowledge_setting'),
('/api/knowledge-bases', 'POST', 'knowledge_setting'),
('/api/knowledge-bases/{knowledge_base_id}', 'GET', 'knowledge_setting'),
('/api/knowledge-bases/{knowledge_base_id}', 'PUT', 'knowledge_setting'),
('/api/knowledge-bases/{knowledge_base_id}', 'DELETE', 'knowledge_setting'),
('/api/documents', 'POST', 'knowledge_setting'),
('/api/documents/{document_id}', 'PUT', 'knowledge_setting'),
('/api/documents/{document_id}', 'DELETE', 'knowledge_setting'),
('/api/knowledge-bases/{knowledge_base_id}/documents', 'GET', 'knowledge_setting'),
('/api/documents/{document_id}', 'GET', 'knowledge_setting'),
('/api/models', 'GET', 'model_setting'),
('/api/models', 'POST', 'model_setting'),
('/api/models', 'DELETE', 'model_setting'),
('/api/all_models', 'GET', 'model_setting'),
('/api/permissions', 'GET', 'permission_setting'),
('/api/api-permissions', 'GET', 'permission_setting'),
('/api/api-permissions', 'POST', 'permission_setting'),
('/api/permissions', 'POST', 'permission_setting'),
('/api/all-api', 'GET', 'permission_setting'),
('/api/permissions/{permission_id}', 'PUT', 'permission_setting'),
('/api/permissions/{permission_id}', 'DELETE', 'permission_setting'),
('/api/api-permissions/{api_permission_id}', 'PUT', 'permission_setting'),
('/api/api-permissions/{api_permission_id}', 'DELETE', 'permission_setting');
GO