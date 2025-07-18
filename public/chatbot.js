(function() {
    'use strict';

    window.EZhishiChatbot = {
        sessionId: null,
        chatHistory: [],
        
        init: function(config) {
            this.config = Object.assign({
                apiUrl: window.location.origin + (window.location.pathname.split('/').slice(0, -1).join('/') || ''),
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
                let endpoint = '/apiChat/session/start';
                let body = {};
                
                // If customer info is provided, use customer session endpoint
                if (this.config.customerEmail && this.config.enableCustomerProfile) {
                    endpoint = '/apiChat/session/start-with-customer';
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
                await fetch(`${this.config.apiUrl}/apiChat/session/end`, {
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
                    align-items: flex-start;
                }
                
                .ezhishi-header-content {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .ezhishi-header-title {
                    font-weight: 600;
                    font-size: 16px;
                    line-height: 1.2;
                }
                
                .ezhishi-header-subtitle {
                    font-size: 12px;
                    opacity: 0.9;
                    cursor: pointer;
                    text-decoration: underline;
                }
                
                .ezhishi-header-subtitle:hover {
                    opacity: 1;
                }
                
                .ezhishi-header-right {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 2px;
                }
                
                .ezhishi-header-subtitle {
                    font-size: 11px;
                    opacity: 0.9;
                    cursor: pointer;
                    text-decoration: underline;
                    margin: 0;
                    line-height: 1;
                }
                
                .ezhishi-header-subtitle:hover {
                    opacity: 1;
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
                    padding: 0;
                    margin: 0;
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
                    white-space: normal;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
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
                .ezhishi-related-questions {
                  margin: 10px 0 0 0;
                  padding: 8px 0 0 0;
                  border-top: 1px solid #e0e0e0;
                }
                .ezhishi-related-btn {
                  display: block;
                  background: #f1f8ff;
                  color: #007bff;
                  border: none;
                  border-radius: 4px;
                  margin: 4px 0;
                  padding: 6px 10px;
                  cursor: pointer;
                  text-align: left;
                  width: 100%;
                  font-size: 13px;
                  transition: background 0.2s;
                }
                .ezhishi-related-btn:hover {
                  background: #e3f2fd;
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
                        <div class="ezhishi-header-content">
                            <div class="ezhishi-header-title">eZhishi Digital Assistant</div>
                        </div>
                        <div class="ezhishi-header-right">
                            <button class="ezhishi-chat-close" id="ezhishi-chat-close">&times;</button>
                            <div class="ezhishi-header-subtitle">View My Chats</div>
                        </div>
                    </div>
                    <div class="ezhishi-chat-messages" id="ezhishi-chat-messages">
                        <div class="ezhishi-message">
                            <div class="ezhishi-message-bot ezhishi-message-bot-initial">
                                👋 Hi! How can I help you today?
                            </div>
                            <div class="ezhishi-message-time">${new Date().toLocaleTimeString()}</div>
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

            // Add click functionality to "View My Chats" subtitle
            const subtitle = widget.querySelector('.ezhishi-header-subtitle');
            subtitle.addEventListener('click', () => {
                let url = '/customer-profile.html';
                if (this.config.customerEmail) {
                    url += '?email=' + encodeURIComponent(this.config.customerEmail);
                }
                window.open(url, '_blank');
            });
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
                    const response = await fetch(`${this.config.apiUrl}/apiChat/search`, {
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
                        // Show related questions if available
                        if (data.relatedQuestions && data.relatedQuestions.length > 0) {
                            this.showRelatedQuestions(data.relatedQuestions);
                        }
                    } else {
                        this.addMessage("The question you asked cannot be answered here. Please WhatsApp +65 90126012 or email service@ecombay.com to contact our customer service team.", 'bot');
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

        // Add showRelatedQuestions method
        showRelatedQuestions: function(relatedQuestions) {
            const messages = document.getElementById('ezhishi-chat-messages');
            const container = document.createElement('div');
            container.className = 'ezhishi-related-questions';
            container.innerHTML = '<div style="font-size:13px;margin:8px 0 4px 0;color:#007bff;">Related questions:</div>' +
                relatedQuestions.map((q, i) =>
                    `<button class="ezhishi-related-btn" data-q="${encodeURIComponent(q.question)}">• ${q.question}</button>`
                ).join('');
            messages.appendChild(container);
            // Add click listeners
            Array.from(container.getElementsByClassName('ezhishi-related-btn')).forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const question = decodeURIComponent(btn.getAttribute('data-q'));
                    document.getElementById('ezhishi-chat-input').value = question;
                    document.getElementById('ezhishi-chat-send').click();
                });
            });
            messages.scrollTop = messages.scrollHeight;
        },

        // Remove the downloadChatHistory function entirely
    };
})();