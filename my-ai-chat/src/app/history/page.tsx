"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/utils/translations";
import {
  getAllMessages,
  getDepartmentMessages,
  getUserProfile,
  MessageHistory,
  addMessageRating,
} from "@/utils/apiService";

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

function StarRating({
  rating,
  onRatingChange,
  readOnly,
}: {
  rating?: number;
  onRatingChange?: (rating: number) => void;
  readOnly?: boolean;
}) {
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
          className={`${
            readOnly ? "" : "hover:scale-110 transition-transform"
          }`}
        >
          <svg
            className={`w-4 h-4 ${
              (localRating || 0) > index
                ? "text-yellow-400"
                : "text-gray-300 dark:text-gray-600"
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
  const [inputPage, setInputPage] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesPerPage = 10;
  const { language } = useLanguage();
  const t = translations[language].history;

  const filteredMessages = messages.filter((message) => {
    const query = searchQuery.toLowerCase();

    switch (searchType) {
      case "number":
        return message.id.toString().includes(query);
      case "date":
        return message.timestamp.toLowerCase().includes(query);
      case "answer":
        return message.userMessage.toLowerCase().includes(query);
      case "question":
        return message.agentMessage.toLowerCase().includes(query);
      case "agent":
        return (message.agentName || "").toLowerCase().includes(query);
      default:
        return (
          message.id.toString().includes(query) ||
          message.timestamp.toLowerCase().includes(query) ||
          message.userMessage.toLowerCase().includes(query) ||
          message.agentMessage.toLowerCase().includes(query) ||
          (message.agentName || "").toLowerCase().includes(query)
        );
    }
  });

  const indexOfLastMessage = currentPage * messagesPerPage;
  const indexOfFirstMessage = indexOfLastMessage - messagesPerPage;
  const currentMessages = filteredMessages.slice(
    indexOfFirstMessage,
    indexOfLastMessage
  );
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
      setInputPage("");
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const userProfile: UserProfile = await getUserProfile();
        let data: MessageHistory[] = [];

        if (userProfile?.UserRole === "admin") {
          data = await getAllMessages();
        } else {
          const departmentIds =
            userProfile?.departments
              ?.map((dept: Department) => dept.DepartmentID || dept.id)
              .filter((id): id is number => id !== undefined) || [];
          if (departmentIds.length > 0) {
            data = await getDepartmentMessages(departmentIds);
          }
        }

        const messagesByConversation = data.reduce(
          (acc: { [key: string]: any }, msg: MessageHistory) => {
            const convId = msg.ConversationID?.toString() || "unknown";

            if (!acc[convId]) {
              acc[convId] = {
                userMessage: "",
                agentMessage: "",
                agentName: msg.AgentName || "",
                timestamp: msg.Timestamp,
                conversation_id: msg.ConversationID || 0,
                feedback: msg.FeedbackComment,
                satisfaction: msg.Rating,
                message_id: msg.MessageID || 0,
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
          },
          {}
        );

        const formattedMessages = Object.values(messagesByConversation)
          .map((msg: any, index: number) => ({
            id: index + 1,
            ...msg,
            timestamp: new Date(msg.timestamp).toLocaleString(
              language === "zh-TW" ? "zh-TW" : "en-US"
            ),
          }))
          .sort(
            (a: Message, b: Message) =>
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
    setMessages(
      messages.map((msg) =>
        msg.id === messageId ? { ...msg, satisfaction: rating } : msg
      )
    );

    try {
      const success = await addMessageRating(messageId, rating);
      if (!success) {
        setMessages(
          messages.map((msg) =>
            msg.id === messageId
              ? { ...msg, satisfaction: msg.satisfaction }
              : msg
          )
        );
        console.error("Failed to update rating");
      }
    } catch (error) {
      setMessages(
        messages.map((msg) =>
          msg.id === messageId
            ? { ...msg, satisfaction: msg.satisfaction }
            : msg
        )
      );
      console.error("Error submitting rating:", error);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex pt-16 text-black dark:text-white">
      <div className="flex-1">
        <main className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8">
          <h1 className="text-gray-900 dark:text-white text-xl sm:text-2xl lg:text-3xl font-bold mb-6 sm:mb-8">
            {t.title}
          </h1>

          {loading && (
            <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              {t.loading}
            </div>
          )}

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm sm:text-base">
              {error}
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl sm:text-6xl mb-4">📖</div>
              <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                {t.noData}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <>
              <div className="w-full max-w-6xl mb-4 space-y-3 sm:space-y-2">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border-2 border-gray-200 
                      focus:border-blue-500 dark:border-gray-700 dark:focus:border-blue-600
                      outline-none transition-all duration-200 bg-white 
                      dark:bg-gray-800 text-black dark:text-white"
                  >
                    <option value="all">
                      {language === "zh-TW" ? "全部" : "All"}
                    </option>
                    <option value="number">
                      {language === "zh-TW" ? "編號" : "Number"}
                    </option>
                    <option value="date">
                      {language === "zh-TW" ? "日期" : "Date"}
                    </option>
                    <option value="question">
                      {language === "zh-TW" ? "問題" : "Question"}
                    </option>
                    <option value="answer">
                      {language === "zh-TW" ? "回答" : "Answer"}
                    </option>
                    <option value="agent">
                      {language === "zh-TW" ? "機器人" : "Agent"}
                    </option>
                  </select>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      language === "zh-TW"
                        ? "搜尋問答歷史..."
                        : "Search chat history..."
                    }
                    className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border-2 border-gray-200 
                      focus:border-blue-500 dark:border-gray-700 dark:focus:border-blue-600
                      outline-none transition-all duration-200 bg-white 
                      dark:bg-gray-800 text-black dark:text-white"
                  />
                </div>

                {searchQuery && (
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    {language === "zh-TW"
                      ? `找到 ${filteredMessages.length} 筆結果`
                      : `Found ${filteredMessages.length} results`}
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block w-full max-w-6xl overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-800 shadow-md rounded-lg">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {t.columns.number}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {t.columns.question}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {t.columns.answer}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {t.columns.agent}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {t.columns.timestamp}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {t.columns.feedback}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        {t.columns.satisfaction}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMessages.map((message) => (
                      <tr
                        key={message.id}
                        className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-3 text-sm">{message.id}</td>
                        <td className="px-4 py-3 text-sm max-w-xs">
                          <div
                            className="truncate"
                            title={message.agentMessage}
                          >
                            {message.agentMessage}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm max-w-xs">
                          <div className="truncate" title={message.userMessage}>
                            {message.userMessage}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {message.agentName}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {message.timestamp}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {message.feedback && (
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                message.feedback === "like"
                                  ? "bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100"
                                  : "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100"
                              }`}
                            >
                              {message.feedback}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StarRating
                            rating={message.satisfaction}
                            onRatingChange={(rating) =>
                              handleRatingChange(message.message_id, rating)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden w-full max-w-6xl space-y-4">
                {currentMessages.map((message) => (
                  <div
                    key={message.id}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-700"
                  >
                    {/* Header with ID and Agent */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                          #{message.id}
                        </span>
                        {message.agentName && (
                          <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
                            {message.agentName}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                        {message.timestamp}
                      </div>
                    </div>

                    {/* Question */}
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t.columns.question}
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded">
                        {message.agentMessage}
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t.columns.answer}
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded">
                        {message.userMessage}
                      </div>
                    </div>

                    {/* Feedback and Rating */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex items-center space-x-3">
                        {message.feedback && (
                          <div>
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {t.columns.feedback}
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                message.feedback === "like"
                                  ? "bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100"
                                  : "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100"
                              }`}
                            >
                              {message.feedback}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-start sm:items-end">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {t.columns.satisfaction}
                        </div>
                        <StarRating
                          rating={message.satisfaction}
                          onRatingChange={(rating) =>
                            handleRatingChange(message.message_id, rating)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {currentMessages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-4xl mb-4">🔍</div>
                    <div className="text-gray-600 dark:text-gray-400 text-sm">
                      {language === "zh-TW"
                        ? "沒有找到符合條件的記錄"
                        : "No matching records found"}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-center mt-6 gap-3 items-center">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg transition-all duration-200 ease-in-out
                    bg-blue-500 hover:bg-blue-600 text-white
                    disabled:bg-gray-300 dark:disabled:bg-gray-700
                    disabled:cursor-not-allowed
                    shadow-md hover:shadow-lg
                    transform hover:-translate-y-0.5
                    flex items-center justify-center min-w-[44px] min-h-[44px]"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span className="sm:hidden ml-2">Previous</span>
                </button>

                <form
                  onSubmit={handlePageSubmit}
                  className="flex items-center gap-2 sm:gap-3"
                >
                  <input
                    type="number"
                    value={inputPage}
                    onChange={handlePageInput}
                    min="1"
                    max={totalPages}
                    placeholder={`${currentPage}`}
                    className="w-16 sm:w-20 px-2 sm:px-3 py-2 text-center text-sm sm:text-base rounded-lg
                      border-2 border-blue-200 focus:border-blue-500
                      dark:border-blue-800 dark:focus:border-blue-600
                      outline-none transition-all duration-200
                      bg-white dark:bg-gray-800 
                      text-black dark:text-white"
                  />
                  <span className="text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base">
                    of {totalPages}
                  </span>
                </form>

                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg transition-all duration-200 ease-in-out
                    bg-blue-500 hover:bg-blue-600 text-white
                    disabled:bg-gray-300 dark:disabled:bg-gray-700
                    disabled:cursor-not-allowed
                    shadow-md hover:shadow-lg
                    transform hover:-translate-y-0.5
                    flex items-center justify-center min-w-[44px] min-h-[44px]"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span className="sm:hidden ml-2">Next</span>
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
