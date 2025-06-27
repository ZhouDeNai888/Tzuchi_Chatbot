'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { translations } from '@/utils/translations';
import { getUserInfo } from '@/utils/authService';
import {
  getAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  getKnowledgeBases,
  getAllModels,
  getDepartments,
  Agent
} from '@/utils/apiService';
import { toast } from 'react-hot-toast';

import { useRouter } from 'next/navigation';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

interface KnowledgeBase {
  id: number;
  title: string;
  description: string;
}

export default function AgentPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const { user } = useAuth();
  const [settings, setSettings] = useState<{
    name: string;
    agent_key: string;
    model: string;
    temperature: number;
    max_tokens: number;
    system_prompt: string;
    knowledge_base_ids: number[];
    department_id: number;
    nftext: string;
    description: string;
  }>({
    name: '',
    agent_key: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 2000,
    system_prompt: '',
    knowledge_base_ids: [],
    department_id: 0,
    nftext: '',
    description: ''
  });
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>(['gpt-4o-mini']);
  const [fullModelData, setFullModelData] = useState<any[]>([]);
  const { language } = useLanguage();
  const t = translations[language].agent;
  const [isAdmin, setIsAdmin] = useState(false);
  const [fullAdmin, setFullAdmin] = useState(false);
  const [useAgent, setUseAgent] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  // Add search states for departments and knowledge bases
  const [departmentSearchQuery, setDepartmentSearchQuery] = useState('');
  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [filteredDepartments, setFilteredDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [filteredKnowledgeBases, setFilteredKnowledgeBases] = useState<KnowledgeBase[]>([]);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        setPermissionLoading(true);
        setPermissionError(null);
        console.log("Checking agent page permissions...");

        try {
          // ตรวจสอบสิทธิ์ของผู้ใช้ให้มีประสิทธิภาพมากขึ้น
          const userInfo = await getUserInfo();
          console.log("User info loaded:", userInfo);

          const isAdmin = userInfo?.UserRole === 'admin' || userInfo?.role === 'admin';
          setIsAdmin(isAdmin);
          console.log("Admin status:", isAdmin);

          // ถ้าเป็น admin สามารถเข้าถึงได้เลย ไม่ต้องตรวจสอบสิทธิ์เพิ่ม
          if (isAdmin) {
            setUseAgent(true);
            setFullAdmin(true);
            setPermissionLoading(false);
            return;
          }

          // Assume user has access by default and let the API calls determine access
          // If API returns authentication errors, they will be handled accordingly
          setUseAgent(true);
          setPermissionLoading(false);

        } catch (error) {
          console.error("Error loading user data:", error);
          // หากไม่สามารถตรวจสอบข้อมูลผู้ใช้ได้ ให้อนุญาตการเข้าถึงชั่วคราว
          // โดยสมมติว่าผู้ใช้มีสิทธิ์ (เพื่อหลีกเลี่ยงปัญหาหน้าไม่สามารถเข้าถึงได้)
          setIsAdmin(true);
          setUseAgent(true);
        }

      } catch (error) {
        console.error("Permission check error:", error);
        setPermissionError("Failed to check permissions");
      } finally {
        setPermissionLoading(false);
      }
    };

    checkPermissions();
  }, []);

  useEffect(() => {
    if (!permissionLoading && (isAdmin || fullAdmin || useAgent)) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const [agentsData, kbData, modelsData, departmentsData] = await Promise.all([
            getAgents(),
            getKnowledgeBases(),
            getAllModels(),
            getDepartments()
          ]);

          setAgents(agentsData);
          setKnowledgeBases(kbData);
          const transformedDepartments = departmentsData.map(dept => ({
            id: Number(dept.department_id) || 0,
            name: dept.name
          }));
          console.log("Transformed departments:", transformedDepartments);
          setDepartments(transformedDepartments);

          if (modelsData && modelsData.length > 0) {
            // Store the full model data array for reference
            setFullModelData(modelsData);
            setAvailableModels(modelsData.map(model => model.ModelName));
            // Set initial model to first available model
            setSettings(prev => ({
              ...prev,
              model: modelsData[0].ModelName
            }));
          }
        } catch (error) {
          console.error('Error fetching data:', error);
          toast.error('Failed to load data');
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [permissionLoading, isAdmin, fullAdmin, useAgent]);

  useEffect(() => {
    if (user && user.departments && user.departments.length > 0) {
      setSettings(prev => ({
        ...prev,
        department_id: user.departments[0].id
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!selectedAgent && user && user.departments && user.departments.length > 0) {
      setSettings(prev => ({
        ...prev,
        department_id: user.departments[0].id
      }));
    }
  }, [selectedAgent, user]);

  const hasNoAgents = agents.length === 0 || (agents as any).noAgentsFound;

  const isDuplicateName = (name: string, currentId?: number): boolean => {
    return agents.some(agent =>
      agent.name.toLowerCase() === name.toLowerCase() && agent.id !== currentId
    );
  };

  const isDuplicateAgentKey = (agent_key: string, currentId?: number): boolean => {
    return agents.some(agent =>
      agent.agent_key === agent_key && agent.id !== currentId
    );
  };

  const generateUniqueAgentKey = (baseName: string): string => {
    let key = baseName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 30);

    if (!isDuplicateAgentKey(key)) {
      return key;
    }

    let counter = 1;
    let newKey = `${key}-${counter}`;

    while (isDuplicateAgentKey(newKey) && counter < 100) {
      counter++;
      newKey = `${key}-${counter}`;
    }

    return newKey;
  };

  // Add a function to refresh data
  const refreshData = async () => {
    try {
      setLoading(true);
      const agentsData = await getAgents();
      setAgents(agentsData);

      // Get default department ID safely
      let defaultDepartmentId = 0;
      if (user && user.departments && user.departments.length > 0) {
        defaultDepartmentId = user.departments[0].id;
      }

      // Reset form and selection after refresh
      setSelectedAgent(null);
      setSettings({
        name: '',
        agent_key: '',
        model: availableModels.length > 0 ? availableModels[0] : 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 2000,
        system_prompt: '',
        knowledge_base_ids: [],
        department_id: defaultDepartmentId,
        nftext: '',
        description: ''
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!settings.name.trim()) {
      toast.error(t.nameRequired);
      return;
    }

    try {
      setLoading(true);
      if (selectedAgent) {
        if (isDuplicateName(settings.name, selectedAgent.id)) {
          toast.error(t.duplicateError);
          return;
        }

        if (settings.agent_key &&
          settings.agent_key !== selectedAgent.agent_key &&
          isDuplicateAgentKey(settings.agent_key, selectedAgent.id)) {
          toast.error(t.duplicateKeyError || 'Agent key already exists');
          return;
        }

        await updateAgent(selectedAgent.id, settings);
        toast.success(t.agentUpdated);

        // Refresh data instead of reloading page
        await refreshData();
      } else {
        if (isDuplicateName(settings.name)) {
          toast.error(t.duplicateError);
          return;
        }

        if (settings.agent_key) {
          if (isDuplicateAgentKey(settings.agent_key)) {
            toast.error(t.duplicateKeyError || 'Agent key already exists');
            return;
          }
        } else {
          settings.agent_key = generateUniqueAgentKey(settings.name);
        }

        await createAgent(settings);
        toast.success(t.agentCreated);

        // Refresh data instead of reloading page
        await refreshData();
      }
    } catch (error) {
      console.error('Error saving agent:', error);
      if (error instanceof Error) {
        toast.error(error.message || 'Failed to save agent');
      } else {
        toast.error('Failed to save agent');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: name === 'temperature' || name === 'max_tokens' ? Number(value) : value
    }));
  };

  const handleKnowledgeBaseChange = (knowledgeBaseIds: number[]) => {
    setSettings(prev => ({
      ...prev,
      knowledge_base_ids: knowledgeBaseIds
    }));
  };

  const handleDepartmentChange = (departmentId: number) => {
    setSettings(prev => ({
      ...prev,
      department_id: departmentId
    }));
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setSettings({
      name: agent.name,
      agent_key: agent.agent_key || '',
      model: agent.model,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
      system_prompt: agent.system_prompt,
      knowledge_base_ids: Array.isArray(agent.knowledge_base_ids)
        ? agent.knowledge_base_ids.filter((id): id is number => id !== null)
        : agent.knowledge_base_ids ? [agent.knowledge_base_ids] : [],
      department_id: agent.department_id || 0,
      nftext: agent.nftext || '',
      description: agent.description || ''
    });
  };

  const handleCreateNew = () => {
    setSelectedAgent(null);
    setSettings({
      name: '',
      agent_key: '',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 2000,
      system_prompt: '',
      knowledge_base_ids: [],
      department_id: 0,
      nftext: '',
      description: ''
    });
  };

  const handleDeleteAgent = async (agentId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    // Set the agent to delete and open the confirmation dialog
    setAgentToDelete(agentId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteAgent = async () => {
    if (!agentToDelete) return;

    // Close the confirmation dialog immediately
    setDeleteConfirmOpen(false);
    setAgentToDelete(null);

    try {
      setLoading(true);
      await deleteAgent(agentToDelete);
      setAgents(agents.filter(agent => agent.id !== agentToDelete));

      if (selectedAgent?.id === agentToDelete) {
        setSelectedAgent(null);
        setSettings({
          name: '',
          agent_key: '',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 2000,
          system_prompt: '',
          knowledge_base_ids: [],
          department_id: 0,
          nftext: '',
          description: ''
        });
      }

      toast.success(t.agentDeleted);
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    } finally {
      setLoading(false);
    }
  };

  const cancelDeleteAgent = () => {
    setDeleteConfirmOpen(false);
    setAgentToDelete(null);
  };

  useEffect(() => {
    if (agents.length > 0) {
      if (searchQuery.trim() === '') {
        setFilteredAgents(agents);
      } else {
        const filtered = agents.filter(agent =>
          agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (agent.description && agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        setFilteredAgents(filtered);
      }
    }
  }, [searchQuery, agents]);

  useEffect(() => {
    console.log(departments.length, "departments length");
    if (departments.length > 0) {
      console.log("Filtering departments with query:", departmentSearchQuery);
      if (departmentSearchQuery.trim() == '') {
        console.log(departments, "departments without filter");
        setFilteredDepartments(departments);
      } else {
        const filtered = departments.filter(dept =>
          dept.name.toLowerCase().includes(departmentSearchQuery.toLowerCase())
        );
        setFilteredDepartments(filtered);
      }
    } else {
      console.warn("No departments available to filter");
      setFilteredDepartments([]);
    }
    console.log("Filtered departments:", filteredDepartments);

  }, [departmentSearchQuery, departments]);

  useEffect(() => {
    if (knowledgeBases.length > 0) {
      if (kbSearchQuery.trim() === '') {
        setFilteredKnowledgeBases(knowledgeBases);
      } else {
        const filtered = knowledgeBases.filter(kb =>
          kb.title.toLowerCase().includes(kbSearchQuery.toLowerCase()) ||
          (kb.description && kb.description.toLowerCase().includes(kbSearchQuery.toLowerCase()))
        );
        setFilteredKnowledgeBases(filtered);
      }
    } else {
      setFilteredKnowledgeBases([]);
    }
  }, [kbSearchQuery, knowledgeBases]);

  // Group models by platform
  const getModelsByPlatform = () => {
    const platformGroups: Record<string, any[]> = {};

    fullModelData.forEach(model => {
      if (!platformGroups[model.Platform]) {
        platformGroups[model.Platform] = [];
      }
      platformGroups[model.Platform].push(model);
    });

    return platformGroups;
  };

  if (permissionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-8 pt-16 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-8 pt-16 flex justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="mb-4">{permissionError}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin && !fullAdmin && !useAgent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-8 pt-16 flex justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">You don't have permission to access this page.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-8 pt-16 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">{t.title}</h1>

        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">{t.yourAgents}</h2>
                  <button
                    onClick={handleCreateNew}
                    className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
                    title={t.createNew}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder={translations[language].knowledge?.searchPlaceholder || "Search agents..."}
                  />
                </div>
                {hasNoAgents ? (
                  <p className="text-gray-400">{t.noAgents}</p>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                    {filteredAgents.map(agent => (
                      <div
                        key={agent.id}
                        className={`group relative flex items-center w-full text-left p-3 rounded-md transition-colors ${selectedAgent?.id === agent.id
                          ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white'
                          : 'bg-gradient-to-r from-purple-100 via-pink-100 to-orange-100 dark:from-purple-900/40 dark:via-pink-900/40 dark:to-orange-900/40 hover:from-purple-200 hover:via-pink-200 hover:to-orange-200 dark:hover:from-purple-900/60 dark:hover:via-pink-900/60 dark:hover:to-orange-900/60'
                          }`}
                      >
                        <button
                          onClick={() => handleSelectAgent(agent)}
                          className="flex-1 text-left"
                          title={agent.name}
                        >
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">{agent.model}</div>
                        </button>
                        <button
                          onClick={(e) => handleDeleteAgent(agent.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-opacity absolute right-2"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold mb-6">
                  {selectedAgent ? t.editAgent : t.createNew}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-2">
                      {t.form.name}
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={settings.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={t.form.namePlaceholder}
                    />
                  </div>

                  <div>
                    <label htmlFor="model" className="block text-sm font-medium mb-2">
                      {t.form.model}
                    </label>
                    <select
                      id="model"
                      name="model"
                      value={settings.model}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      {Object.entries(getModelsByPlatform()).map(([platform, models]) => (
                        <optgroup key={platform} label={platform}>
                          {models.map(model => (
                            <option key={model.ModelID} value={model.ModelName}>
                              {model.ModelName}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="temperature" className="block text-sm font-medium mb-2">
                      {t.form.temperature} ({settings.temperature})
                    </label>
                    <input
                      type="range"
                      id="temperature"
                      name="temperature"
                      min="0"
                      max="1"
                      step="0.01"
                      value={settings.temperature}
                      onChange={handleChange}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="max_tokens" className="block text-sm font-medium mb-2">
                      {t.form.maxTokens}
                    </label>
                    <input
                      type="number"
                      id="max_tokens"
                      name="max_tokens"
                      value={settings.max_tokens}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      min="1"
                      max="32000"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium">
                        {t.form.knowledgeBase}
                      </label>
                      <input
                        type="text"
                        value={kbSearchQuery}
                        onChange={(e) => setKbSearchQuery(e.target.value)}
                        className="w-48 px-3 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                        placeholder={`${translations[language].knowledge.searchPlaceholder} / ${translations[language === 'en' ? 'zh-TW' : 'en'].knowledge.searchPlaceholder}`}
                      />
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {knowledgeBases.length === 0 ? (
                        <p className="text-gray-400">{t.noKnowledgeBases}</p>
                      ) : (
                        <>
                          {filteredKnowledgeBases.map((kb) => (
                            <label
                              key={kb.id}
                              htmlFor={`kb-${kb.id}`}
                              className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                id={`kb-${kb.id}`}
                                name="knowledgeBase"
                                checked={settings.knowledge_base_ids.includes(kb.id)}
                                onChange={() => {
                                  const updatedKnowledgeBaseIds = settings.knowledge_base_ids.includes(kb.id)
                                    ? settings.knowledge_base_ids.filter(id => id !== kb.id)
                                    : [...settings.knowledge_base_ids, kb.id];
                                  handleKnowledgeBaseChange(updatedKnowledgeBaseIds);
                                }}
                                className="text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                              />
                              <div>
                                <div className="font-medium">{kb.title}</div>
                                <div className="text-sm text-gray-400">{kb.description}</div>
                              </div>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {(isAdmin || fullAdmin || useAgent) && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium">
                          {t.form?.department || 'Department'}
                        </label>
                        <input
                          type="text"
                          value={departmentSearchQuery}
                          onChange={(e) => setDepartmentSearchQuery(e.target.value)}
                          className="w-48 px-3 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                          placeholder={`${translations[language].departments?.search?.placeholder?.replace('...', '') || 'Search Department'} / ${translations[language === 'en' ? 'zh-TW' : 'en'].departments?.search?.placeholder?.replace('...', '') || '搜尋部門'}`}
                        />
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {/* Check if no departments are available to show proper message */}
                        {filteredDepartments.length === 0 ? (
                          <p className="text-gray-400">{translations[language].departments?.noDepartments || 'No departments available'}</p>
                        ) : (
                          <>
                            {/* Only filter departments if user is not admin - admins can see all */}
                            {filteredDepartments
                              .filter(dept =>
                                isAdmin || fullAdmin ||
                                !user?.departments || // If user.departments is undefined or null, show all departments
                                user.departments.length === 0 || // If user has no departments assigned, show all departments
                                user.departments.some(userDept => {
                                  // Use type assertion to access either property safely
                                  const deptId = (userDept as any).DepartmentID || userDept.id;
                                  return deptId === dept.id;
                                })
                              )
                              .map((dept) => (
                                <label
                                  key={dept.id}
                                  htmlFor={`dept-${dept.id}`}
                                  className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                                >
                                  <input
                                    type="radio"
                                    id={`dept-${dept.id}`}
                                    name="department"
                                    checked={settings.department_id === dept.id}
                                    onChange={() => handleDepartmentChange(dept.id)}
                                    className="text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                                  />
                                  <div className="font-medium">{dept.name}</div>
                                </label>
                              ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="system_prompt" className="block text-sm font-medium mb-2">
                      {t.form.systemPrompt}
                    </label>
                    <textarea
                      id="system_prompt"
                      name="system_prompt"
                      value={settings.system_prompt}
                      onChange={handleChange}
                      rows={4}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={t.form.systemPromptPlaceholder}
                    />
                  </div>

                  <div>
                    <label htmlFor="nftext" className="block text-sm font-medium mb-2">
                      {t.form.fallbackMessage}
                    </label>
                    <textarea
                      id="nftext"
                      name="nftext"
                      value={settings.nftext}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={t.form.fallbackMessagePlaceholder}
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {t.form.fallbackMessageHelp}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium mb-2">
                      {t.form.description || 'Description'}
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={settings.description}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={t.form.descriptionPlaceholder || 'Enter agent description...'}
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {t.form.descriptionHelp || 'Describe what this agent is used for.'}
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        {t.form.savingLoading}
                      </span>
                    ) : (
                      selectedAgent ? t.form.saveChanges : t.form.createAgent
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog for agent deletion */}
      <ConfirmDeleteModal
        isOpen={deleteConfirmOpen}
        onClose={cancelDeleteAgent}
        onConfirm={confirmDeleteAgent}
        title={t.confirmDeleteTitle}
        message={t.confirmDeleteMessage}
      />
    </div>
  );
}