'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { getSharedAgents, revokeSharedAgent, SharedAgent, getAgent, getAgents, Agent } from '@/utils/apiService';
import { toast } from 'react-hot-toast';
import ShareAgentModal from '@/components/ShareAgentModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { QRCodeSVG } from 'qrcode.react';

// Define a type for the share translations to ensure all required properties are present
type ShareTranslations = {
  title: string;
  unsharedTitle: string;
  sharedTitle: string;
  description: string;
  noSharedAgents: string;
  noUnsharedAgents: string;
  columns: {
    name: string;
    apiKey: string;
    origins: string;
    usage: string;
    expires: string;
    actions: string;
  };
  unlimited: string;
  neverExpires: string;
  revoke: string;
  share: string;
  confirmRevoke: string;
  revokeSuccess: string;
  revokeError: string;
  loading: string;
  copyApiKey: string;
  copied: string;
  details: string;
  hideDetails: string;
  viewAgent: string;
  embedCode: string;
  copyEmbed: string;
  qrCode: string;
  previewEmbed: string;
  configureAndShare: string;
  search: string;
  searchPlaceholder: string;
  pagination: {
    showing: string;
    of: string;
    itemsPerPage: string;
    prev: string;
    next: string;
  };
  noSearchResults: string;
};

export default function SharePage() {
  const { language } = useLanguage();
  const defaultTranslations: ShareTranslations = {
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
    copied: 'Copied!',
    details: 'Details',
    hideDetails: 'Hide Details',
    viewAgent: 'View Agent',
    embedCode: 'Embed Code',
    copyEmbed: 'Copy Embed Code',
    qrCode: 'QR Code',
    previewEmbed: 'Preview',
    configureAndShare: 'Configure & Share',
    search: 'Search',
    searchPlaceholder: 'Search agents...',
    pagination: {
      showing: 'Showing',
      of: 'of',
      itemsPerPage: 'items per page',
      prev: 'Previous',
      next: 'Next'
    },
    noSearchResults: 'No agents found matching your search'
  };

  // Use the type assertion to ensure TypeScript knows all required properties exist
  const t = (translations[language]?.share || defaultTranslations) as ShareTranslations;

  // Add state for confirm modal
  const [isLoading, setIsLoading] = useState(true);
  const [sharedAgents, setSharedAgents] = useState<SharedAgent[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState<string>('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [activeTabs, setActiveTabs] = useState<Record<string, 'embed' | 'qr'>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [isConfirmRevokeOpen, setIsConfirmRevokeOpen] = useState(false);
  const [revokeAgentId, setRevokeAgentId] = useState<string | null>(null);

  // Search and pagination for Available Agents
  const [availableSearchTerm, setAvailableSearchTerm] = useState('');
  const [availableCurrentPage, setAvailableCurrentPage] = useState(1);
  const [availableAgentsPerPage] = useState(9); // 9 cards fit well in a 3x3 grid

  // Search and pagination for Shared Agents
  const [sharedSearchTerm, setSharedSearchTerm] = useState('');
  const [sharedCurrentPage, setSharedCurrentPage] = useState(1);
  const [sharedAgentsPerPage] = useState(8);

  // Fetch shared and available agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setIsLoading(true);

        // Get shared agents
        const sharedData = await getSharedAgents();
        setSharedAgents(sharedData);

        // Get all available agents that could be shared
        const availableData = await getAgents();

        // Filter out agents that have already been shared
        const sharedAgentIds = sharedData.map(agent => agent.agentId);
        const unsharedAgents = availableData.filter(agent => !sharedAgentIds.includes(agent.id));

        setAvailableAgents(unsharedAgents);
      } catch (error) {
        console.error('Error fetching agents:', error);
        toast.error('Failed to load agents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, []);

  // Function to get a gradient background style for cards
  const getCardGradient = (index: number) => {
    // Array of gradient styles to cycle through
    const gradients = [
      'bg-gradient-to-r from-pink-500 to-purple-500',
      'bg-gradient-to-r from-purple-500 to-indigo-500',
      'bg-gradient-to-r from-indigo-500 to-blue-500',
      'bg-gradient-to-r from-blue-500 to-cyan-500',
      'bg-gradient-to-r from-cyan-500 to-teal-500',
      'bg-gradient-to-r from-teal-500 to-green-500',
      'bg-gradient-to-r from-green-500 to-lime-500',
      'bg-gradient-to-r from-lime-500 to-yellow-500',
      'bg-gradient-to-r from-yellow-500 to-amber-500',
      'bg-gradient-to-r from-amber-500 to-orange-500',
      'bg-gradient-to-r from-orange-500 to-red-500',
      'bg-gradient-to-r from-red-500 to-pink-500',
    ];

    return gradients[index % gradients.length];
  };

  // Get appropriate text color based on whether card is expanded
  const getTextColorClass = (isExpanded: boolean) => {
    return isExpanded ? 'text-gray-900 dark:text-white' : 'text-white';
  };

  // Show the confirm revoke modal
  const handleOpenRevokeModal = (apiKey: string) => {
    setRevokeAgentId(apiKey);
    setIsConfirmRevokeOpen(true);
  };

  // Handle revoking shared agent access
  const handleRevoke = async (apiKey: string) => {
    try {
      await revokeSharedAgent(apiKey);

      // Find the agent that was revoked before removing it from the shared list
      const revokedAgent = sharedAgents.find(agent => agent.apiKey === apiKey);

      // Update the list by removing the revoked agent
      setSharedAgents(prev => prev.filter(agent => agent.apiKey !== apiKey));

      // If we have the agent ID of the revoked agent, get its full details and add to available agents
      if (revokedAgent) {
        try {
          const agentDetails = await getAgent(revokedAgent.agentId);
          if (agentDetails) {
            setAvailableAgents(prev => [...prev, agentDetails]);
          }
        } catch (error) {
          console.error('Error fetching revoked agent details:', error);
        }
      }

      toast.success(t.revokeSuccess);
    } catch (error) {
      console.error('Error revoking shared agent:', error);
      toast.error(t.revokeError);
    }
  };

  // Handle opening the share modal for a specific agent
  const handleShareAgent = (agentId: number, agentName: string) => {
    setSelectedAgentId(agentId);
    setSelectedAgentName(agentName);
    setIsShareModalOpen(true);
  };

  // Copy text to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(prev => ({
      ...prev,
      [id]: true
    }));

    toast.success(t.copied);

    setTimeout(() => {
      setCopied(prev => ({
        ...prev,
        [id]: false
      }));
    }, 3000);
  };

  // Toggle expanded state for a card
  const toggleCardExpanded = (id: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Toggle between embed and QR tabs
  const toggleTab = (id: string, tab: 'embed' | 'qr') => {
    setActiveTabs(prev => ({
      ...prev,
      [id]: tab
    }));
  };

  // Get embed code for a specific agent
  const getEmbedCode = (apiKey: string) => {
    // Include theme parameter - default to 'light' if not explicitly set in shared agent config
    return `<tcu-ai></tcu-ai><script src="${window.location.origin}/api/embed.js" id="ai-chat-embed" data-api-key="${apiKey}" data-theme="light"></script>`;
  };

  // Get preview URL for embed
  const getEmbedPreviewUrl = (apiKey: string) => {
    return `${window.location.origin}/preview?apiKey=${apiKey}`;
  };

  // Filter agents based on search term for Available Agents
  const filteredAvailableAgents = availableAgents.filter(agent =>
    agent.name.toLowerCase().includes(availableSearchTerm.toLowerCase()) ||
    (agent.description && agent.description.toLowerCase().includes(availableSearchTerm.toLowerCase()))
  );

  // Calculate pagination data for Available Agents
  const totalAvailablePages = Math.ceil(filteredAvailableAgents.length / availableAgentsPerPage);
  const paginatedAvailableAgents = filteredAvailableAgents.slice(
    (availableCurrentPage - 1) * availableAgentsPerPage,
    availableCurrentPage * availableAgentsPerPage
  );

  // Filter agents based on search term for Shared Agents
  const filteredSharedAgents = sharedAgents.filter(agent =>
    agent.name.toLowerCase().includes(sharedSearchTerm.toLowerCase()) ||
    (agent.description && agent.description.toLowerCase().includes(sharedSearchTerm.toLowerCase()))
  );

  // Calculate pagination data for Shared Agents
  const totalSharedPages = Math.ceil(filteredSharedAgents.length / sharedAgentsPerPage);
  const paginatedSharedAgents = filteredSharedAgents.slice(
    (sharedCurrentPage - 1) * sharedAgentsPerPage,
    sharedCurrentPage * sharedAgentsPerPage
  );

  return (
    <div className="p-6 mt-16">
      {/* Header */}
      <h1 className="text-4xl font-bold mb-6 text-left text-black dark:text-white">Share Setting</h1>
      {/* <h1 className="text-2xl font-semibold mb-2 text-black dark:text-white">{t.title}</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-6 text-black dark:text-white">{t.description}</p> */}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4">{t.loading}</p>
        </div>
      ) : (
        <>
          {/* Available (Unshared) Agents Section - Display First */}
          <div className="mb-10">
            <h2 className="text-xl font-medium mb-4 flex items-center text-black dark:text-white">
              <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              {t.unsharedTitle}
            </h2>

            {availableAgents.length === 0 ? (
              <p className="py-4 text-gray-500 dark:text-gray-400">{t.noUnsharedAgents}</p>
            ) : (
              <>
                {/* Search and Pagination Controls for Available Agents */}
                <div className="mb-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    {/* Search Bar */}
                    <div className="mb-3 md:mb-0">
                      <div className="relative">
                        <input
                          type="text"
                          value={availableSearchTerm}
                          onChange={(e) => {
                            setAvailableSearchTerm(e.target.value);
                            setAvailableCurrentPage(1); // Reset to first page on search
                          }}
                          placeholder={t.searchPlaceholder}
                          className="w-full md:w-64 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 pl-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                          </svg>
                        </div>
                        {availableSearchTerm && (
                          <button
                            onClick={() => {
                              setAvailableSearchTerm('');
                              setAvailableCurrentPage(1);
                            }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Pagination Controls - Only show if we have more than one page */}
                    {totalAvailablePages > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {t.pagination.showing} {Math.min(filteredAvailableAgents.length, 1 + (availableCurrentPage - 1) * availableAgentsPerPage)}-{Math.min(availableCurrentPage * availableAgentsPerPage, filteredAvailableAgents.length)} {t.pagination.of} {filteredAvailableAgents.length}
                        </span>
                        <button
                          onClick={() => setAvailableCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                          disabled={availableCurrentPage === 1}
                        >
                          {t.pagination.prev}
                        </button>
                        <button
                          onClick={() => setAvailableCurrentPage(prev => Math.min(prev + 1, totalAvailablePages))}
                          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                          disabled={availableCurrentPage === totalAvailablePages}
                        >
                          {t.pagination.next}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Show "No results" message if search returns nothing */}
                {filteredAvailableAgents.length === 0 ? (
                  <p className="py-4 text-gray-500 dark:text-gray-400">{t.noSearchResults}</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedAvailableAgents.map((agent, index) => (
                      <div key={agent.id} className={`border border-gray-200 dark:border-gray-700 rounded-lg p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow ${getCardGradient(agent.id)}`}>
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{agent.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{agent.description || 'No description'}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {agent.model}
                            </span>
                          </div>
                        </div>
                        <div className="mt-5">
                          <button
                            onClick={() => handleShareAgent(agent.id, agent.name)}
                            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            {t.configureAndShare}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Shared Agents Section */}
          <div>
            <h2 className="text-xl font-medium mb-4 flex items-center text-black dark:text-white">
              <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              {t.sharedTitle}
            </h2>

            {sharedAgents.length === 0 ? (
              <p className="py-4 text-gray-500 dark:text-gray-400">{t.noSharedAgents}</p>
            ) : (
              <>
                {/* Search and Pagination Controls for Shared Agents */}
                <div className="mb-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    {/* Search Bar */}
                    <div className="mb-3 md:mb-0">
                      <div className="relative">
                        <input
                          type="text"
                          value={sharedSearchTerm}
                          onChange={(e) => {
                            setSharedSearchTerm(e.target.value);
                            setSharedCurrentPage(1); // Reset to first page on search
                          }}
                          placeholder={t.searchPlaceholder}
                          className="w-full md:w-64 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 pl-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                          </svg>
                        </div>
                        {sharedSearchTerm && (
                          <button
                            onClick={() => {
                              setSharedSearchTerm('');
                              setSharedCurrentPage(1);
                            }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Pagination Controls - Only show if we have more than one page */}
                    {totalSharedPages > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {t.pagination.showing} {Math.min(filteredSharedAgents.length, 1 + (sharedCurrentPage - 1) * sharedAgentsPerPage)}-{Math.min(sharedCurrentPage * sharedAgentsPerPage, filteredSharedAgents.length)} {t.pagination.of} {filteredSharedAgents.length}
                        </span>
                        <button
                          onClick={() => setSharedCurrentPage(prev => Math.max(prev - 1, 1))}
                          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                          disabled={sharedCurrentPage === 1}
                        >
                          {t.pagination.prev}
                        </button>
                        <button
                          onClick={() => setSharedCurrentPage(prev => Math.min(prev + 1, totalSharedPages))}
                          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                          disabled={sharedCurrentPage === totalSharedPages}
                        >
                          {t.pagination.next}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Show "No results" message if search returns nothing */}
                {filteredSharedAgents.length === 0 ? (
                  <p className="py-4 text-gray-500 dark:text-gray-400">{t.noSearchResults}</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {paginatedSharedAgents.map((agent, index) => {
                      // Get the active tab for this card or default to 'embed'
                      const activeTab = activeTabs[agent.id] || 'embed';
                      const isExpanded = expandedCards[agent.id] || false;

                      return (
                        <div
                          key={agent.id}
                          className={`${isExpanded ? 'bg-white dark:bg-gray-800' : getCardGradient(index)} rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 transition-colors duration-300`}
                        >
                          <div className="p-5">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className={`text-lg font-semibold ${getTextColorClass(isExpanded)}`}>{agent.name}</h3>
                                {agent.description && (
                                  <p className={`text-sm ${isExpanded ? 'text-gray-600 dark:text-gray-300' : 'text-white/90'} mt-1`}>{agent.description}</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleOpenRevokeModal(agent.apiKey)}
                                className="text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-800/50 dark:text-red-400 rounded-full"
                              >
                                {t.revoke}
                              </button>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                {agent.usageCount} / {agent.usageLimit === null ? t.unlimited : agent.usageLimit}
                              </span>

                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                {!agent.expiresAt ? t.neverExpires : new Date(agent.expiresAt).toLocaleDateString()}
                              </span>

                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                                {agent.allowedOrigins.join(", ") || "*"}
                              </span>
                            </div>

                            <div className="mt-4">
                              <button
                                onClick={() => toggleCardExpanded(agent.id)}
                                className={`text-sm ${isExpanded ? 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300' : 'text-white hover:text-white/80'} flex items-center`}
                              >
                                {expandedCards[agent.id] ? t.hideDetails : t.details}
                                <svg
                                  className={`ml-1 h-4 w-4 transition-transform ${expandedCards[agent.id] ? 'transform rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                              </button>
                            </div>

                            {expandedCards[agent.id] && (
                              <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                                <div className="mb-3">
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t.columns.apiKey}
                                  </label>
                                  <div className="flex">
                                    <input
                                      type="text"
                                      readOnly
                                      value={agent.apiKey}
                                      className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-l-md p-2 text-xs font-mono text-gray-900 dark:text-white focus:outline-none"
                                    />
                                    <button
                                      onClick={() => copyToClipboard(agent.apiKey, `key-${agent.id}`)}
                                      className="px-3 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                                      title={t.copyApiKey}
                                    >
                                      {copied[`key-${agent.id}`] ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </div>

                                <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                                  <nav className="flex -mb-px">
                                    <button
                                      onClick={() => toggleTab(agent.id, 'embed')}
                                      className={`py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'embed'
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                        }`}
                                    >
                                      {t.embedCode}
                                    </button>
                                    <button
                                      onClick={() => toggleTab(agent.id, 'qr')}
                                      className={`py-2 px-4 text-sm font-medium border-b-2 ${activeTab === 'qr'
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                        }`}
                                    >
                                      {t.qrCode}
                                    </button>
                                  </nav>
                                </div>

                                {activeTab === 'embed' ? (
                                  <div className="flex flex-col space-y-3">
                                    <textarea
                                      readOnly
                                      value={getEmbedCode(agent.apiKey)}
                                      rows={3}
                                      className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white focus:outline-none font-mono text-sm"
                                    />
                                    <div className="flex space-x-2">
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(getEmbedCode(agent.apiKey), `embed-${agent.id}`)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex-1 flex items-center justify-center"
                                      >
                                        {copied[`embed-${agent.id}`] ? (
                                          <>
                                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            {t.copied}
                                          </>
                                        ) : (
                                          t.copyEmbed
                                        )}
                                      </button>
                                      <a
                                        href={getEmbedPreviewUrl(agent.apiKey)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center"
                                      >
                                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        {t.previewEmbed}
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                      <QRCodeSVG
                                        value={getEmbedPreviewUrl(agent.apiKey)}
                                        size={150}
                                        level="H"
                                        includeMargin
                                        bgColor="#FFFFFF"
                                        fgColor="#000000"
                                      />
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                      Scan to access this agent
                                    </p>
                                  </div>
                                )}

                                <div className="text-sm grid grid-cols-2 gap-4 mt-4">
                                  <div>
                                    <span className="block text-gray-500 dark:text-gray-400">Created</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {new Date(agent.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-gray-500 dark:text-gray-400">Agent ID</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {agent.agentId}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Share Agent Modal */}
      <ShareAgentModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          // Refresh both the shared agents list and available agents list after closing the modal
          const refreshData = async () => {
            try {
              // Get updated shared agents
              const sharedData = await getSharedAgents();
              setSharedAgents(sharedData);

              // Get all available agents
              const availableData = await getAgents();

              // Filter out agents that have already been shared
              const sharedAgentIds = sharedData.map(agent => agent.agentId);
              const unsharedAgents = availableData.filter(agent => !sharedAgentIds.includes(agent.id));

              setAvailableAgents(unsharedAgents);

              // Reset pagination and search when data refreshes
              setAvailableCurrentPage(1);
              setSharedCurrentPage(1);
            } catch (error) {
              console.error('Error refreshing agents:', error);
            }
          };

          refreshData();
        }}
        agentId={selectedAgentId || 0}
        agentName={selectedAgentName}
      />

      {/* Confirm Revoke Modal */}
      <ConfirmDeleteModal
        isOpen={isConfirmRevokeOpen}
        onClose={() => setIsConfirmRevokeOpen(false)}
        onConfirm={() => {
          if (revokeAgentId) {
            handleRevoke(revokeAgentId);
          }
          setIsConfirmRevokeOpen(false);
        }}
        title="Confirm Revoke"
        message={t.confirmRevoke}
      />
    </div>
  );
}
