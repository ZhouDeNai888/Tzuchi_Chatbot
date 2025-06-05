'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/utils/translations';
import { getAllMessages, getDepartmentMessages, getUserProfile, MessageHistory, addMessageRating } from '@/utils/apiService';

interface Message {
  id: number;
  userMessage: string;
  agentMessage: string;
  agentName?: string;
  timestamp: string;
  conversation_id: number;
  feedback?: string;
  satisfaction?: number;
  message_id: number;
}

interface Department {
  DepartmentID?: number;
  id?: number;
}

interface UserProfile {
  UserRole?: string;
  departments?: Department[];
}

function StarRating({ rating, onRatingChange, readOnly }: { rating?: number, onRatingChange?: (rating: number) => void, readOnly?: boolean }) {
  const stars = Array.from({ length: 5 });
  const [localRating, setLocalRating] = useState(rating);

  useEffect(() => {
    setLocalRating(rating);
  }, [rating]);

  const handleClick = (newRating: number) => {
    if (!readOnly) {
      setLocalRating(newRating);
      onRatingChange?.(newRating);
    }
  };

  return (
    <div className="flex items-center">
      {stars.map((_, index) => (
        <button
          key={index}
          type={readOnly ? "button" : "button"}
          disabled={readOnly}
          onClick={() => handleClick(index + 1)}
          className={`${readOnly ? '' : 'hover:scale-110 transition-transform'}`}
        >
          <svg
            className={`w-4 h-4 ${(localRating || 0) > index
              ? 'text-yellow-400'
              : 'text-gray-300 dark:text-gray-600'
              }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function History() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [inputPage, setInputPage] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesPerPage = 10;
  const { language } = useLanguage();
  const t = translations[language].history;

  const filteredMessages = messages.filter(message => {
    const query = searchQuery.toLowerCase();

    switch (searchType) {
      case 'number':
        return message.id.toString().includes(query);
      case 'date':
        return message.timestamp.toLowerCase().includes(query);
      case 'question':
        return message.userMessage.toLowerCase().includes(query);
      case 'answer':
        return message.agentMessage.toLowerCase().includes(query);
      case 'agent':
        return (message.agentName || '').toLowerCase().includes(query);
      default:
        return message.id.toString().includes(query) ||
          message.timestamp.toLowerCase().includes(query) ||
          message.userMessage.toLowerCase().includes(query) ||
          message.agentMessage.toLowerCase().includes(query) ||
          (message.agentName || '').toLowerCase().includes(query);
    }
  });

  const indexOfLastMessage = currentPage * messagesPerPage;
  const indexOfFirstMessage = indexOfLastMessage - messagesPerPage;
  const currentMessages = filteredMessages.slice(indexOfFirstMessage, indexOfLastMessage);
  const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPage(e.target.value);
  };

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNumber = parseInt(inputPage);
    if (!isNaN(pageNumber) && pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      setInputPage('');
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const userProfile: UserProfile = await getUserProfile();
        let data: MessageHistory[] = [];

        if (userProfile?.UserRole === 'admin') {
          data = await getAllMessages();
        } else {
          const departmentIds = userProfile?.departments?.map((dept: Department) => dept.DepartmentID || dept.id)
            .filter((id): id is number => id !== undefined) || [];
          if (departmentIds.length > 0) {
            data = await getDepartmentMessages(departmentIds);
          }
        }

        const messagesByConversation = data.reduce((acc: { [key: string]: any }, msg: MessageHistory) => {
          const convId = msg.ConversationID?.toString() || 'unknown';


          if (!acc[convId]) {
            acc[convId] = {
              userMessage: '',
              agentMessage: '',
              agentName: msg.AgentName || '',
              timestamp: msg.Timestamp,
              conversation_id: msg.ConversationID || 0,
              feedback: msg.FeedbackComment,
              satisfaction: msg.Rating,
              message_id: msg.MessageID || 0
            };
          }

          if (msg.Content) {
            if (msg.Response) {
              acc[convId].userMessage = msg.Content;
              acc[convId].agentMessage = msg.Response;
            } else {
              if (!acc[convId].userMessage) {
                acc[convId].userMessage = msg.Content;
              } else if (!acc[convId].agentMessage) {
                acc[convId].agentMessage = msg.Content;
              }
            }
          }

          return acc;
        }, {});

        const formattedMessages = Object.values(messagesByConversation)
          .map((msg: any, index: number) => ({
            id: index + 1,
            ...msg,
            timestamp: new Date(msg.timestamp).toLocaleString(language === 'zh-TW' ? 'zh-TW' : 'en-US')
          }))
          .sort((a: Message, b: Message) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

        setMessages(formattedMessages);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [language]);

  const handleRatingChange = async (messageId: number, rating: number) => {
    setMessages(messages.map(msg =>
      msg.id === messageId ? { ...msg, satisfaction: rating } : msg
    ));

    try {
      const success = await addMessageRating(messageId, rating);
      if (!success) {
        setMessages(messages.map(msg =>
          msg.id === messageId ? { ...msg, satisfaction: msg.satisfaction } : msg
        ));
        console.error('Failed to update rating');
      }
    } catch (error) {
      setMessages(messages.map(msg =>
        msg.id === messageId ? { ...msg, satisfaction: msg.satisfaction } : msg
      ));
      console.error('Error submitting rating:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex pt-16 text-black dark:text-white">
      <div className="flex-1">
        <main className="flex-1 flex flex-col items-center p-4">
          <h1 className="text-gray-900 dark:text-white text-2xl md:text-3xl font-bold mb-8">
            {t.title}
          </h1>

          {loading && (
            <div className="text-gray-600 dark:text-gray-400">{t.loading}</div>
          )}

          {error && (
            <div className="text-red-600 dark:text-red-400">{error}</div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="text-gray-600 dark:text-gray-400">{t.noData}</div>
          )}

          {messages.length > 0 && (
            <>
              <div className="w-full max-w-6xl mb-4 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    className="px-4 py-2 rounded-lg border-2 border-gray-200 
                      focus:border-blue-500 dark:border-gray-700 dark:focus:border-blue-600
                      outline-none transition-all duration-200 bg-white 
                      dark:bg-gray-800 text-black dark:text-white"
                  >
                    <option value="all">{language === 'zh-TW' ? '全部' : 'All'}</option>
                    <option value="number">{language === 'zh-TW' ? '編號' : 'Number'}</option>
                    <option value="date">{language === 'zh-TW' ? '日期' : 'Date'}</option>
                    <option value="question">{language === 'zh-TW' ? '問題' : 'Question'}</option>
                    <option value="answer">{language === 'zh-TW' ? '回答' : 'Answer'}</option>
                    <option value="agent">{language === 'zh-TW' ? '機器人' : 'Agent'}</option>
                  </select>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={language === 'zh-TW'
                      ? "搜尋問答歷史..."
                      : "Search chat history..."}
                    className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-200 
                      focus:border-blue-500 dark:border-gray-700 dark:focus:border-blue-600
                      outline-none transition-all duration-200 bg-white 
                      dark:bg-gray-800 text-black dark:text-white"
                  />
                </div>

                {searchQuery && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {language === 'zh-TW'
                      ? `找到 ${filteredMessages.length} 筆結果`
                      : `Found ${filteredMessages.length} results`}
                  </div>
                )}
              </div>

              <div className="w-full max-w-6xl overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-800 shadow-md rounded-lg">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left">{t.columns.number}</th>
                      <th className="px-4 py-2 text-left">{t.columns.question}</th>
                      <th className="px-4 py-2 text-left">{t.columns.answer}</th>
                      <th className="px-4 py-2 text-left">{t.columns.agent}</th>
                      <th className="px-4 py-2 text-left">{t.columns.timestamp}</th>
                      <th className="px-4 py-2 text-left">{t.columns.feedback}</th>
                      <th className="px-4 py-2 text-left">{t.columns.satisfaction}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMessages.map((message) => (
                      <tr key={message.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800">
                        <td className="px-4 py-2">{message.id}</td>
                        <td className="px-4 py-2">{message.agentMessage}</td>
                        <td className="px-4 py-2">{message.userMessage}</td>
                        <td className="px-4 py-2">{message.agentName}</td>
                        <td className="px-4 py-2">{message.timestamp}</td>
                        <td className="px-4 py-2">
                          {message.feedback && (
                            <span className={`px-2 py-1 rounded ${message.feedback === 'like'
                              ? 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100'
                              : 'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100'
                              }`}>
                              {message.feedback}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <StarRating
                            rating={message.satisfaction}
                            onRatingChange={(rating) => handleRatingChange(message.message_id, rating)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-center mt-6 gap-3 items-center">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg transition-all duration-200 ease-in-out
                    bg-blue-500 hover:bg-blue-600 text-white
                    disabled:bg-gray-300 dark:disabled:bg-gray-700
                    disabled:cursor-not-allowed
                    shadow-md hover:shadow-lg
                    transform hover:-translate-y-0.5
                    flex items-center justify-center min-w-[40px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <form onSubmit={handlePageSubmit} className="flex items-center gap-3">
                  <input
                    type="number"
                    value={inputPage}
                    onChange={handlePageInput}
                    min="1"
                    max={totalPages}
                    placeholder={`${currentPage}`}
                    className="w-16 px-3 py-2 text-center rounded-lg
                      border-2 border-blue-200 focus:border-blue-500
                      dark:border-blue-800 dark:focus:border-blue-600
                      outline-none transition-all duration-200
                      bg-white dark:bg-gray-800 
                      text-black dark:text-white"
                  />
                  <span className="text-gray-600 dark:text-gray-400 font-medium">
                    of {totalPages}
                  </span>
                </form>

                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg transition-all duration-200 ease-in-out
                    bg-blue-500 hover:bg-blue-600 text-white
                    disabled:bg-gray-300 dark:disabled:bg-gray-700
                    disabled:cursor-not-allowed
                    shadow-md hover:shadow-lg
                    transform hover:-translate-y-0.5
                    flex items-center justify-center min-w-[40px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
