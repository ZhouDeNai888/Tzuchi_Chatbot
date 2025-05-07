export type Language = 'en' | 'zh-TW';

// Helper type for agents translation
export interface AgentsTranslation {
  general: {
    name: string;
    knowledge: string;
  };
  code: {
    name: string;
    knowledge: string;
  };
  writing: {
    name: string;
    knowledge: string;
  };
  placeholder: string;
}

// Helper function to get nested translation value from key path
export function getTranslation(language: 'en' | 'zh-TW', path: string): string {
  const keys = path.split('.');
  let value: any = translations[language];

  for (const key of keys) {
    if (value === undefined || value === null) {
      console.warn(`Translation missing for key: ${path} in language: ${language}`);
      return path;
    }
    value = value[key];
  }

  if (typeof value === 'string') {
    return value;
  }

  console.warn(`Translation is not a string for key: ${path} in language: ${language}`);
  return path;
}

export const translations = {
  en: {
    common: {
      cancel: 'Cancel',
      processing: 'Processing...',
      done: 'Done',
      copied: 'Copied!'
    },
    nav: {
      navigation: 'Navigation',
      home: 'Home',
      knowledgeBase: 'Knowledge Base',
      knowledgeSetting: 'Knowledge Setting',
      agents: 'Agents',
      agentSetting: 'Agent Setting',
      history: 'History',
      qaHistory: 'Q&A History',
      share: 'Share',
      shareSetting: 'Share Setting',
      accounts: 'Accounts',
      accountSetting: 'Account Setting',
      departmentSetting: 'Department Setting',
      profile: 'Profile',
      settings: 'Settings',
      signOut: 'Sign Out'
    },
    agents: {
      general: {
        name: 'General Assistant',
        knowledge: 'General knowledge, daily tasks, and basic information'
      },
      code: {
        name: 'Code Expert',
        knowledge: 'Programming, software development, and technical solutions'
      },
      writing: {
        name: 'Writing Assistant',
        knowledge: 'Content creation, grammar, and writing improvement'
      },
      placeholder: 'Ask anything...'
    } as AgentsTranslation,
    knowledge: {
      title: 'Knowledge Base',
      createNew: 'Create New',
      searchPlaceholder: 'Search knowledge base...',
      newlyCreated: 'Newly Created',
      duplicateError: 'A knowledge base item with this title already exists.',
      defaultItems: {
        gettingStarted: {
          title: 'Getting Started',
          description: 'Learn the basics of using our AI chat system'
        },
        faq: {
          title: 'FAQ',
          description: 'Frequently asked questions about our services'
        },
        api: {
          title: 'API Documentation',
          description: 'Technical documentation for developers'
        }
      }
    },
    knowledgeDetail: {
      backToKnowledge: '← Back to Knowledge Base',
      notFound: 'Knowledge not found',
      relatedData: 'Related Data',
      addNewData: 'Add New Data',
      noData: 'No data items added yet. Click "Add New Data" to get started.',
      fileUpload: 'File Upload',
      linkInput: 'Link Input',
      uploadFiles: 'Upload Files',
      dragAndDrop: 'Drag and drop files here or click to browse',
      fileSizeLimit: 'Maximum file size: 50MB',
      selectedFiles: 'Selected Files',
      enterLink: 'Enter URL',
      linkDescription: 'Enter a web page URL to import content from',
      cancel: 'Cancel',
      uploading: 'Uploading...',
      submit: 'Submit',
      table: {
        fileName: 'File Name',
        type: 'Type',
        uploadTime: 'Upload Time',
        status: 'Status',
        actions: 'Actions'
      },
      status: {
        finished: 'Finished',
        processing: 'Processing',
        error: 'Error'
      },
      actions: {
        view: 'View',
        delete: 'Delete'
      },
      processing: {
        single: 'Processing 1 item...',
        multiple: 'Processing {count} items...'
      },
      errors: {
        duplicateFile: 'A file with name "{name}" already exists.',
        duplicateUrl: 'This URL has already been added.'
      }
    },
    agent: {
      title: 'Agent Settings',
      yourAgents: 'Your Agents',
      createNew: 'Create New Agent',
      editAgent: 'Edit Agent',
      noAgents: 'No agents created yet',
      noKnowledgeBases: 'No knowledge bases available',
      duplicateError: 'An agent with this name already exists',
      duplicateKeyError: 'An agent with this key already exists',
      nameRequired: 'Agent name is required',
      shareAgent: 'Share Agent',
      shareSuccess: 'Agent Shared Successfully',
      shareWarning: 'Keep this API key secure. Anyone with this key can use your agent.',
      apiKey: 'API Key',
      embedCode: 'Embed Code',
      copyEmbed: 'Copy Embed Code',
      shareButton: 'Share Agent',
      agentCreated: 'Agent created successfully',
      agentUpdated: 'Agent updated successfully',
      agentDeleted: 'Agent deleted successfully',
      form: {
        name: 'Agent Name',
        namePlaceholder: 'My AI Assistant',
        agentKey: 'Agent Key',
        agentKeyPlaceholder: 'Custom key (optional)',
        model: 'Model',
        temperature: 'Temperature',
        maxTokens: 'Max Tokens',
        knowledgeBase: 'Knowledge Base',
        noKnowledgeBase: 'No Knowledge Base',
        department: 'Department',
        systemPrompt: 'System Prompt',
        systemPromptPlaceholder: "Enter the system prompt that defines your agent's behavior...",
        createAgent: 'Create Agent',
        saveChanges: 'Save Changes',
        savingLoading: 'Saving...',
        createButton: 'Create Agent',
        updateButton: 'Update Agent',
        shareName: 'Share Name',
        shareDescription: 'Description',
        allowedOrigins: 'Allowed Origins',
        allowedOriginsHint: 'Use * for any website or comma-separated list of domains',
        usageLimit: 'Usage Limit',
        unlimited: 'Unlimited',
        expiryDays: 'Expiry Days',
        neverExpires: 'Never Expires',
        models: {
          gpt35Turbo: 'GPT-3.5 Turbo',
          gpt4: 'GPT-4',
          gpt4Turbo: 'GPT-4 Turbo'
        }
      }
    },
    history: {
      title: 'Chat History',
      loading: 'Loading...',
      error: 'Error loading history',
      conversation: 'Conversation',
      user: 'User',
      agent: 'AI Assistant',
      columns: {
        number: '#',
        question: 'Question',
        answer: 'Answer',
        agent: 'AI Assistant',
        timestamp: 'Time',
        feedback: 'Feedback',
        satisfaction: 'Rating'
      },
      noData: 'No chat history found'
    },
    share: {
      title: 'Agent Sharing Management',
      unsharedTitle: 'Available Agents',
      sharedTitle: 'Shared Agents',
      description: 'Manage the agents you have shared with external websites and users.',
      noSharedAgents: 'You have not shared any agents yet.',
      noUnsharedAgents: 'No available agents to share.',
      columns: {
        name: 'Name',
        apiKey: 'API Key',
        origins: 'Allowed Origins',
        usage: 'Usage',
        expires: 'Expires',
        actions: 'Actions'
      },
      unlimited: 'Unlimited',
      neverExpires: 'Never',
      revoke: 'Revoke',
      share: 'Share',
      confirmRevoke: 'Are you sure you want to revoke access for this shared agent?',
      revokeSuccess: 'Agent access has been revoked',
      revokeError: 'Failed to revoke agent access',
      loading: 'Loading agents...',
      copyApiKey: 'Copy API Key',
      copied: 'Copied!'
    },
    accounts: {
      title: 'Account Management',
      addNew: 'Add New Account',
      form: {
        username: 'Username',
        password: 'Password',
        selectDepartment: 'Select Department',
        permissions: 'Permissions',
        addAccount: 'Add Account',
        deleteAccount: 'Delete'
      },
      errors: {
        required: 'Username and password are required',
        duplicate: 'An account with this username already exists'
      },
      roles: {
        user: 'User',
        administrator: 'Administrator'
      },
      permissions: {
        chat: 'Chat Access',
        accounts: 'Account Management',
        reports: 'View Reports',
        settings: 'System Settings'
      },
      confirmDelete: 'Are you sure you want to delete this account?',
      status: {
        active: 'Active',
        inactive: 'Inactive'
      }
    },
    accountEdit: {
      title: 'Edit User',
      back: 'Back',
      form: {
        username: 'Username',
        password: 'Password',
        passwordPlaceholder: 'Enter new password',
        passwordHint: 'Leave empty to keep current password',
        department: 'Department',
        role: 'Role',
        status: 'Status',
        permissions: 'Permissions',
        saveChanges: 'Save Changes'
      },
      roles: {
        user: 'User',
        administrator: 'Administrator'
      },
      status: {
        active: 'Active',
        inactive: 'Inactive'
      }
    },
    departments: {
      title: 'Department Management',
      addNew: 'Add New Department',
      form: {
        name: 'Department Name',
        description: 'Description',
        addButton: 'Add Department'
      },
      errors: {
        required: 'Department name is required',
        duplicate: 'A department with this name already exists'
      },
      stats: {
        users: 'Users',
        knowledgeBase: 'Knowledge Base'
      },
      actions: {
        delete: 'Delete',
        confirmDelete: 'Are you sure you want to delete this department?',
        cancel: 'Cancel',
        save: 'Save',
        edit: 'Edit'
      },
      loading: 'Loading...',
      noDepartments: 'No departments created yet'
    },
    departmentDetail: {
      loading: 'Loading...',
      backToDepartments: 'Back to Departments',
      teamMembers: 'Team Members',
      knowledgeBase: 'Knowledge Base',
      lastUpdated: 'Last updated:',
      userAdded: 'User added successfully',
      addUserError: 'Failed to add user to department',
      userRemoved: 'User removed successfully',
      removeUserError: 'Failed to remove user from department',
      confirmRemoveUser: 'Are you sure you want to remove this user?',
      members: 'Members',
      addUser: 'Add User',
      cancel: 'Cancel',
      add: 'Add',
      adding: 'Adding...',
      remove: 'Remove',
      userIdPlaceholder: 'Enter user ID or email',
      noMembers: 'No members in this department',
      noKnowledgeBases: 'No knowledge bases for this department',
      notFound: 'Department Not Found',
      notFoundMessage: 'The requested department could not be found.',
      back: 'Back'
    },
    breadcrumbs: {
      home: 'Home',
      knowledge: 'Knowledge',
      agent: 'Agent',
      accounts: 'Accounts',
      departments: 'Departments',
      history: 'History',
      share: 'Share',
      profile: 'Profile',
      settings: 'Settings'
    }
  },
  'zh-TW': {
    common: {
      cancel: '取消',
      processing: '處理中...',
      done: '完成',
      copied: '已複製！'
    },
    nav: {
      navigation: '導航',
      home: '首頁',
      knowledgeBase: '知識庫',
      knowledgeSetting: '知識設定',
      agents: '智能助理',
      agentSetting: '助理設定',
      history: '歷史紀錄',
      qaHistory: '問答歷史',
      share: '分享',
      shareSetting: '分享設定',
      accounts: '帳戶',
      accountSetting: '帳戶設定',
      departmentSetting: '部門設定',
      profile: '個人資料',
      settings: '設定',
      signOut: '登出'
    },
    agents: {
      general: {
        name: '一般助理',
        knowledge: '一般知識、日常任務和基本資訊'
      },
      code: {
        name: '程式專家',
        knowledge: '程式設計、軟體開發和技術解決方案'
      },
      writing: {
        name: '寫作助理',
        knowledge: '內容創作、文法和寫作改進'
      },
      placeholder: '請輸入問題...'
    } as AgentsTranslation,
    knowledge: {
      title: '知識庫',
      createNew: '建立新項目',
      searchPlaceholder: '搜尋知識庫...',
      newlyCreated: '最近新增',
      duplicateError: '已存在相同標題的知識庫項目',
      defaultItems: {
        gettingStarted: {
          title: '入門指南',
          description: '了解如何使用我們的 AI 聊天系統'
        },
        faq: {
          title: '常見問題',
          description: '常見問題解答'
        },
        api: {
          title: 'API 文件',
          description: '開發者技術文件'
        }
      }
    },
    knowledgeDetail: {
      backToKnowledge: '← 返回知識庫',
      notFound: '找不到知識項目',
      relatedData: '相關資料',
      addNewData: '新增資料',
      noData: '尚未新增資料。點擊"新增資料"開始。',
      fileUpload: '檔案上傳',
      linkInput: '連結輸入',
      uploadFiles: '上傳檔案',
      dragAndDrop: '拖放檔案到此處或點擊瀏覽',
      fileSizeLimit: '最大檔案大小：50MB',
      selectedFiles: '已選檔案',
      enterLink: '輸入 URL',
      linkDescription: '輸入網頁 URL 以匯入內容',
      cancel: '取消',
      uploading: '上傳中...',
      submit: '提交',
      table: {
        fileName: '檔案名稱',
        type: '類型',
        uploadTime: '上傳時間',
        status: '狀態',
        actions: '操作'
      },
      status: {
        finished: '已完成',
        processing: '處理中',
        error: '錯誤'
      },
      actions: {
        view: '檢視',
        delete: '刪除'
      },
      processing: {
        single: '正在處理 1 個項目...',
        multiple: '正在處理 {count} 個項目...'
      },
      errors: {
        duplicateFile: '已存在名為 "{name}" 的檔案。',
        duplicateUrl: '此 URL 已被新增。'
      }
    },
    agent: {
      title: '助理設定',
      yourAgents: '您的助理',
      createNew: '建立新助理',
      editAgent: '編輯助理',
      noAgents: '尚未建立助理',
      noKnowledgeBases: '沒有可用的知識庫',
      duplicateError: '已存在相同名稱的助理',
      duplicateKeyError: '已存在相同代碼的助理',
      nameRequired: '助理名稱為必填項目',
      shareAgent: '分享助理',
      shareSuccess: '助理分享成功',
      shareWarning: '請保護好此 API 金鑰。擁有此金鑰的任何人都可以使用您的助理。',
      apiKey: 'API 金鑰',
      embedCode: '嵌入代碼',
      copyEmbed: '複製嵌入代碼',
      shareButton: '分享助理',
      agentCreated: '助理建立成功',
      agentUpdated: '助理更新成功',
      agentDeleted: '助理刪除成功',
      form: {
        name: '助理名稱',
        namePlaceholder: '我的AI助理',
        agentKey: '助理代碼',
        agentKeyPlaceholder: '自定義代碼（選填）',
        model: '模型',
        temperature: '溫度',
        maxTokens: '最大字符數',
        knowledgeBase: '知識庫',
        noKnowledgeBase: '無知識庫',
        department: '部門',
        systemPrompt: '系統提示詞',
        systemPromptPlaceholder: '輸入定義助理行為的系統提示詞...',
        createAgent: '建立助理',
        saveChanges: '儲存變更',
        savingLoading: '儲存中...',
        shareName: '分享名稱',
        shareDescription: '描述',
        allowedOrigins: '允許的來源網域',
        allowedOriginsHint: '使用 * 代表任何網站，或用逗號分隔的域名列表',
        usageLimit: '使用次數限制',
        unlimited: '無限制',
        expiryDays: '過期天數',
        neverExpires: '永不過期',
        models: {
          gpt35Turbo: 'GPT-3.5 Turbo',
          gpt4: 'GPT-4',
          gpt4Turbo: 'GPT-4 進階版'
        }
      }
    },
    history: {
      title: '聊天記錄',
      loading: '載入中...',
      error: '載入記錄時發生錯誤',
      conversation: '對話',
      user: '使用者',
      agent: 'AI助理',
      columns: {
        number: '編號',
        question: '問題',
        answer: '回答',
        agent: 'AI助理',
        timestamp: '時間',
        feedback: '反饋',
        satisfaction: '評分'
      },
      noData: '沒有聊天記錄'
    },
    share: {
      title: 'Agent Sharing Management',
      unsharedTitle: 'Available Agents',
      sharedTitle: 'Shared Agents',
      description: 'Manage the agents you have shared with external websites and users.',
      noSharedAgents: 'You have not shared any agents yet.',
      noUnsharedAgents: 'No available agents to share.',
      columns: {
        name: '名稱',
        apiKey: 'API 金鑰',
        origins: '允許的來源網域',
        usage: '使用量',
        expires: '過期日期',
        actions: '操作'
      },
      unlimited: '無限制',
      neverExpires: '永不過期',
      revoke: '撤銷',
      share: '分享',
      confirmRevoke: '您確定要撤銷此共享助理的訪問權限嗎？',
      revokeSuccess: '助理訪問權限已撤銷',
      revokeError: '撤銷助理訪問權限失敗',
      loading: '載入助理中...',
      copyApiKey: '複製 API 金鑰',
      copied: '已複製！'
    },
    accounts: {
      title: '帳戶管理',
      addNew: '新增帳戶',
      form: {
        username: '使用者名稱',
        password: '密碼',
        selectDepartment: '選擇部門',
        permissions: '權限',
        addAccount: '新增帳戶',
        deleteAccount: '刪除'
      },
      errors: {
        required: '使用者名稱和密碼為必填項目',
        duplicate: '此使用者名稱已存在'
      },
      roles: {
        user: '使用者',
        administrator: '管理員'
      },
      permissions: {
        chat: '聊天權限',
        accounts: '帳戶管理',
        reports: '檢視報表',
        settings: '系統設定'
      },
      confirmDelete: '確定要刪除此帳戶嗎？',
      status: {
        active: '啟用',
        inactive: '停用'
      }
    },
    accountEdit: {
      title: '編輯使用者',
      back: '返回',
      form: {
        username: '使用者名稱',
        password: '密碼',
        passwordPlaceholder: '輸入新密碼',
        passwordHint: '留空以保持目前密碼',
        department: '部門',
        role: '角色',
        status: '狀態',
        permissions: '權限',
        saveChanges: '儲存變更'
      },
      roles: {
        user: '使用者',
        administrator: '管理員'
      },
      status: {
        active: '啟用',
        inactive: '停用'
      }
    },
    departments: {
      title: '部門管理',
      addNew: '新增部門',
      form: {
        name: '部門名稱',
        description: '描述',
        addButton: '新增部門'
      },
      errors: {
        required: '部門名稱為必填項目',
        duplicate: '已存在相同名稱的部門'
      },
      stats: {
        users: '使用者',
        knowledgeBase: '知識庫'
      },
      actions: {
        delete: '刪除',
        confirmDelete: '確定要刪除此部門嗎？',
        cancel: '取消',
        save: '儲存',
        edit: '編輯'
      },
      loading: '載入中...',
      noDepartments: '尚未建立任何部門'
    },
    departmentDetail: {
      loading: '載入中...',
      backToDepartments: '返回部門列表',
      teamMembers: '團隊成員',
      knowledgeBase: '知識庫',
      lastUpdated: '最後更新：',
      userAdded: '已成功新增使用者',
      addUserError: '新增使用者失敗',
      userRemoved: '已成功移除使用者',
      removeUserError: '移除使用者失敗',
      confirmRemoveUser: '確定要移除此使用者嗎？',
      members: '成員',
      addUser: '新增使用者',
      cancel: '取消',
      add: '新增',
      adding: '新增中...',
      remove: '移除',
      userIdPlaceholder: '輸入使用者 ID 或電子郵件',
      noMembers: '此部門尚無成員',
      noKnowledgeBases: '此部門尚無知識庫',
      notFound: '找不到部門',
      notFoundMessage: '找不到請求的部門。',
      back: '返回'
    },
    breadcrumbs: {
      home: '首頁',
      knowledge: '知識庫',
      agent: '助理',
      accounts: '帳戶',
      departments: '部門',
      history: '歷史記錄',
      share: '分享',
      profile: '個人資料',
      settings: '設定'
    }
  }
};

export const formatMessage = (template: string, values: Record<string, string>) => {
  return template.replace(/{(\w+)}/g, (match, key) => values[key] || match);
};

export const messageFormatter = (template: string, values: Record<string, string | number>) => {
  return template.replace(/{(\w+)}/g, (match, key) => {
    return values.hasOwnProperty(key) ? String(values[key]) : match;
  });
};
