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
  getAvailableModels,
  getDepartments,
  checkUserPermission,
  Agent
} from '@/utils/apiService';
import { toast } from 'react-hot-toast';
import { redirect } from 'next/dist/server/api-utils';

interface KnowledgeBase {
  id: number;
  title: string;
  description: string;
}

export default function AgentPage() {
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
  }>({
    name: '',
    agent_key: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: 2000,
    system_prompt: '',
    knowledge_base_ids: [],
    department_id: 0
  });
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>(['gpt-3.5-turbo']);
  const { language } = useLanguage();
  const t = translations[language].agent;
  const [isAdmin, setIsAdmin] = useState(false);
  const [fullAdmin, setFullAdmin] = useState(false);
  const [useAgent, setUseAgent] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [agentsData, kbData, modelsData, departmentsData] = await Promise.all([
          getAgents(),
          getKnowledgeBases(),
          getAvailableModels(),
          getDepartments()
        ]);

        setAgents(agentsData);
        setKnowledgeBases(kbData);
        // Transform department data to ensure id is a number
        const transformedDepartments = departmentsData.map(dept => ({
          id: Number(dept.department_id) || 0, // Convert to number and default to 0 if undefined
          name: dept.name
        }));
        setDepartments(transformedDepartments);

        // Check if user is admin
        const userInfo = await getUserInfo();
        const isAdmin = userInfo.UserRole;
        setIsAdmin(isAdmin);
        const isUseAgent = await checkUserPermission('use_agent');
        setUseAgent(isUseAgent);
        const isFullAdmin = await checkUserPermission('full_admin');
        setFullAdmin(isFullAdmin);

        // Set available models from API
        if (modelsData && modelsData.length > 0) {
          setAvailableModels(modelsData);
          setSettings(prev => ({
            ...prev,
            model: modelsData[0] // Set first available model as default
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
  }, []);

  useEffect(() => {
    // Set department_id to the user's first department if available
    if (user && user.departments && user.departments.length > 0) {
      setSettings(prev => ({
        ...prev,
        department_id: user.departments[0].id
      }));
    }
  }, [user]);

  // Reset department_id when creating new agent
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
    // Start with the normal key generation
    let key = baseName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 30);

    // Check if key exists
    if (!isDuplicateAgentKey(key)) {
      return key;
    }

    // If duplicate, append numbers until unique
    let counter = 1;
    let newKey = `${key}-${counter}`;

    while (isDuplicateAgentKey(newKey) && counter < 100) {
      counter++;
      newKey = `${key}-${counter}`;
    }

    return newKey;
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
        // Check for duplicate name
        if (isDuplicateName(settings.name, selectedAgent.id)) {
          toast.error(t.duplicateError);
          return;
        }

        // Check for duplicate agent_key if it was changed
        if (settings.agent_key &&
          settings.agent_key !== selectedAgent.agent_key &&
          isDuplicateAgentKey(settings.agent_key, selectedAgent.id)) {
          toast.error(t.duplicateKeyError || 'Agent key already exists');
          return;
        }

        const updatedAgent = await updateAgent(selectedAgent.id, settings);
        setAgents(agents.map(agent =>
          agent.id === selectedAgent.id ? updatedAgent : agent
        ));
        toast.success(t.agentUpdated);
      } else {
        // Check for duplicate name
        if (isDuplicateName(settings.name)) {
          toast.error(t.duplicateError);
          return;
        }

        // If agent_key is provided, check if it's unique
        if (settings.agent_key) {
          if (isDuplicateAgentKey(settings.agent_key)) {
            toast.error(t.duplicateKeyError || 'Agent key already exists');
            return;
          }
        } else {
          // If not provided, generate a unique one
          settings.agent_key = generateUniqueAgentKey(settings.name);
        }

        const newAgent = await createAgent(settings);
        setAgents([...agents, newAgent]);
        toast.success(t.agentCreated);
      }

      setSettings({
        name: '',
        agent_key: '',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 2000,
        system_prompt: '',
        knowledge_base_ids: [],
        department_id: 0
      });
      setSelectedAgent(null);
      window.location.reload(); // Reload the page to reflect changes
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
    console.log('Knowledge base IDs:', knowledgeBaseIds);
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
    console.log('Selected agent:', agent);
    console.log('Selected agent knowledge base IDs:', agent.knowledge_base_ids);
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
      department_id: agent.department_id || 0
    });
  };

  const handleCreateNew = () => {
    setSelectedAgent(null);
    setSettings({
      name: '',
      agent_key: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 2000,
      system_prompt: '',
      knowledge_base_ids: [],
      department_id: 0
    });
  };

  const handleDeleteAgent = async (agentId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setLoading(true);
      await deleteAgent(agentId);
      setAgents(agents.filter(agent => agent.id !== agentId));

      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
        setSettings({
          name: '',
          agent_key: '',
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          max_tokens: 2000,
          system_prompt: '',
          knowledge_base_ids: [],
          department_id: 0
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
            {/* Agent List */}
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
                {hasNoAgents ? (
                  <p className="text-gray-400">{t.noAgents}</p>
                ) : (
                  <div className="space-y-2">
                    {agents.map(agent => (
                      <div
                        key={agent.id}
                        className={`group relative flex items-center w-full text-left p-3 rounded-md transition-colors ${selectedAgent?.id === agent.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        <button
                          onClick={() => handleSelectAgent(agent)}
                          className="flex-1 text-left"
                          title={agent.name}
                        >
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-gray-300">{agent.model}</div>
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

            {/* Settings Form */}
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
                    <label htmlFor="agent_key" className="block text-sm font-medium mb-2">
                      {t.form.agentKey}
                    </label>
                    <input
                      type="text"
                      id="agent_key"
                      name="agent_key"
                      value={settings.agent_key}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder={t.form.agentKeyPlaceholder}
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
                      {availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
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
                    <label className="block text-sm font-medium mb-2">
                      {t.form.knowledgeBase}
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {knowledgeBases.length === 0 ? (
                        <p className="text-gray-400">{t.noKnowledgeBases}</p>
                      ) : (
                        knowledgeBases.map((kb) => (
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
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add department selection for admin users */}
                  {(isAdmin || fullAdmin || useAgent) && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {t.form?.department || 'Department'}
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {departments
                          .filter(dept =>
                            // Show all departments for admin/full admin users
                            isAdmin || fullAdmin ||
                            // For regular users, only show their assigned departments
                            (user?.departments?.some(userDept => userDept.id === dept.id))
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
    </div>
  );
}