(function () {
  // Get the script element that loaded this script
  const script = document.currentScript;
  const theme = script.getAttribute('data-theme') || 'light';
  // Get API key from script attribute or use default
  const apiKey = script.getAttribute('data-api-key') || '';
  const chatUrl = script.getAttribute('data-api-url') || 'api/chat';
  const configUrl = script.getAttribute('data-config-url') || 'api/agents/config';
  const base = 'https://tcubot.tcu.edu.tw/';

  // Add Font Awesome - update to the latest version
  const fontAwesomeLink = document.createElement('link');
  fontAwesomeLink.rel = 'stylesheet';
  fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
  document.head.appendChild(fontAwesomeLink);

  // Add Marked.js for markdown rendering
  const markedScript = document.createElement('script');
  markedScript.src = 'https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js';
  document.head.appendChild(markedScript);

  // Create and append the chat widget styles
  const style = document.createElement('style');
  style.textContent = `
    #ai-chat-widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    #ai-chat-widget-button {
      width: 60px;
      height: 60px;
      border-radius: 20px;
      background-color: #6366f1;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
      align-self: flex-end;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border: none;
      font-size: 24px;
      transform-origin: bottom right;
    }
    
    #ai-chat-widget-button:hover {
      transform: scale(1.1);
      background-color: #4f46e5;
      box-shadow: 0 6px 24px rgba(99, 102, 241, 0.4);
    }
    
    #ai-chat-widget-popup {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 450px; /* Increased from 380px to 450px */
      height: 600px;
      background-color: ${theme === 'dark' ? '#1e1e2e' : '#ffffff'};
      border-radius: 24px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, ${theme === 'dark' ? '0.5' : '0.2'});
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid ${theme === 'dark' ? '#2d2d3f' : 'rgba(230, 230, 250, 0.7)'};
      transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
      backdrop-filter: blur(10px);
    }
    
    #ai-chat-widget-popup.open {
      display: flex;
      animation: ai-chat-widget-popup-open 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      transform-origin: bottom right;
    }
    
    @keyframes ai-chat-widget-popup-open {
      0% { opacity: 0; transform: scale(0.9) translateY(20px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    
    #ai-chat-widget-header {
      padding: 20px 24px;
      background: ${theme === 'dark'
      ? 'linear-gradient(135deg, #4f46e5 0%, #7e22ce 100%)'
      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'};
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top-left-radius: 24px;
      border-top-right-radius: 24px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }
    
    #ai-chat-widget-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: white;
      display: flex;
      align-items: center;
      gap: 10px;
      letter-spacing: 0.3px;
    }
    
    #ai-chat-widget-title i {
      font-size: 20px;
      background: rgba(255, 255, 255, 0.2);
      padding: 8px;
      border-radius: 12px;
      backdrop-filter: blur(5px);
    }
    
    #ai-chat-widget-close {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      cursor: pointer;
      color: white;
      font-size: 16px;
      padding: 8px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      width: 32px;
      height: 32px;
      backdrop-filter: blur(5px);
    }
    
    #ai-chat-widget-close:hover {
      background-color: rgba(255, 255, 255, 0.25);
      transform: scale(1.05);
    }
    
    #ai-chat-widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      background-color: ${theme === 'dark' ? '#1e1e2e' : '#f9fafb'};
      scrollbar-width: thin;
      scrollbar-color: ${theme === 'dark' ? '#383850 #1e1e2e' : '#d1d5db #f9fafb'};
      background-image: ${theme === 'dark'
      ? 'radial-gradient(circle at 25% 10%, rgba(79, 70, 229, 0.05) 0%, transparent 30%), radial-gradient(circle at 75% 90%, rgba(126, 34, 206, 0.05) 0%, transparent 30%)'
      : 'radial-gradient(circle at 25% 10%, rgba(99, 102, 241, 0.03) 0%, transparent 30%), radial-gradient(circle at 75% 90%, rgba(139, 92, 246, 0.03) 0%, transparent 30%)'};
    }
    
    #ai-chat-widget-messages::-webkit-scrollbar {
      width: 6px;
    }
    
    #ai-chat-widget-messages::-webkit-scrollbar-track {
      background: ${theme === 'dark' ? '#1e1e2e' : '#f9fafb'};
    }
    
    #ai-chat-widget-messages::-webkit-scrollbar-thumb {
      background-color: ${theme === 'dark' ? '#383850' : '#d1d5db'};
      border-radius: 6px;
    }
    
    .ai-chat-widget-message-container {
      display: flex;
      max-width: 100%;
      position: relative;
      transition: transform 0.2s;
    }
    
    .ai-chat-widget-message-container.user {
      justify-content: flex-end;
      animation: ai-chat-widget-message-in-right 0.3s ease forwards;
    }
    
    .ai-chat-widget-message-container.bot {
      justify-content: flex-start;
      animation: ai-chat-widget-message-in-left 0.3s ease forwards;
    }
    
    @keyframes ai-chat-widget-message-in-right {
      0% { opacity: 0; transform: translateX(10px); }
      100% { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes ai-chat-widget-message-in-left {
      0% { opacity: 0; transform: translateX(-10px); }
      100% { opacity: 1; transform: translateX(0); }
    }
    
    .ai-chat-widget-message {
      max-width: 85%;
      padding: 14px 18px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.6;
      overflow-wrap: break-word;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      transition: all 0.2s;
    }
    
    /* Add responsive table styling to prevent overflow */
    .ai-chat-widget-message table {
      display: block;
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      margin-bottom: 10px;
      border-collapse: collapse;
    }
    
    .ai-chat-widget-message th,
    .ai-chat-widget-message td {
      min-width: 80px; /* Ensure cells don't get too narrow */
      white-space: normal; /* Allow text to wrap in cells */
      word-break: break-word; /* Break long words if needed */
    }
    
    .ai-chat-widget-message-container.user .ai-chat-widget-message {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      border-bottom-right-radius: 6px;
      border-top-right-radius: 20px;
      border-top-left-radius: 20px;
      border-bottom-left-radius: 20px;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
    }
    
    .ai-chat-widget-message-container.bot .ai-chat-widget-message {
      background-color: ${theme === 'dark' ? '#2d2d3f' : 'white'};
      color: ${theme === 'dark' ? '#e5e7eb' : '#1f2937'};
      border-bottom-left-radius: 6px;
      border-top-right-radius: 20px;
      border-top-left-radius: 20px;
      border-bottom-right-radius: 20px;
      border: 1px solid ${theme === 'dark' ? '#383850' : 'rgba(230, 230, 250, 0.7)'};
      box-shadow: ${theme === 'dark' ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.05)'};
    }
    
    .ai-chat-widget-avatar {
      width: 36px;
      height: 36px;
      min-width: 36px; /* Prevent shrinking */
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      margin-right: 12px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s;
      flex-shrink: 0; /* Prevent the avatar from shrinking */
    }
    
    .ai-chat-widget-message-container.bot {
      display: flex;
      align-items: flex-start;
    }
    
    .ai-chat-widget-message-content {
      display: flex;
      flex-direction: column;
      max-width: calc(100% - 48px); /* Account for avatar width + margin */
      width: 100%;
    }
    
    .ai-chat-widget-message p {
      margin: 0 0 10px 0;
    }
    
    .ai-chat-widget-message p:last-child {
      margin-bottom: 0;
    }
    
    .ai-chat-widget-message a {
      color: ${theme === 'dark' ? '#a5b4fc' : '#4f46e5'};
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
      border-bottom: 1px dotted ${theme === 'dark' ? '#a5b4fc' : '#4f46e5'};
    }
    
    .ai-chat-widget-message a:hover {
      color: ${theme === 'dark' ? '#c7d2fe' : '#6366f1'};
      border-bottom: 1px solid;
    }
    
    .ai-chat-widget-message ul, .ai-chat-widget-message ol {
      margin: 8px 0;
      padding-left: 20px;
    }
    
    .ai-chat-widget-message code {
      background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.1)'};
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Fira Code', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
    }
    
    .ai-chat-widget-message pre {
      background-color: ${theme === 'dark' ? '#1a1a27' : 'rgba(99, 102, 241, 0.05)'};
      padding: 12px 16px;
      border-radius: 12px;
      overflow-x: auto;
      margin: 12px 0;
      border: 1px solid ${theme === 'dark' ? '#2d2d3f' : 'rgba(99, 102, 241, 0.2)'};
    }
    
    .ai-chat-widget-message pre code {
      background-color: transparent;
      padding: 0;
      color: ${theme === 'dark' ? '#e5e7eb' : 'inherit'};
    }
    
    .ai-chat-widget-feedback {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      gap: 8px;
      flex-wrap: wrap; /* Allow buttons to wrap on narrow screens */
      width: 100%; /* Ensure the container uses the full width available */
      max-width: 100%; /* Prevent overflow */
    }
    
    .ai-chat-widget-feedback-button {
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 5px;
      border-radius: 8px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
      flex-shrink: 0; /* Prevent the buttons from shrinking */
    }
    
    .ai-chat-widget-feedback-button:hover {
      background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.1)'};
      transform: scale(1.1);
    }
    
    .ai-chat-widget-feedback-button.active {
      background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(99, 102, 241, 0.15)'};
    }
    
    .ai-chat-widget-feedback-button.like.active {
      color: #10b981;
    }
    
    .ai-chat-widget-feedback-button.dislike.active {
      color: #ef4444;
    }
    
    .ai-chat-widget-copy-button {
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 5px 8px;
      border-radius: 8px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
      white-space: nowrap; /* Keep text on one line */
    }
    
    .ai-chat-widget-copy-button:hover {
      background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.1)'};
    }
    
    .ai-chat-widget-copy-button.copied {
      color: #10b981;
      background-color: ${theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)'};
    }
    
    #ai-chat-widget-input-container {
      padding: 16px 24px;
      border-top: 1px solid ${theme === 'dark' ? '#2d2d3f' : 'rgba(230, 230, 250, 0.7)'};
      display: flex;
      gap: 12px;
      background-color: ${theme === 'dark' ? '#1e1e2e' : '#ffffff'};
      align-items: center;
      border-bottom-left-radius: 24px;
      border-bottom-right-radius: 24px;
    }
    
    #ai-chat-widget-input {
      flex: 1;
      padding: 14px 18px;
      border-radius: 18px;
      border: 1px solid ${theme === 'dark' ? '#383850' : 'rgba(230, 230, 250, 0.7)'};
      background-color: ${theme === 'dark' ? '#2d2d3f' : '#f9fafb'};
      color: ${theme === 'dark' ? '#e5e7eb' : '#1f2937'};
      outline: none;
      font-size: 14px;
      transition: all 0.2s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    
    #ai-chat-widget-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }
    
    #ai-chat-widget-send {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      border: none;
      border-radius: 14px;
      width: 42px;
      height: 42px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 16px;
      box-shadow: 0 2px 5px rgba(99, 102, 241, 0.25);
    }
    
    #ai-chat-widget-send:hover {
      transform: scale(1.05) rotate(45deg);
    }
    
    #ai-chat-widget-send:active {
      transform: scale(0.95) rotate(45deg);
    }
    
    #ai-chat-widget-send:disabled {
      background: ${theme === 'dark' ? '#383850' : '#d1d5db'};
      box-shadow: none;
      cursor: not-allowed;
      transform: scale(1);
    }
    
    #ai-chat-widget-loading {
      display: none;
      align-items: center;
      gap: 4px;
      padding: 16px;
      border-radius: 18px;
      background-color: ${theme === 'dark' ? '#2d2d3f' : 'white'};
      color: ${theme === 'dark' ? '#e5e7eb' : '#1f2937'};
      align-self: flex-start;
      max-width: 80%;
      margin-bottom: 8px;
      box-shadow: ${theme === 'dark' ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.05)'};
      border: 1px solid ${theme === 'dark' ? '#383850' : 'rgba(230, 230, 250, 0.7)'};
    }
    
    .ai-chat-widget-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
      animation: ai-chat-widget-pulse 1.5s infinite cubic-bezier(0.4, 0, 0.6, 1);
    }
    
    .ai-chat-widget-dot:nth-child(2) {
      animation-delay: 0.3s;
    }
    
    .ai-chat-widget-dot:nth-child(3) {
      animation-delay: 0.6s;
    }
    
    @keyframes ai-chat-widget-pulse {
      0%, 100% {
        opacity: 0.4;
        transform: scale(0.75);
      }
      50% {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    /* Streaming styles */
    .cursor-blink {
      display: inline-block;
      width: 0.5em;
      height: 1em;
      background-color: currentColor;
      margin-left: 0.1em;
      animation: blink 1s infinite cubic-bezier(0.4, 0, 0.6, 1);
      vertical-align: text-bottom;
      opacity: 0.7;
      border-radius: 1px;
    }
    
    @keyframes blink {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 0.2; }
    }
    
    @media (max-width: 480px) {
      #ai-chat-widget-popup {
        width: calc(100vw - 40px);
        height: calc(100vh - 120px);
        bottom: 80px;
      }
    }
  `;
  document.head.appendChild(style);

  // Fix the setMessageContent function definition - it should be positioned before it's used
  function setMessageContent(element, text) {
    // For empty or very short responses, display them directly
    if (!text || text.length < 50) {
      element.textContent = text || '';
      return;
    }

    // Check if marked library is loaded and use it for markdown rendering
    if (window.marked && typeof window.marked === 'function') {
      try {
        // Configure marked options similar to ReactMarkdown in page.tsx
        window.marked.use({
          gfm: true, // GitHub Flavored Markdown (similar to remarkGfm)
          breaks: true, // Add <br> on single line breaks
          headerIds: false, // Don't add IDs to headers
          mangle: false, // Don't mangle email links
          tables: true, // Enable table parsing
          renderer: {
            // Custom renderers for different markdown elements - similar to page.tsx components prop
            heading(text, level) {
              const className = level <= 3 ? 'text-xl font-bold my-3' : 'text-lg font-semibold my-2';
              return `<h${level} class="${className}">${text}</h${level}>`;
            },
            paragraph(text) {
              return `<p class="m-0">${text}</p>`;
            },
            link(href, title, text) {
              return `<a class="text-blue-300 hover:underline cursor-pointer" href="${href}" target="_blank" rel="noopener noreferrer" onclick="event.preventDefault(); window.open('${href}', '_blank', 'noopener,noreferrer');">${text}</a>`;
            },
            list(body, ordered) {
              const listType = ordered ? 'ol' : 'ul';
              const className = ordered ? 'list-decimal list-inside my-2' : 'list-disc list-inside my-2';
              return `<${listType} class="${className}">${body}</${listType}>`;
            },
            code(code, language) {
              return `<code class="bg-gray-900 px-1 rounded">${code}</code>`;
            },
            codespan(code) {
              return `<code class="bg-gray-900 px-1 rounded">${code}</code>`;
            },
            table(header, body) {
              // Enhanced table implementation with proper styling
              if (!header || !body) {
                return '<table class="border-collapse my-4 w-full"></table>';
              }

              // Improved table structure with better styling for dark/light modes
              return '<table class="border-collapse my-4 w-full border border-gray-300 dark:border-gray-600">' +
                '<thead class="bg-gray-100 dark:bg-gray-700">' + header + '</thead>' +
                '<tbody class="divide-y divide-gray-200 dark:divide-gray-700">' + body + '</tbody>' +
                '</table>';
            },
            tablerow(content) {
              return '<tr class="divide-x divide-gray-200 dark:divide-gray-700">' + content + '</tr>';
            },
            tablecell(content, { header, align }) {
              const type = header ? 'th' : 'td';
              const alignStyle = align ? ` style="text-align:${align}"` : '';
              const className = header
                ? 'border border-gray-300 dark:border-gray-600 px-4 py-2 font-bold text-left bg-gray-50 dark:bg-gray-800'
                : 'border border-gray-300 dark:border-gray-600 px-4 py-2';
              return `<${type} class="${className}"${alignStyle}>${content}</${type}>`;
            },
            blockquote(quote) {
              return `<blockquote class="border-l-4 border-gray-300 dark:border-gray-700 pl-4 py-1 my-2 italic">${quote}</blockquote>`;
            },
            hr() {
              return '<hr class="my-4 border-gray-300 dark:border-gray-700">';
            },
            image(href, title, text) {
              return `<img src="${href}" alt="${text}" title="${title || ''}" class="max-w-full my-2 rounded">`;
            },
            strong(text) {
              return `<strong class="font-bold">${text}</strong>`;
            },
            em(text) {
              return `<em class="italic">${text}</em>`;
            }
          }
        });

        // Use marked.js to render markdown
        element.innerHTML = window.marked.parse(text);
        return;
      } catch (error) {
        console.error('Error using marked.js:', error);
        // Fall back to original method if marked fails
      }
    }

    // If marked.js is not available or fails, fall back to basic rendering
    // Clear existing content
    element.innerHTML = '';

    // Simple markdown-like processing - this is the fallback method
    const lines = text.split('\n');
    let currentParagraph = null;
    let inCodeBlock = false;
    let codeBlockContent = '';
    let codeBlockLanguage = '';
    let inOrderedList = false;
    let inUnorderedList = false;
    let currentList = null;
    let currentTable = null;
    let inTableHeader = false;

    lines.forEach((line, lineIndex) => {
      // Handle code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // Starting a code block
          inCodeBlock = true;
          // Extract language if specified
          codeBlockLanguage = line.slice(3).trim();
          codeBlockContent = '';

          if (currentParagraph) {
            element.appendChild(currentParagraph);
            currentParagraph = null;
          }
          return;
        } else {
          // Ending a code block
          inCodeBlock = false;
          const preElement = document.createElement('pre');
          preElement.className = 'bg-gray-900 p-2 rounded my-2';

          const codeElement = document.createElement('code');
          codeElement.textContent = codeBlockContent;
          codeElement.className = codeBlockLanguage ? `language-${codeBlockLanguage}` : '';

          preElement.appendChild(codeElement);
          element.appendChild(preElement);
          codeBlockContent = '';
          codeBlockLanguage = '';
          return;
        }
      }

      // Collect content inside code block
      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        return;
      }

      // Handle tables
      if (line.includes('|')) {
        const cells = line.split('|').filter(cell => cell.trim() !== '');

        // Check if this is a table header separator line (e.g., |---|---|)
        // More flexible pattern matching for separator rows with dashes, colons
        if (line.trim().match(/^\|?\s*[-:]+[-:\s]*\|[-:\s|]*$/)) {
          inTableHeader = true;

          // If we already have a table with rows, the row immediately before this
          // separator should be treated as the header
          if (currentTable && currentTable.querySelector('tbody tr')) {
            const firstRow = currentTable.querySelector('tbody tr:first-child');
            if (firstRow) {
              // Convert td to th elements
              Array.from(firstRow.children).forEach(td => {
                const th = document.createElement('th');
                th.className = 'border border-gray-300 dark:border-gray-600 px-4 py-2 font-bold text-left bg-gray-50 dark:bg-gray-800';
                th.textContent = td.textContent;
                td.replaceWith(th);
              });

              // Move to header
              currentTable.querySelector('thead').appendChild(firstRow);
            }
          }
          return;
        }

        if (!currentTable) {
          // Start a new table
          currentTable = document.createElement('table');
          currentTable.className = 'border-collapse my-4 w-full border border-gray-300 dark:border-gray-600';

          if (currentParagraph) {
            element.appendChild(currentParagraph);
            currentParagraph = null;
          }

          // Create table header
          const thead = document.createElement('thead');
          thead.className = 'bg-gray-100 dark:bg-gray-700';
          currentTable.appendChild(thead);

          // Create table body
          const tbody = document.createElement('tbody');
          tbody.className = 'divide-y divide-gray-200 dark:divide-gray-700';
          currentTable.appendChild(tbody);

          element.appendChild(currentTable);

          // Set a flag to indicate this is the first row (potentially a header)
          currentTable.setAttribute('data-first-row', 'true');
        }

        // Create a new row
        const tr = document.createElement('tr');
        tr.className = 'divide-x divide-gray-200 dark:divide-gray-700';

        // Determine if this is a header row
        // A row is a header if:
        // 1. We've seen a separator line right before this row, OR
        // 2. This is the first row of the table and will be promoted to header when we see a separator next
        const isFirstRow = currentTable.getAttribute('data-first-row') === 'true';
        currentTable.removeAttribute('data-first-row');

        // Mark as header if we've seen a separator line
        const isHeader = inTableHeader;

        // Keep track of the first row so we can move it to header later if needed
        if (isFirstRow && !inTableHeader) {
          tr.setAttribute('data-potential-header', 'true');
        }

        cells.forEach(cell => {
          const cellElement = document.createElement(isHeader ? 'th' : 'td');
          cellElement.className = isHeader
            ? 'border border-gray-300 dark:border-gray-600 px-4 py-2 font-bold text-left bg-gray-50 dark:bg-gray-800'
            : 'border border-gray-300 dark:border-gray-600 px-4 py-2';
          cellElement.textContent = cell.trim();
          tr.appendChild(cellElement);
        });

        if (isHeader) {
          currentTable.querySelector('thead').appendChild(tr);
          inTableHeader = false; // Reset after adding header
        } else {
          currentTable.querySelector('tbody').appendChild(tr);

          // If this is the first row and we haven't seen a separator yet, save it as potential header
          if (isFirstRow) {
            tr.setAttribute('data-potential-header', 'true');
          }
        }

        // If we encounter a separator line and have a first row already rendered in the body,
        // move it to the header section
        if (inTableHeader && currentTable.querySelector('tbody tr[data-potential-header="true"]')) {
          const potentialHeader = currentTable.querySelector('tbody tr[data-potential-header="true"]');
          if (potentialHeader) {
            // Remove from body
            potentialHeader.removeAttribute('data-potential-header');

            // Convert td to th elements
            Array.from(potentialHeader.children).forEach(td => {
              const th = document.createElement('th');
              th.className = 'border border-gray-300 dark:border-gray-600 px-4 py-2 font-bold text-left bg-gray-50 dark:bg-gray-800';
              th.textContent = td.textContent;
              td.replaceWith(th);
            });

            // Move to header
            currentTable.querySelector('thead').appendChild(potentialHeader);

            // Reset header flag
            inTableHeader = false;
          }
        }

        return;
      } else if (currentTable) {
        // Line not part of the table, close it
        currentTable = null;
        inTableHeader = false; // Reset table header flag
      }

      // Handle headers (# Header)
      if (line.match(/^#{1,6}\s/)) {
        if (currentParagraph) {
          element.appendChild(currentParagraph);
          currentParagraph = null;
        }

        if (currentList) {
          element.appendChild(currentList);
          currentList = null;
          inOrderedList = false;
          inUnorderedList = false;
        }

        const level = line.match(/^#{1,6}/)[0].length;
        const content = line.slice(level).trim();

        const header = document.createElement(`h${level}`);
        header.textContent = content;
        header.className = level <= 3 ? 'text-xl font-bold my-3' : 'text-lg font-semibold my-2';
        element.appendChild(header);
        return;
      }

      // Handle unordered lists
      if (line.trim().match(/^[*\-•]\s+/)) {
        if (currentParagraph) {
          element.appendChild(currentParagraph);
          currentParagraph = null;
        }

        const content = line.trim().replace(/^[*\-•]\s+/, '');

        if (!inUnorderedList) {
          inUnorderedList = true;
          inOrderedList = false;
          currentList = document.createElement('ul');
          currentList.className = 'list-disc list-inside my-2';
        }

        const li = document.createElement('li');
        li.textContent = content;
        currentList.appendChild(li);
        return;
      }

      // Handle ordered lists
      if (line.trim().match(/^\d+\.\s+/)) {
        if (currentParagraph) {
          element.appendChild(currentParagraph);
          currentParagraph = null;
        }

        const content = line.trim().replace(/^\d+\.\s+/, '');

        if (!inOrderedList) {
          inOrderedList = true;
          inUnorderedList = false;
          currentList = document.createElement('ol');
          currentList.className = 'list-decimal list-inside my-2';
        }

        const li = document.createElement('li');
        li.textContent = content;
        currentList.appendChild(li);
        return;
      }

      // Handle line breaks and paragraphs
      if (line.trim() === '') {
        if (currentParagraph) {
          element.appendChild(currentParagraph);
          currentParagraph = null;
        }

        if (currentList) {
          element.appendChild(currentList);
          currentList = null;
          inOrderedList = false;
          inUnorderedList = false;
        }
        return;
      }

      // Process regular text with inline formatting
      if (!currentParagraph) {
        currentParagraph = document.createElement('p');
        currentParagraph.className = 'm-0';
      } else if (currentList) {
        // Not a list item anymore
        element.appendChild(currentList);
        currentList = null;
        inOrderedList = false;
        inUnorderedList = false;
        currentParagraph = document.createElement('p');
        currentParagraph.className = 'm-0';
      } else {
        currentParagraph.appendChild(document.createElement('br'));
      }

      // Process inline formatting (bold, italic, code, links)
      let remainingText = line;

      // Process text while there are still markdown patterns to find
      while (remainingText.length > 0) {
        // Check for inline code with backticks
        let match = remainingText.match(/`([^`]+)`/);
        if (match) {
          // Add text before the match
          if (match.index > 0) {
            currentParagraph.appendChild(document.createTextNode(remainingText.substring(0, match.index)));
          }

          // Create code element
          const codeElement = document.createElement('code');
          codeElement.className = 'bg-gray-900 px-1 rounded';
          codeElement.textContent = match[1];
          currentParagraph.appendChild(codeElement);

          // Update remaining text
          remainingText = remainingText.substring(match.index + match[0].length);
          continue;
        }

        // Check for bold text with **
        match = remainingText.match(/\*\*([^*]+)\*\*/);
        if (match) {
          // Add text before the match
          if (match.index > 0) {
            currentParagraph.appendChild(document.createTextNode(remainingText.substring(0, match.index)));
          }

          // Create strong element
          const strongElement = document.createElement('strong');
          strongElement.textContent = match[1];
          currentParagraph.appendChild(strongElement);

          // Update remaining text
          remainingText = remainingText.substring(match.index + match[0].length);
          continue;
        }

        // Check for italic text with *
        match = remainingText.match(/\*([^*]+)\*/);
        if (match) {
          // Add text before the match
          if (match.index > 0) {
            currentParagraph.appendChild(document.createTextNode(remainingText.substring(0, match.index)));
          }

          // Create italic element
          const italicElement = document.createElement('em');
          italicElement.textContent = match[1];
          currentParagraph.appendChild(italicElement);

          // Update remaining text
          remainingText = remainingText.substring(match.index + match[0].length);
          continue;
        }

        // Check for links [text](url)
        match = remainingText.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (match) {
          // Add text before the match
          if (match.index > 0) {
            currentParagraph.appendChild(document.createTextNode(remainingText.substring(0, match.index)));
          }

          // Create link element
          const linkElement = document.createElement('a');
          linkElement.textContent = match[1];
          linkElement.href = match[2];
          linkElement.className = 'text-blue-300 hover:underline cursor-pointer';
          linkElement.target = '_blank';
          linkElement.rel = 'noopener noreferrer';

          // Add click handler
          linkElement.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(linkElement.href, '_blank', 'noopener,noreferrer');
          });

          currentParagraph.appendChild(linkElement);

          // Update remaining text
          remainingText = remainingText.substring(match.index + match[0].length);
          continue;
        }

        // If no match was found, add all remaining text
        currentParagraph.appendChild(document.createTextNode(remainingText));
        break;
      }
    });

    // Add final paragraph if it exists
    if (currentParagraph) {
      element.appendChild(currentParagraph);
    }

    // Add final list if it exists
    if (currentList) {
      element.appendChild(currentList);
    }

    // Fallback if no content was added
    if (!element.hasChildNodes() && text.trim()) {
      const p = document.createElement('p');
      p.textContent = text;
      element.appendChild(p);
    }
  }

  // Fetch agent configuration first, then initialize the chat widget
  async function initializeChatWidget() {
    let agentConfig = {
      title: 'Chat Assistant',
      welcomeMessage: "Hello! How can I help you today?",
      model: '',
      department_id: '',
      agent_key: ''
    };

    if (apiKey) {
      try {
        const response = await fetch(`${base + configUrl}/${apiKey}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          }
        });

        if (response.ok) {
          const configData = await response.json();
          if (configData) {
            agentConfig = {
              ...agentConfig,
              ...configData,
              // Extract specific fields from the config response
              model: configData.model || '',
              department_id: configData.department_id || '',
              agent_key: configData.agent_key || '',
              title: configData.shared_agent_name || 'Chat Assistant',
            };
          }
        } else {
          console.warn('Could not fetch agent configuration, using defaults');
        }
      } catch (error) {
        console.error('Error fetching agent configuration:', error);
      }
    }

    // Create chat widget elements
    const container = document.createElement('div');
    container.id = 'ai-chat-widget-container';

    const chatButton = document.createElement('button');
    chatButton.id = 'ai-chat-widget-button';
    chatButton.innerHTML = `<i class="fas fa-comment-dots"></i>`;

    const popup = document.createElement('div');
    popup.id = 'ai-chat-widget-popup';

    const header = document.createElement('div');
    header.id = 'ai-chat-widget-header';

    const title = document.createElement('h3');
    title.id = 'ai-chat-widget-title';
    title.innerHTML = `<i class="fas fa-robot"></i> ${agentConfig.title || 'Chat Assistant'}`;

    const closeButton = document.createElement('button');
    closeButton.id = 'ai-chat-widget-close';
    closeButton.innerHTML = `<i class="fas fa-times"></i>`;

    const messages = document.createElement('div');
    messages.id = 'ai-chat-widget-messages';

    const loading = document.createElement('div');
    loading.id = 'ai-chat-widget-loading';
    loading.innerHTML = `
      <div class="ai-chat-widget-dot"></div>
      <div class="ai-chat-widget-dot"></div>
      <div class="ai-chat-widget-dot"></div>
    `;

    const inputContainer = document.createElement('div');
    inputContainer.id = 'ai-chat-widget-input-container';

    const input = document.createElement('input');
    input.id = 'ai-chat-widget-input';
    input.type = 'text';
    input.placeholder = 'Type a message...';

    const sendButton = document.createElement('button');
    sendButton.id = 'ai-chat-widget-send';
    sendButton.innerHTML = `<i class="fas fa-paper-plane"></i>`;

    // Find custom placement element or use document.body
    let targetElement = document.querySelector('tcu-ai') || document.body;

    // Append elements to build the chat widget
    header.appendChild(title);
    header.appendChild(closeButton);

    inputContainer.appendChild(input);
    inputContainer.appendChild(sendButton);

    popup.appendChild(header);
    popup.appendChild(messages);
    popup.appendChild(loading);
    popup.appendChild(inputContainer);

    container.appendChild(popup);
    container.appendChild(chatButton);

    // Append to the target element instead of always to document.body
    targetElement.appendChild(container);

    // Chat functionality
    let conversationHistory = [];
    let currentStream = null;

    // Toggle chat popup
    chatButton.addEventListener('click', function () {
      popup.classList.toggle('open');
      if (popup.classList.contains('open')) {
        input.focus();
      }
    });

    // Close button
    closeButton.addEventListener('click', function () {
      popup.classList.remove('open');
    });

    // Define showLoading and hideLoading functions before they're used
    function showLoading() {
      loading.style.display = 'flex';
      messages.scrollTop = messages.scrollHeight;
    }

    function hideLoading() {
      loading.style.display = 'none';
    }

    // Send message on button click
    sendButton.addEventListener('click', sendMessage);

    // Send message on Enter key
    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    function addUserMessage(text) {
      const messageContainer = document.createElement('div');
      messageContainer.classList.add('ai-chat-widget-message-container', 'user');

      const message = document.createElement('div');
      message.classList.add('ai-chat-widget-message', 'ai-chat-widget-message-user');
      message.textContent = text;

      messageContainer.appendChild(message);
      messages.appendChild(messageContainer);
      messages.scrollTop = messages.scrollHeight;

      // Add to conversation history
      conversationHistory.push({
        role: 'user',
        content: text
      });
    }

    function addBotMessage(text, isStreaming = false, messageId = null) {
      const messageContainer = document.createElement('div');
      messageContainer.classList.add('ai-chat-widget-message-container', 'bot');

      // Update avatar icon with a more modern design
      const avatar = document.createElement('div');
      avatar.classList.add('ai-chat-widget-avatar', 'bot');
      avatar.innerHTML = `<i class="fas fa-brain"></i>`;
      messageContainer.appendChild(avatar);

      const messageContent = document.createElement('div');
      messageContent.classList.add('ai-chat-widget-message-content');

      const message = document.createElement('div');
      message.classList.add('ai-chat-widget-message', 'ai-chat-widget-message-bot');
      message.style.width = 'fit-content'; // Ensure message only takes needed width

      // Store message ID if provided
      if (messageId) {
        message.setAttribute('data-message-id', messageId);
      }

      // Add message content with simple markdown parsing
      if (text) {
        setMessageContent(message, text);
      }

      // Add blinking cursor for streaming messages
      if (isStreaming) {
        const cursor = document.createElement('span');
        cursor.classList.add('cursor-blink');
        message.appendChild(cursor);
      }

      messageContent.appendChild(message);
      messageContainer.appendChild(messageContent);

      // Add feedback buttons for non-streaming messages that have an ID
      if (!isStreaming && messageId) {
        addFeedbackButtons(messageContent, messageId);
      }

      messages.appendChild(messageContainer);
      messages.scrollTop = messages.scrollHeight;

      // Add to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: text,
        id: messageId
      });

      return message;
    }

    // Add a new function to copy message text
    function copyMessageText(messageId, button) {
      // Find the message element by its ID
      const messageElement = document.querySelector(`.ai-chat-widget-message[data-message-id="${messageId}"]`);
      if (!messageElement) return;

      // Get the text content
      const textToCopy = messageElement.textContent.trim();

      // Use the Clipboard API to copy the text
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          // Visual feedback on success
          button.classList.add('copied');
          button.innerHTML = `<i class="fas fa-check"></i> Copied`;

          // Reset the button after 2 seconds
          setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = `<i class="fas fa-copy"></i> Copy`;
          }, 2000);
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
          // Visual feedback on failure
          button.innerHTML = `<i class="fas fa-times"></i> Failed`;
          setTimeout(() => {
            button.innerHTML = `<i class="fas fa-copy"></i> Copy`;
          }, 2000);
        });
    }

    // Update the addFeedbackButtons function to handle layout better
    function addFeedbackButtons(messageContent, messageId) {
      // Only add feedback if we have a valid message ID
      if (!messageId) return;

      // Check if feedback buttons already exist
      if (messageContent.querySelector('.ai-chat-widget-feedback')) return;

      const feedbackDiv = document.createElement('div');
      feedbackDiv.classList.add('ai-chat-widget-feedback');

      const likeButton = document.createElement('button');
      likeButton.classList.add('ai-chat-widget-feedback-button', 'like');
      likeButton.innerHTML = `<i class="fas fa-thumbs-up"></i>`;
      likeButton.setAttribute('aria-label', 'Like');
      likeButton.onclick = () => submitMessageFeedback(messageId, 'like', feedbackDiv, likeButton);

      const dislikeButton = document.createElement('button');
      dislikeButton.classList.add('ai-chat-widget-feedback-button', 'dislike');
      dislikeButton.innerHTML = `<i class="fas fa-thumbs-down"></i>`;
      dislikeButton.setAttribute('aria-label', 'Dislike');
      dislikeButton.onclick = () => submitMessageFeedback(messageId, 'dislike', feedbackDiv, dislikeButton);

      // Add copy button
      const copyButton = document.createElement('button');
      copyButton.classList.add('ai-chat-widget-copy-button');
      copyButton.innerHTML = `<i class="fas fa-copy"></i> Copy`;
      copyButton.setAttribute('aria-label', 'Copy text');
      copyButton.onclick = () => copyMessageText(messageId, copyButton);

      feedbackDiv.appendChild(likeButton);
      feedbackDiv.appendChild(dislikeButton);
      feedbackDiv.appendChild(copyButton);
      messageContent.appendChild(feedbackDiv);
    }

    // Modify the toggleFeedback function to submit feedback to the API
    async function submitMessageFeedback(messageId, feedback, container, button) {
      // Remove active class from all buttons in this container
      const buttons = container.querySelectorAll('.ai-chat-widget-feedback-button');
      buttons.forEach(btn => btn.classList.remove('active'));

      // Check if this button was already active (toggle behavior)
      const wasActive = button.classList.contains('active');

      // If it was active, we're removing feedback, otherwise adding it
      if (!wasActive) {
        // Add active class to the clicked button
        button.classList.add('active');
      }

      try {
        // Send feedback to the API
        const response = await fetch(`${base}api/messages/${messageId}/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({ feedback: wasActive ? null : feedback })
        });

        if (!response.ok) {
          console.error('Failed to submit feedback:', response.statusText);
          // Revert UI changes on error
          if (!wasActive) button.classList.remove('active');
        } else {
          console.log(`User gave ${feedback} feedback for message ID ${messageId}`);
        }
      } catch (error) {
        console.error('Error submitting feedback:', error);
        // Revert UI changes on error
        if (!wasActive) button.classList.remove('active');
      }
    }

    // Define showLoading and hideLoading functions before they're used
    function showLoading() {
      loading.style.display = 'flex';
      messages.scrollTop = messages.scrollHeight;
    }

    function hideLoading() {
      loading.style.display = 'none';
    }

    // Send message on button click
    sendButton.addEventListener('click', sendMessage);

    // Send message on Enter key
    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    function addUserMessage(text) {
      const messageContainer = document.createElement('div');
      messageContainer.classList.add('ai-chat-widget-message-container', 'user');

      const message = document.createElement('div');
      message.classList.add('ai-chat-widget-message', 'ai-chat-widget-message-user');
      message.textContent = text;

      messageContainer.appendChild(message);
      messages.appendChild(messageContainer);
      messages.scrollTop = messages.scrollHeight;

      // Add to conversation history
      conversationHistory.push({
        role: 'user',
        content: text
      });
    }

    function updateBotMessage(messageElement, text, isComplete = false) {
      console.log('Updating bot message with text:', text);

      // If the message element contains a cursor, remove it first
      const existingCursor = messageElement.querySelector('.cursor-blink');
      if (existingCursor) {
        existingCursor.remove();
      }

      // Set the content
      setMessageContent(messageElement, text);

      // Add blinking cursor if still streaming
      if (!isComplete) {
        const cursor = document.createElement('span');
        cursor.classList.add('cursor-blink');
        messageElement.appendChild(cursor);
      }

      // Force scroll to latest message
      const messagesContainer = document.getElementById('ai-chat-widget-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    function connectToStream(url, headers, body, messageElement) {
      const controller = new AbortController();
      const signal = controller.signal;
      let accumulatedText = '';
      let messageId = null;

      console.log('Connecting to stream URL:', url);
      console.log('Request body:', body);

      fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: signal
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
          }
          console.log('Stream connection established successfully');

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          function readStream() {
            reader.read().then(({ done, value }) => {
              if (done) {
                // Stream is complete, update UI
                console.log('Stream complete, final text:', accumulatedText);
                updateBotMessage(messageElement, accumulatedText, true);
                currentStream = null;
                hideLoading();
                return;
              }

              // Process the stream chunk
              const chunk = decoder.decode(value, { stream: true });
              console.log('Received chunk:', chunk);

              try {
                // Each line could be a JSON object
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                console.log('Parsed lines:', lines);

                for (const line of lines) {
                  try {
                    // Parse each line as JSON directly
                    const data = JSON.parse(line);
                    console.log('Parsed data:', data);

                    // Check for answer chunk field
                    if (data.answer_chunk) {
                      console.log('Found answer chunk:', data.answer_chunk);
                      accumulatedText += data.answer_chunk;

                      // Make sure we're updating the UI with the new text
                      updateBotMessage(messageElement, accumulatedText);
                      console.log('Updated bot message with text:', accumulatedText);
                    }

                    // Handle message ID when it comes at the end
                    if (data.agent_msg_id && !messageId) {
                      messageId = data.agent_msg_id;
                      console.log('Received message ID:', messageId);

                      // Store the message ID in the DOM element for feedback
                      messageElement.setAttribute('data-message-id', messageId);

                      // Also add feedback buttons now that we have a message ID
                      const messageContainer = messageElement.closest('.ai-chat-widget-message-content');
                      if (messageContainer) {
                        addFeedbackButtons(messageContainer, messageId);
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing JSON from stream:', e, line);
                  }
                }
              } catch (e) {
                console.error('Error processing stream chunk:', e);
              }

              // Continue reading
              readStream();
            }).catch(error => {
              console.error('Error reading stream:', error);
              updateBotMessage(messageElement, accumulatedText + "\n\nError: Connection lost.", true);
              currentStream = null;
              hideLoading();
            });
          }

          readStream();
        })
        .catch(error => {
          console.error('Error connecting to stream:', error);
          updateBotMessage(messageElement, "I'm sorry, there was an error processing your request.", true);
          currentStream = null;
          hideLoading();
        });

      return controller;
    }

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;

      // Disable the send button while processing
      sendButton.disabled = true;

      // Abort any existing stream
      if (currentStream) {
        currentStream.abort();
        currentStream = null;
      }

      addUserMessage(text);
      input.value = '';
      showLoading();

      try {
        // Prepare the request data
        const requestBody = {
          messages: [{ content: text, role: 'user' }],
          user_id: 1, // Default user_id or could be made configurable
          model: agentConfig.model,
          department_id: agentConfig.department_id,
          agent_key: agentConfig.agent_key
        };

        // Check if streaming is supported
        const useStreaming = script.getAttribute('data-streaming') !== 'false';

        if (useStreaming) {
          // Handle streaming response
          requestBody.stream = true;
          hideLoading(); // Hide the loading indicator as we'll show streaming text

          // Add empty message that will be updated with streaming content
          const botMessageElement = addBotMessage('', true);
          console.log('Created empty bot message element for streaming:', botMessageElement);

          // Set up headers
          const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          };

          // Connect to the stream
          currentStream = connectToStream(base + chatUrl, headers, requestBody, botMessageElement);
        } else {
          // Handle non-streaming response
          requestBody.stream = false;

          // Get server response
          const response = await fetch(base + chatUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
          }

          const data = await response.json();
          hideLoading();

          if (data && data.answer) {
            addBotMessage(data.answer);
          } else {
            addBotMessage("I'm sorry, I couldn't process your request. Please try again.");
          }
        }
      } catch (error) {
        console.error('Error:', error);
        hideLoading();
        addBotMessage("I'm sorry, there was an error processing your request. Please try again later.");
      } finally {
        // Re-enable the send button
        sendButton.disabled = false;
      }
    }

    // Add welcome message
    addBotMessage(agentConfig.welcomeMessage || "Hello! How can I help you today?");
  }

  // Start initialization
  initializeChatWidget();
})();