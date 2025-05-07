'use client';

import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
// @ts-ignore
import remarkGfm from 'remark-gfm';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../utils/translations';
import { sendChatMessage, streamChatResponse, createConversation, ChatRequest, ChatMessage, getAgents, Agent, submitMessageFeedback, } from '@/utils/apiService';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Message {
  text: string;
  isUser: boolean;
  agent?: string;
  id?: number;
  feedback?: 'like' | 'dislike';
  rating?: number;
}


export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { language, toggleLanguage } = useLanguage();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isAuthenticated === false) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Fetch agents from API
  useEffect(() => {
    async function fetchAgents() {
      try {
        setIsLoadingAgents(true);
        const agentsData = await getAgents();
        setAgents(agentsData);

        // Check if no agents were found (using the noAgentsFound flag)
        if ((agentsData as any).noAgentsFound) {
          setAgents([]);
          return;
        }

        // Select the first agent by default
        if (agentsData.length > 0) {
          setSelectedAgent(String(agentsData[0].id));
        }
      } catch (error) {
        console.error('Error fetching agents:', error);
        // Use fallback agents if API fails
        setAgents([
          {
            id: 1,
            agent_key: 'general',
            name: 'General Assistant',
            description: 'General knowledge, daily tasks, and basic information',
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            max_tokens: 2000,
            system_prompt: '',
            knowledge_base_ids: null,
            is_active: true,
            is_global: true
          },
          {
            id: 2,
            agent_key: 'code',
            name: 'Code Expert',
            description: 'Programming, software development, and technical solutions',
            model: 'gpt-4',
            temperature: 0.7,
            max_tokens: 4000,
            system_prompt: '',
            knowledge_base_ids: null,
            is_active: true,
            is_global: true
          }
        ]);

        // Select the first fallback agent
        setSelectedAgent('1');
      } finally {
        setIsLoadingAgents(false);
      }
    }

    fetchAgents();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getLocalizedAgents = () => {
    return agents.map(agent => ({
      ...agent,
      name: agent.agent_key,
      description: agent.description ? agent.description : 'No description available'
    }));
  };

  const handleFeedback = async (messageIndex: number, feedback: 'like' | 'dislike') => {
    console.log('handleFeedback', messageIndex, feedback);
    const message = messages[messageIndex];
    console.log('message', message);
    if (message.isUser || !message.id) return;

    // Toggle feedback if already selected, otherwise set new feedback
    const newFeedback = message.feedback === feedback ? undefined : feedback;
    console.log('newFeedback', newFeedback);
    setMessages(prev => {
      const updated = [...prev];
      updated[messageIndex] = {
        ...message,
        feedback: newFeedback
      };
      return updated;
    });

    try {
      if (newFeedback) { // Only submit if we have feedback (not undefined)
        await submitMessageFeedback(message.id, newFeedback);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };



  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      text: input,
      isUser: true,
      agent: selectedAgent,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');

    try {
      // Get the model for the selected agent
      const agent = agents.find(a => String(a.id) === selectedAgent);
      const model = agent?.model || 'gpt-3.5-turbo';

      // Create conversation if none exists
      if (!conversationId) {
        try {
          const convResult = await createConversation(
            `Chat with ${agent?.name}`,
            1 // Default department ID
          );
          setConversationId(convResult.conversation_id);
        } catch (error) {
          console.error('Error creating conversation:', error);
        }
      }

      // Format message for API
      const chatMessage: ChatMessage = {
        content: input,
        role: 'user'
      };

      // Create request object
      const chatRequest: ChatRequest = {
        messages: [chatMessage],
        model: model,
        department_id: agent?.department_id || 1, // Use agent's department ID or default to 1
        // conversation_id: conversationId || undefined,
        stream: process.env.NEXT_PUBLIC_USE_STREAMING === 'true',
        agent_key: agent?.agent_key // Add the agent_key parameter
      };

      if (process.env.NEXT_PUBLIC_USE_STREAMING === 'true') {
        // Use streaming API
        const streamer = streamChatResponse(chatRequest);
        console.log('streamer', streamer);

        // Add empty assistant message that will be updated
        const assistantMessage: Message = {
          text: '',
          isUser: false,
          id: undefined // Will be set when we get the response
        };
        setMessages(prev => [...prev, assistantMessage]);

        setStreamingContent('');

        // Connect to stream and update message as chunks arrive
        streamer.connectToStream(
          // On message callback
          (content: string) => {
            flushSync(() => {
              setStreamingContent(prev => {
                console.log('streamingContent', content);
                const newContent = prev + content;

                // Update the last message in the array (assistant message)
                setMessages(prev => {
                  const updatedMessages = [...prev];
                  const lastMessage = updatedMessages[updatedMessages.length - 1];
                  // Preserve the message ID if we have it
                  updatedMessages[updatedMessages.length - 1] = {
                    ...lastMessage,
                    text: newContent,
                  };
                  return updatedMessages;
                });

                return newContent;
              });
            });
          },
          //on ID callback
          (id: number) => {
            setMessages(prev => {
              const updatedMessages = [...prev];
              const lastMessage = updatedMessages[updatedMessages.length - 1];
              // Preserve the message ID if we have it
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                id: id,
              };
              return updatedMessages;
            });
          },
          // On error callback
          (error: Error) => {
            console.error('Stream error:', error);
            setMessages(prev => {
              const updatedMessages = [...prev];
              updatedMessages[updatedMessages.length - 1].text = 'Sorry, an error occurred. Please try again.';
              return updatedMessages;
            });
          },
          // On complete callback
          () => {
            setIsLoading(false);
            setStreamingContent('');
            // Here we should set the message ID from the response if available
          }
        );
      } else {
        // Use non-streaming API
        chatRequest.stream = false;
        const response = await sendChatMessage(chatRequest);
        console.log('response', response);

        const aiMessage: Message = {
          text: response.content,
          isUser: false,
          id: response.agent_msg_id // Get the message ID from the response
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        text: 'Sorry, an error occurred. Please try again.',
        isUser: false
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-300">
      <div className="p-4 space-y-2 relative flex justify-between items-start">
        <div className="flex-1 pt-16">
          <div
            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-3 cursor-pointer w-full max-w-xs shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex justify-between items-center">
              <span>{agents.length > 0 ? getLocalizedAgents().find(a => String(a.id) === selectedAgent)?.name : "No agents"}</span>
              <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {isOpen && (
            <div className="absolute z-10 mt-1 w-full max-w-xs bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 transition-colors duration-200">
              {agents.length === 0 ? (
                <div className="p-3 text-gray-900 dark:text-white">No agents</div>
              ) : (
                getLocalizedAgents().map(agent => (
                  <div
                    key={agent.id}
                    className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition ${selectedAgent === String(agent.id) ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                    onClick={() => {
                      setSelectedAgent(String(agent.id));
                      setIsOpen(false);
                    }}
                  >
                    <div className="text-gray-900 dark:text-white">{agent.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{agent.description}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={toggleLanguage}
          className="ml-4 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200"
        >
          {language === 'en' ? '中文' : 'EN'}
        </button>
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full pb-24">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg p-3 break-words shadow-sm ${message.isUser
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                }`}>

                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ node, children, ...props }) => <p className="m-0" {...props}>{children}</p>,
                      a: ({ node, children, href, ...props }) => {
                        const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                          if (href) {
                            e.preventDefault();
                            window.open(href, '_blank', 'noopener,noreferrer');
                          }
                        };

                        return (
                          <a
                            className="text-blue-300 hover:underline cursor-pointer"
                            href={href}
                            onClick={handleClick}
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      },
                      ul: ({ node, children, ...props }) => <ul className="list-disc list-inside my-2" {...props}>{children}</ul>,
                      ol: ({ node, children, ...props }) => <ol className="list-decimal list-inside my-2" {...props}>{children}</ol>,
                      pre: ({ node, children, ...props }) => <pre className="bg-gray-900 p-2 rounded my-2" {...props}>{children}</pre>,
                      code: ({ node, children, ...props }) => <code className="bg-gray-900 px-1 rounded" {...props}>{children}</code>,
                      h3: ({ node, children, ...props }) => (
                        <h3 className="text-xl font-bold my-3" {...props}>{children}</h3>
                      ),
                      h4: ({ node, children, ...props }) => (
                        <h4 className="text-lg font-semibold my-2" {...props}>{children}</h4>
                      ),
                      table: ({ node, children, ...props }) => (
                        <table className="border-collapse my-4" {...props}>{children}</table>
                      ),
                      th: ({ node, children, ...props }) => (
                        <th className="border border-gray-600 px-4 py-2" {...props}>{children}</th>
                      ),
                      td: ({ node, children, ...props }) => (
                        <td className="border border-gray-600 px-4 py-2" {...props}>{children}</td>
                      ),
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                </div>
                {!message.isUser && (
                  <div className="flex justify-end mt-2 space-x-2">
                    <button
                      onClick={() => handleFeedback(index, 'like')}
                      className={`p-1 rounded ${message.feedback === 'like' ? 'bg-green-500' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                      aria-label="Like"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleFeedback(index, 'dislike')}
                      className={`p-1 rounded ${message.feedback === 'dislike' ? 'bg-red-500' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                      aria-label="Dislike"
                    >
                      👎
                    </button>
                  </div>
                )}

              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 transition-colors duration-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center bg-white dark:bg-gray-800 rounded-full overflow-hidden w-full shadow-sm border border-gray-200 dark:border-gray-700">
            <input
              type="text"
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 p-4 focus:outline-none"
              placeholder={getTranslation(language, 'agents.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={isLoading}
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className={`p-4 transition ${isLoading || !input.trim()
                ? 'text-gray-400 cursor-not-allowed'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
