(function() {
    'use strict';

    window.EZhishiChatbot = {
        sessionId: null,
        chatHistory: [],
        
        init: function(config) {
            this.config = Object.assign({
                apiUrl: 'http://localhost:3000',
                position: 'bottom-right',
                primaryColor: '#007bff',
                title: 'eZhishi Support'
            }, config);

            this.createChatWidget();
            this.attachEventListeners();
            this.startSession();
        },

        startSession: async function() {
            try {
                let endpoint = '/api/session/start';
                let body = {};
                
                // If customer info is provided, use customer session endpoint
                if (this.config.customerEmail && this.config.enableCustomerProfile) {
                    endpoint = '/api/session/start-with-customer';
                    body = {
                        email: this.config.customerEmail,
                        name: this.config.customerName || '',
                        phone: this.config.customerPhone || ''
                    };
                }
                
                const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
                });
                const data = await response.json();
                this.sessionId = data.sessionId;
            } catch (error) {
                console.error('Error starting session:', error);
            }
        },

        endSession: async function() {
            if (!this.sessionId) return;
            
            try {
                await fetch(`${this.config.apiUrl}/api/session/end`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sessionId: this.sessionId })
                });
            } catch (error) {
                console.error('Error ending session:', error);
            }
        },

        createChatWidget: function() {
            // Create styles
            const style = document.createElement('style');
            style.textContent = `
                .ezhishi-chat-widget {
                    position: fixed;
                    ${this.config.position === 'bottom-right' ? 'right: 20px;' : 'left: 20px;'}
                    bottom: 20px;
                    z-index: 9999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .ezhishi-chat-button {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background-color: ${this.config.primaryColor};
                    color: white;
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.3s ease;
                }
                
                .ezhishi-chat-button:hover {
                    transform: scale(1.1);
                }
                
                .ezhishi-chat-button svg {
                    width: 30px;
                    height: 30px;
                }
                
                .ezhishi-chat-window {
                    position: absolute;
                    ${this.config.position === 'bottom-right' ? 'right: 0;' : 'left: 0;'}
                    bottom: 80px;
                    width: 350px;
                    height: 500px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 5px 30px rgba(0,0,0,0.2);
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                }
                
                .ezhishi-chat-header {
                    background-color: ${this.config.primaryColor};
                    color: white;
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .ezhishi-chat-title {
                    font-weight: 600;
                    font-size: 16px;
                }
                
                .ezhishi-header-buttons {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                
                .ezhishi-download-btn {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    opacity: 0.8;
                    transition: opacity 0.3s;
                    padding: 4px;
                }
                
                .ezhishi-download-btn:hover {
                    opacity: 1;
                }
                
                .ezhishi-download-btn svg {
                    width: 20px;
                    height: 20px;
                }
                
                .ezhishi-chat-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 24px;
                    line-height: 1;
                    opacity: 0.8;
                    transition: opacity 0.3s;
                }
                
                .ezhishi-chat-close:hover {
                    opacity: 1;
                }
                
                .ezhishi-chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    background-color: #f8f9fa;
                }
                
                .ezhishi-message {
                    margin-bottom: 15px;
                    animation: fadeIn 0.3s ease;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .ezhishi-message-bot {
                    background: white;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border-bottom-left-radius: 4px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    max-width: 85%;
                    white-space: pre-wrap;
                }
                
                .ezhishi-message-user {
                    background-color: ${this.config.primaryColor};
                    color: white;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border-bottom-right-radius: 4px;
                    margin-left: auto;
                    max-width: 85%;
                    word-wrap: break-word;
                }
                
                .ezhishi-message-time {
                    font-size: 11px;
                    color: #999;
                    margin-top: 4px;
                    text-align: right;
                }
                
                .ezhishi-chat-input-container {
                    padding: 15px;
                    background: white;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    gap: 10px;
                }
                
                .ezhishi-chat-input {
                    flex: 1;
                    border: 1px solid #ddd;
                    border-radius: 24px;
                    padding: 10px 16px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.3s;
                }
                
                .ezhishi-chat-input:focus {
                    border-color: ${this.config.primaryColor};
                }
                
                .ezhishi-chat-send {
                    background-color: ${this.config.primaryColor};
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: opacity 0.3s;
                }
                
                .ezhishi-chat-send:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .ezhishi-suggestions {
                    padding: 10px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .ezhishi-suggestion-btn {
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 16px;
                    padding: 6px 12px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .ezhishi-suggestion-btn:hover {
                    background-color: ${this.config.primaryColor};
                    color: white;
                    border-color: ${this.config.primaryColor};
                }
                
                .ezhishi-typing {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 12px 16px;
                    background: white;
                    border-radius: 12px;
                    border-bottom-left-radius: 4px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    max-width: 60px;
                }
                
                .ezhishi-typing-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #999;
                    animation: typing 1.4s infinite;
                }
                
                .ezhishi-typing-dot:nth-child(2) {
                    animation-delay: 0.2s;
                }
                
                .ezhishi-typing-dot:nth-child(3) {
                    animation-delay: 0.4s;
                }
                
                @keyframes typing {
                    0%, 60%, 100% {
                        transform: translateY(0);
                        opacity: 0.6;
                    }
                    30% {
                        transform: translateY(-10px);
                        opacity: 1;
                    }
                }
                
                .ezhishi-message-bot-initial {
                    display: block;
                    text-align: left;
                    width: 100%;
                    font-size: 1.1em;
                    margin: 0;
                    padding: 0;
                }
                
                @media (max-width: 480px) {
                    .ezhishi-chat-window {
                        width: 100vw;
                        height: 100vh;
                        bottom: 0;
                        ${this.config.position === 'bottom-right' ? 'right: 0;' : 'left: 0;'}
                        border-radius: 0;
                    }
                }
            `;
            document.head.appendChild(style);

            // Create chat widget HTML
            const widget = document.createElement('div');
            widget.className = 'ezhishi-chat-widget';
            widget.innerHTML = `
                <button class="ezhishi-chat-button" id="ezhishi-chat-toggle">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                </button>
                <div class="ezhishi-chat-window" id="ezhishi-chat-window">
                    <div class="ezhishi-chat-header">
                        <span class="ezhishi-chat-title">
                            ${this.config.title}
                        </span>
                        <div class="ezhishi-header-buttons">
                            <!-- Download button removed -->
                            <button class="ezhishi-chat-close" id="ezhishi-chat-close">&times;</button>
                        </div>
                    </div>
                    <div class="ezhishi-chat-messages" id="ezhishi-chat-messages">
                        <div class="ezhishi-message">
                            <div class="ezhishi-message-bot ezhishi-message-bot-initial">
                                👋 Hi! How can I help you today?
                            </div>
                            <div class="ezhishi-message-time">${new Date().toLocaleTimeString()}</div>
                        </div>
                        <div class="ezhishi-suggestions">
                            <button class="ezhishi-suggestion-btn" data-question="What is my eZhishi login ID and password?">Login help</button>
                            <button class="ezhishi-suggestion-btn" data-question="How to change the new password?">Reset password</button>
                            <button class="ezhishi-suggestion-btn" data-question="I have made payment, please activate my account">Account activation</button>
                            <button class="ezhishi-suggestion-btn" data-question="How to download Etutorlearning App?">Download app</button>
                        </div>
                    </div>
                    <div class="ezhishi-chat-input-container">
                        <input type="text" class="ezhishi-chat-input" id="ezhishi-chat-input" placeholder="Type your question...">
                        <button class="ezhishi-chat-send" id="ezhishi-chat-send">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(widget);

            // Add initial message to chat history
            this.chatHistory.push({
                type: 'bot',
                message: '👋 Hi! How can I help you today?',
                timestamp: new Date().toISOString()
            });

            // Find the chat header and insert the button after the title
            const header = widget.querySelector('.ezhishi-chat-header');
            const viewChatsBtn = document.createElement('button');
            viewChatsBtn.className = 'ezhishi-view-chats-btn';
            viewChatsBtn.textContent = 'View My Chats';
            viewChatsBtn.style.marginLeft = '10px';
            viewChatsBtn.style.background = 'white';
            viewChatsBtn.style.color = this.config.primaryColor;
            viewChatsBtn.style.border = '1px solid ' + this.config.primaryColor;
            viewChatsBtn.style.borderRadius = '6px';
            viewChatsBtn.style.padding = '4px 10px';
            viewChatsBtn.style.cursor = 'pointer';
            viewChatsBtn.style.fontSize = '13px';
            viewChatsBtn.addEventListener('click', () => {
                let url = '/customer-profile.html';
                if (this.config.customerEmail) {
                    url += '?email=' + encodeURIComponent(this.config.customerEmail);
                }
                window.open(url, '_blank');
            });
            header.appendChild(viewChatsBtn);
        },

        attachEventListeners: function() {
            const toggle = document.getElementById('ezhishi-chat-toggle');
            const close = document.getElementById('ezhishi-chat-close');
            const window = document.getElementById('ezhishi-chat-window');
            const input = document.getElementById('ezhishi-chat-input');
            const send = document.getElementById('ezhishi-chat-send');
            const messages = document.getElementById('ezhishi-chat-messages');
            // const download = document.getElementById('ezhishi-download-chat'); // Remove download button reference

            // Toggle chat window
            toggle.addEventListener('click', () => {
                window.style.display = window.style.display === 'flex' ? 'none' : 'flex';
                if (window.style.display === 'flex') {
                    input.focus();
                }
            });

            // Close chat window
            close.addEventListener('click', () => {
                window.style.display = 'none';
                this.endSession();
            });

            // Remove download event listener
            // download.addEventListener('click', () => {
            //     this.downloadChatHistory();
            // });

            // Send message
            const sendMessage = async () => {
                const message = input.value.trim();
                if (!message) return;

                // Add user message
                this.addMessage(message, 'user');
                input.value = '';
                send.disabled = true;

                // Show typing indicator
                const typingId = this.showTyping();

                try {
                    // Send to API with session ID
                    const response = await fetch(`${this.config.apiUrl}/api/search`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            query: message,
                            sessionId: this.sessionId 
                        })
                    });

                    const data = await response.json();
                    
                    // Remove typing indicator
                    this.hideTyping(typingId);

                    if (data.results && data.results.length > 0) {
                        // Show the best result
                        const bestMatch = data.results[0];
                        this.addMessage(bestMatch.answer, 'bot');

                        // If there are more relevant results, show them as suggestions
                        if (data.results.length > 1) {
                            const otherQuestions = data.results.slice(1, 4).map(r => r.questionEn);
                            this.addSuggestions(otherQuestions);
                        }
                    } else {
                        this.addMessage("I'm sorry, I couldn't find an answer to your question. Please try rephrasing or contact our support team directly.", 'bot');
                    }
                } catch (error) {
                    this.hideTyping(typingId);
                    this.addMessage("Sorry, I'm having trouble connecting. Please try again later.", 'bot');
                }

                send.disabled = false;
            };

            send.addEventListener('click', sendMessage);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });

            // Handle suggestion clicks
            messages.addEventListener('click', (e) => {
                if (e.target.classList.contains('ezhishi-suggestion-btn')) {
                    input.value = e.target.dataset.question;
                    sendMessage();
                }
            });

            // End session when page unloads
            window.addEventListener('beforeunload', () => {
                this.endSession();
            });
        },

        addMessage: function(text, type) {
            const messages = document.getElementById('ezhishi-chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'ezhishi-message';
            
            const messageContent = document.createElement('div');
            messageContent.className = `ezhishi-message-${type}`;
            messageContent.textContent = text;
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'ezhishi-message-time';
            timeDiv.textContent = new Date().toLocaleTimeString();
            
            messageDiv.appendChild(messageContent);
            messageDiv.appendChild(timeDiv);
            messages.appendChild(messageDiv);
            
            // Add to chat history
            this.chatHistory.push({
                type: type,
                message: text,
                timestamp: new Date().toISOString()
            });
            
            // Scroll to bottom
            messages.scrollTop = messages.scrollHeight;
        },

        addSuggestions: function(questions) {
            const messages = document.getElementById('ezhishi-chat-messages');
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.className = 'ezhishi-suggestions';
            
            const label = document.createElement('div');
            label.style.width = '100%';
            label.style.fontSize = '12px';
            label.style.color = '#666';
            label.style.marginBottom = '8px';
            label.textContent = 'Related keywords:';
            suggestionsDiv.appendChild(label);
            
            // Helper to extract keywords (first 2-3 significant words)
            function extractKeywords(question) {
                // Remove punctuation, split into words, filter out stopwords
                const stopwords = ['what', 'is', 'my', 'the', 'and', 'to', 'of', 'in', 'for', 'can', 'i', 'a', 'on', 'how', 'do', 'you', 'me', 'with', 'it', 'we', 'us', 'are', 'be', 'will', 'this', 'that', 'please', 'hi', 'help', 'does', 'have', 'has', 'was', 'at', 'as', 'or', 'if', 'so', 'but', 'by', 'an', 'from', 'not', 'our', 'your', 'his', 'her', 'their', 'they', 'he', 'she', 'who', 'which', 'when', 'where', 'why'];
                return question
                    .replace(/[^a-zA-Z0-9\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word && !stopwords.includes(word.toLowerCase()))
                    .slice(0, 3)
                    .join(' ');
            }
            
            questions.forEach(question => {
                const btn = document.createElement('button');
                btn.className = 'ezhishi-suggestion-btn';
                btn.dataset.question = question;
                btn.textContent = extractKeywords(question) || question.substring(0, 30) + '...';
                suggestionsDiv.appendChild(btn);
            });
            
            messages.appendChild(suggestionsDiv);
            messages.scrollTop = messages.scrollHeight;
        },

        showTyping: function() {
            const messages = document.getElementById('ezhishi-chat-messages');
            const typingDiv = document.createElement('div');
            typingDiv.className = 'ezhishi-message';
            typingDiv.id = 'typing-' + Date.now();
            
            typingDiv.innerHTML = `
                <div class="ezhishi-typing">
                    <div class="ezhishi-typing-dot"></div>
                    <div class="ezhishi-typing-dot"></div>
                    <div class="ezhishi-typing-dot"></div>
                </div>
            `;
            
            messages.appendChild(typingDiv);
            messages.scrollTop = messages.scrollHeight;
            
            return typingDiv.id;
        },

        hideTyping: function(typingId) {
            const typingDiv = document.getElementById(typingId);
            if (typingDiv) {
                typingDiv.remove();
            }
        },

        // Remove the downloadChatHistory function entirely
    };
})();