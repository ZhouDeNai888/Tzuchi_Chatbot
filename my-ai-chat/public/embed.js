(function() {
  // Get the script element that loaded this script
  const script = document.currentScript;
  const theme = script.getAttribute('data-theme') || 'light';
  
  // Create and append the chat widget styles
  const style = document.createElement('style');
  style.textContent = `
    .ai-chat-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
    }
    
    .ai-chat-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: #2563eb;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s;
    }
    
    .ai-chat-button:hover {
      transform: scale(1.05);
    }
    
    .ai-chat-container {
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 380px;
      height: 600px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    
    .ai-chat-container.dark {
      background: #1f2937;
      color: white;
    }
    
    .ai-chat-header {
      padding: 15px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .dark .ai-chat-header {
      border-bottom-color: #374151;
    }
    
    .ai-chat-close {
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    
    .ai-chat-close:hover {
      opacity: 1;
    }
    
    .ai-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 15px;
    }
    
    .ai-chat-input-container {
      padding: 15px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 10px;
    }
    
    .dark .ai-chat-input-container {
      border-top-color: #374151;
    }
    
    .ai-chat-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      outline: none;
    }
    
    .dark .ai-chat-input {
      background: #374151;
      border-color: #4b5563;
      color: white;
    }
    
    .ai-chat-send {
      padding: 8px 16px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .ai-chat-send:hover {
      background: #1d4ed8;
    }
    
    .ai-chat-send:disabled {
      background: #93c5fd;
      cursor: not-allowed;
    }
    
    .message {
      margin-bottom: 10px;
      max-width: 80%;
      padding: 10px;
      border-radius: 10px;
    }
    
    .user-message {
      background: #2563eb;
      color: white;
      margin-left: auto;
    }
    
    .bot-message {
      background: #f3f4f6;
      color: black;
    }
    
    .dark .bot-message {
      background: #374151;
      color: white;
    }
  `;
  document.head.appendChild(style);
  
  // Create the chat widget HTML
  const widget = document.createElement('div');
  widget.className = 'ai-chat-widget';
  widget.innerHTML = `
    <div class="ai-chat-button">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </div>
    <div class="ai-chat-container ${theme}">
      <div class="ai-chat-header">
        <div>Chat Assistant</div>
        <div class="ai-chat-close">✕</div>
      </div>
      <div class="ai-chat-messages"></div>
      <div class="ai-chat-input-container">
        <input type="text" class="ai-chat-input" placeholder="Type your message...">
        <button class="ai-chat-send">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(widget);
  
  // Get DOM elements
  const button = widget.querySelector('.ai-chat-button');
  const container = widget.querySelector('.ai-chat-container');
  const closeButton = widget.querySelector('.ai-chat-close');
  const input = widget.querySelector('.ai-chat-input');
  const sendButton = widget.querySelector('.ai-chat-send');
  const messagesContainer = widget.querySelector('.ai-chat-messages');
  
  // Toggle chat container
  button.addEventListener('click', () => {
    container.style.display = container.style.display === 'none' ? 'flex' : 'none';
    button.style.display = 'none';
  });
  
  closeButton.addEventListener('click', () => {
    container.style.display = 'none';
    button.style.display = 'flex';
  });
  
  // Handle sending messages
  async function sendMessage(content) {
    if (!content.trim()) return;
    
    // Add user message to chat
    const userMsg = document.createElement('div');
    userMsg.className = 'message user-message';
    userMsg.textContent = content;
    messagesContainer.appendChild(userMsg);
    
    // Clear input
    input.value = '';
    input.disabled = true;
    sendButton.disabled = true;
    
    try {
      // For testing: Just echo back the message
      setTimeout(() => {
        const botMsg = document.createElement('div');
        botMsg.className = 'message bot-message';
        botMsg.textContent = "Test response: " + content;
        messagesContainer.appendChild(botMsg);
        
        input.disabled = false;
        sendButton.disabled = false;
        input.focus();
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 1000);
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = document.createElement('div');
      errorMsg.className = 'message bot-message';
      errorMsg.textContent = 'Sorry, an error occurred. Please try again.';
      messagesContainer.appendChild(errorMsg);
      
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  }
  
  // Send message on button click or enter key
  sendButton.addEventListener('click', () => sendMessage(input.value));
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage(input.value);
  });
  
  // Initial setup
  container.style.display = 'none';
  button.style.display = 'flex';
})();