"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/utils/translations";
import {
  shareAgent,
  SharedAgentData,
  getSharedAgentByApiKey,
} from "@/utils/apiService";
import { toast } from "react-hot-toast";

interface ShareAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: number;
  agentName: string;
}

// Define a type for the agent translations to ensure all required properties are present
type AgentTranslations = {
  shareAgent: string;
  shareSuccess: string;
  shareWarning: string;
  apiKey: string;
  embedCode: string;
  copyEmbed: string;
  qrCode: string;
  previewEmbed: string;
  form: {
    shareName: string;
    shareDescription: string;
    allowedOrigins: string;
    allowedOriginsHint: string;
    usageLimit: string;
    unlimited: string;
    expiryDays: string;
    neverExpires: string;
    theme: string;
  };
  shareButton: string;
  shareAnother: string;
  themeOptions: {
    light: string;
    dark: string;
  };
};

// Define default translations
const defaultAgentTranslations: AgentTranslations = {
  shareAgent: "Share Agent",
  shareSuccess: "Agent Shared Successfully",
  shareWarning:
    "Keep this API key secure. Anyone with this key can use your agent.",
  apiKey: "API Key",
  embedCode: "Embed Code",
  copyEmbed: "Copy Embed Code",
  qrCode: "QR Code",
  previewEmbed: "Preview",
  form: {
    shareName: "Share Name",
    shareDescription: "Description",
    allowedOrigins: "Allowed Origins",
    allowedOriginsHint:
      "Use * for any website or comma-separated list of domains",
    usageLimit: "Usage Limit",
    unlimited: "Unlimited",
    expiryDays: "Expiry Days",
    neverExpires: "Never Expires",
    theme: "Widget Theme",
  },
  shareButton: "Share Agent",
  shareAnother: "Share Another Agent",
  themeOptions: {
    light: "Light",
    dark: "Dark",
  },
};

const ShareAgentModal: React.FC<ShareAgentModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName,
}) => {
  const { language } = useLanguage();

  // Instead of unsafely casting, create a fresh object with only the fields we need
  const translationsObj = translations[language]?.agent || {};

  // Create a properly typed object
  const agentT: AgentTranslations = {
    // Use default values and override with translations if they exist
    shareAgent:
      (translationsObj.shareAgent as string) ||
      defaultAgentTranslations.shareAgent,
    shareSuccess:
      (translationsObj.shareSuccess as string) ||
      defaultAgentTranslations.shareSuccess,
    shareWarning:
      (translationsObj.shareWarning as string) ||
      defaultAgentTranslations.shareWarning,
    apiKey:
      (translationsObj.apiKey as string) || defaultAgentTranslations.apiKey,
    embedCode:
      (translationsObj.embedCode as string) ||
      defaultAgentTranslations.embedCode,
    copyEmbed:
      (translationsObj.copyEmbed as string) ||
      defaultAgentTranslations.copyEmbed,
    qrCode:
      (translationsObj.qrCode as string) || defaultAgentTranslations.qrCode,
    previewEmbed:
      (translationsObj.previewEmbed as string) ||
      defaultAgentTranslations.previewEmbed,
    shareButton:
      (translationsObj.shareButton as string) ||
      defaultAgentTranslations.shareButton,
    shareAnother:
      (translationsObj.shareAnother as string) ||
      defaultAgentTranslations.shareAnother,

    // Safely handle nested objects by creating fresh objects
    form: {
      shareName:
        (translationsObj.form as any)?.shareName ||
        defaultAgentTranslations.form.shareName,
      shareDescription:
        (translationsObj.form as any)?.shareDescription ||
        defaultAgentTranslations.form.shareDescription,
      allowedOrigins:
        (translationsObj.form as any)?.allowedOrigins ||
        defaultAgentTranslations.form.allowedOrigins,
      allowedOriginsHint:
        (translationsObj.form as any)?.allowedOriginsHint ||
        defaultAgentTranslations.form.allowedOriginsHint,
      usageLimit:
        (translationsObj.form as any)?.usageLimit ||
        defaultAgentTranslations.form.usageLimit,
      unlimited:
        (translationsObj.form as any)?.unlimited ||
        defaultAgentTranslations.form.unlimited,
      expiryDays:
        (translationsObj.form as any)?.expiryDays ||
        defaultAgentTranslations.form.expiryDays,
      neverExpires:
        (translationsObj.form as any)?.neverExpires ||
        defaultAgentTranslations.form.neverExpires,
      // Ensure theme is always present
      theme:
        (translationsObj.form as any)?.theme ||
        defaultAgentTranslations.form.theme,
    },

    themeOptions: {
      light:
        (translationsObj.themeOptions as any)?.light ||
        defaultAgentTranslations.themeOptions.light,
      dark:
        (translationsObj.themeOptions as any)?.dark ||
        defaultAgentTranslations.themeOptions.dark,
    },
  };

  const commonT = translations[language].common || {
    cancel: "Cancel",
    processing: "Processing...",
    done: "Done",
    copied: "Copied!",
  };

  const [formData, setFormData] = useState<SharedAgentData>({
    name: agentName,
    description: "",
    allowedOrigins: "*",
    usageLimit: null,
    expiryDays: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({
    apiKey: false,
    embedCode: false,
  });
  const [activeTab, setActiveTab] = useState<"embed" | "qr">("embed");
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const embedCodeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        name: agentName,
        description: "",
        allowedOrigins: "*",
        usageLimit: null,
        expiryDays: null,
      });
      setApiKey(null);
      setCopied({ apiKey: false, embedCode: false });
      setActiveTab("embed");
    }
  }, [isOpen, agentName]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "usageLimit" | "expiryDays"
  ) => {
    const value = e.target.value ? parseInt(e.target.value) : null;

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await shareAgent(agentId, formData);
      // Instead of showing the API key, just show a success message and close the modal
      toast.success(agentT.shareSuccess);
      onClose(); // Close the modal after successful sharing
    } catch (error) {
      console.error("Error sharing agent:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to share agent"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, type: "apiKey" | "embedCode") => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [type]: true });

    toast.success(commonT.copied);

    setTimeout(() => {
      setCopied({ ...copied, [type]: false });
    }, 3000);
  };

  const getEmbedCode = () => {
    if (!apiKey) return "";

    // Include the data-theme attribute to customize the chat widget appearance
    return `<script src="${window.location.origin}/api/embed.js" id="ai-chat-embed" data-api-key="${apiKey}" data-theme="light"></script>`;
  };

  const getEmbedPreviewUrl = () => {
    if (!apiKey) return "#";
    return `${window.location.origin}/preview?apiKey=${apiKey}&theme=light`;
  };

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform transition-all max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {agentT.shareAgent}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {apiKey ? (
            <div className="space-y-6">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 rounded-md text-sm">
                {agentT.shareWarning}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {agentT.apiKey}
                </label>
                <div className="flex">
                  <input
                    ref={apiKeyRef}
                    type="text"
                    readOnly
                    value={apiKey}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-l-md p-2 text-gray-900 dark:text-white focus:outline-none font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(apiKey, "apiKey")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 flex items-center"
                  >
                    {copied.apiKey ? (
                      <div>
                        <svg
                          className="h-4 w-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {commonT.copied}
                      </div>
                    ) : (
                      "Copy"
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {agentT.embedCode}
                  </label>
                  <textarea
                    ref={embedCodeRef}
                    readOnly
                    value={getEmbedCode()}
                    rows={3}
                    className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white focus:outline-none font-mono text-sm w-full"
                  />
                  <div className="flex space-x-2 mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(getEmbedCode(), "embedCode")
                      }
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex-1 flex items-center justify-center"
                    >
                      {copied.embedCode ? (
                        <>
                          <svg
                            className="h-4 w-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {commonT.copied}
                        </>
                      ) : (
                        agentT.copyEmbed
                      )}
                    </button>
                    <a
                      href={getEmbedPreviewUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center"
                    >
                      <svg
                        className="h-4 w-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      {agentT.previewEmbed}
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setApiKey(null);
                    setFormData({
                      name: agentName,
                      description: "",
                      allowedOrigins: "*",
                      usageLimit: null,
                      expiryDays: null,
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
                >
                  {agentT.shareAnother}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {commonT.done}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {agentT.form.shareName}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {agentT.form.shareDescription}
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="allowedOrigins"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {agentT.form.allowedOrigins}
                </label>
                <input
                  type="text"
                  id="allowedOrigins"
                  name="allowedOrigins"
                  value={formData.allowedOrigins}
                  onChange={handleChange}
                  className="w-full p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {agentT.form.allowedOriginsHint}
                </p>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
                >
                  {commonT.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
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
                      {commonT.processing}
                    </div>
                  ) : (
                    agentT.shareButton
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareAgentModal;
