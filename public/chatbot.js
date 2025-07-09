(function() {
    'use strict';

    window.EZhishiChatbot = {
        init: function(config) {
            this.config = Object.assign({
                apiUrl: 'http://localhost:3000',
                position: 'bottom-right',
                primaryColor: '#007bff',
                title: 'eZhishi Support'
            }, config);

            this.createChatWidget();
            this.attachEventListeners();
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
                        <span class="ezhishi-chat-title">${this.config.title}</span>
                        <button class="ezhishi-chat-close" id="ezhishi-chat-close">&times;</button>
                    </div>
                    <div class="ezhishi-chat-messages" id="ezhishi-chat-messages">
                        <div class="ezhishi-message">
                            <div class="ezhishi-message-bot">
                                👋 Hi! How can I help you today?
                            </div>
                        </div>
                        <div class="ezhishi-suggestions">
                            <button class="ezhishi-suggestion-btn" data-question="How do I reset my password?">Reset password</button>
                            <button class="ezhishi-suggestion-btn" data-question="I need help with login">Login help</button>
                            <button class="ezhishi-suggestion-btn" data-question="How to activate my account?">Account activation</button>
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
        },

        attachEventListeners: function() {
            const toggle = document.getElementById('ezhishi-chat-toggle');
            const close = document.getElementById('ezhishi-chat-close');
            const window = document.getElementById('ezhishi-chat-window');
            const input = document.getElementById('ezhishi-chat-input');
            const send = document.getElementById('ezhishi-chat-send');
            const messages = document.getElementById('ezhishi-chat-messages');

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
            });

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
                    // Send to API
                    console.log('Sending request to:', `${this.config.apiUrl}/api/search`);
                    console.log('Query:', message);
                    
                    const response = await fetch(`${this.config.apiUrl}/api/search`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ query: message })
                    });

                    console.log('Response status:', response.status);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    console.log('API response:', data);
                    
                    // Remove typing indicator
                    this.hideTyping(typingId);

                    if (data.results && data.results.length > 0) {
                        // Show the best result
                        const bestMatch = data.results[0];
                        console.log('Best match:', bestMatch);
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
                    console.error('API Error:', error);
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
        },

        addMessage: function(text, type) {
            const messages = document.getElementById('ezhishi-chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'ezhishi-message';
            
            const messageContent = document.createElement('div');
            messageContent.className = `ezhishi-message-${type}`;
            messageContent.textContent = text;
            
            messageDiv.appendChild(messageContent);
            messages.appendChild(messageDiv);
            
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
            label.textContent = 'Related questions:';
            suggestionsDiv.appendChild(label);
            
            questions.forEach(question => {
                const btn = document.createElement('button');
                btn.className = 'ezhishi-suggestion-btn';
                btn.dataset.question = question;
                btn.textContent = question.length > 30 ? question.substring(0, 30) + '...' : question;
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
        }
    };
})();
