'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { getSharedAgents, revokeSharedAgent, SharedAgent, getAgent, getAgents, Agent } from '@/utils/apiService';
import { toast } from 'react-hot-toast';
import ShareAgentModal from '@/components/ShareAgentModal';

export default function SharePage() {
  const { language } = useLanguage();
  const t = translations[language].share || {
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
  };

  const [sharedAgents, setSharedAgents] = useState<SharedAgent[]>([]);
  const [unsharedAgents, setUnsharedAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all agents and shared agents in parallel
      const [allAgents, sharedAgentsData] = await Promise.all([
        getAgents(),
        getSharedAgents()
      ]);

      if (!Array.isArray(allAgents)) {
        throw new Error('Failed to load agents');
      }

      if (!Array.isArray(sharedAgentsData)) {
        throw new Error('Failed to load shared agents');
      }

      // For each shared agent, get the full agent details
      const agentsWithDetails = await Promise.all(
        sharedAgentsData.map(async (sharedAgent) => {
          if (!sharedAgent?.agentId) {
            return null;
          }
          const agentDetails = await getAgent(sharedAgent.agentId);
          return {
            ...sharedAgent,
            agentDetails
          };
        })
      );

      // Filter out null values and set shared agents
      setSharedAgents(agentsWithDetails.filter((agent): agent is SharedAgent & { agentDetails: Agent | null } => agent !== null));

      // Filter out agents that are already shared
      const sharedAgentIds = new Set(sharedAgentsData.filter(agent => agent?.agentId).map(agent => agent.agentId));
      const unsharedAgentsList = allAgents.filter(agent => !sharedAgentIds.has(agent.id));
      setUnsharedAgents(unsharedAgentsList);
    } catch (error) {
      console.error('Error loading agents:', error);
      setError('Failed to load agents');
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (apiKey: string) => {
    if (!apiKey || !window.confirm(t.confirmRevoke)) {
      return;
    }

    try {
      await revokeSharedAgent(apiKey);
      setSharedAgents(prev => prev.filter(agent => agent.apiKey !== apiKey));
      // Reload agents to update the unshared list
      loadAgents();
      toast.success(t.revokeSuccess);
    } catch (error) {
      console.error('Error revoking agent:', error);
      toast.error(t.revokeError);
    }
  };

  const handleShare = (agent: Agent) => {
    if (!agent) return;
    setSelectedAgent(agent);
    setIsShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    setSelectedAgent(null);
    setIsShareModalOpen(false);
    loadAgents(); // Reload the agents to update the lists
  };

  const copyToClipboard = (apiKey: string) => {
    if (!apiKey) return;

    navigator.clipboard.writeText(apiKey);
    setCopiedKey(apiKey);
    toast.success(t.copied);

    setTimeout(() => {
      setCopiedKey(null);
    }, 3000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t.neverExpires;

    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-6 pt-20">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-6 pt-20">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">{t.title}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">{t.description}</p>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3">{t.loading}</span>
          </div>
        ) : (
          <>
            {/* Unshared Agents Section */}
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">{t.unsharedTitle}</h2>
              {unsharedAgents.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400">{t.noUnsharedAgents}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t.columns.name}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {unsharedAgents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium">{agent.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {agent.description}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleShare(agent)}
                              className="inline-flex items-center justify-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              {t.share}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Shared Agents Section */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">{t.sharedTitle}</h2>
              {sharedAgents.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400">{t.noSharedAgents}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t.columns.name}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t.columns.apiKey}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t.columns.origins}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t.columns.usage}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t.columns.expires}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t.columns.actions}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {sharedAgents.map((agent) => (
                        <tr key={agent.id || 'unknown'} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium">{agent?.name || 'Unnamed Agent'}</div>
                            {agent?.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {agent.description}
                              </div>
                            )}
                            {agent?.agentDetails && (
                              <>
                                {agent.agentDetails.model && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Model: {agent.agentDetails.model}
                                  </div>
                                )}
                                {agent.agentDetails.department_name && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Department: {agent.agentDetails.department_name}
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono">
                                {agent?.apiKey ?
                                  `${agent.apiKey.substring(0, 8)}...${agent.apiKey.substring(agent.apiKey.length - 8)}` :
                                  'No API Key'}
                              </span>
                              {agent?.apiKey && (
                                <button
                                  onClick={() => copyToClipboard(agent.apiKey)}
                                  className="text-blue-500 hover:text-blue-700 text-xs"
                                >
                                  {copiedKey === agent.apiKey ? t.copied : t.copyApiKey}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {agent?.allowedOrigins?.includes('*') ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
                                Any website
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {agent?.allowedOrigins?.map((origin, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
                                  >
                                    {origin}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {agent?.usageLimit ? (
                              <span>{agent.usageCount || 0} / {agent.usageLimit}</span>
                            ) : (
                              <span>{agent?.usageCount || 0} / {t.unlimited}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {agent?.expiresAt ? formatDate(agent.expiresAt) : t.neverExpires}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleRevoke(agent?.apiKey || '')}
                              className="inline-flex items-center justify-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              {t.revoke}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Share Modal */}
      {selectedAgent && (
        <ShareAgentModal
          isOpen={isShareModalOpen}
          onClose={handleCloseShareModal}
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
        />
      )}
    </div>
  );
}
