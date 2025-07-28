import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

class OpenRouterService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.model = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324:free'; // Use env var or default to free DeepSeek model
  }

  async createCompletion(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/yourusername/ezhishi-chatbot', // Replace with your URL
          'X-Title': 'eZhishi Chatbot'
        },
        body: JSON.stringify({
          model: options.model || this.model,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000,
          top_p: options.topP || 1,
          frequency_penalty: options.frequencyPenalty || 0,
          presence_penalty: options.presencePenalty || 0
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('OpenRouter API request failed:', error);
      throw error;
    }
  }

  async enhanceFaqResponse(userQuestion, originalAnswer, relatedFaqs = []) {
    const messages = [
      {
        role: 'system',
        content: `You are a helpful customer service assistant for eZhishi, an educational platform. 
        Your task is to enhance FAQ responses to be more helpful and conversational while maintaining accuracy.
        Keep responses concise but friendly. Use the original answer as the base and add helpful context if needed.`
      },
      {
        role: 'user',
        content: `User Question: ${userQuestion}\n\nOriginal Answer: ${originalAnswer}\n\nPlease provide an enhanced, more conversational version of this answer.`
      }
    ];

    try {
      const completion = await this.createCompletion(messages, {
        temperature: 0.7,
        maxTokens: 500
      });

      return completion.choices[0]?.message?.content || originalAnswer;
    } catch (error) {
      console.error('Failed to enhance FAQ response:', error);
      return originalAnswer; // Fallback to original
    }
  }

  async generateFollowUpQuestions(userQuestion, answer) {
    const messages = [
      {
        role: 'system',
        content: `Generate 2-3 relevant follow-up questions that a user might have after receiving this answer. 
        Questions should be short, clear, and directly related to the topic.`
      },
      {
        role: 'user',
        content: `User Question: ${userQuestion}\n\nAnswer Given: ${answer}\n\nGenerate follow-up questions:`
      }
    ];

    try {
      const completion = await this.createCompletion(messages, {
        temperature: 0.8,
        maxTokens: 200
      });

      const content = completion.choices[0]?.message?.content || '';
      // Parse the response to extract questions
      const questions = content
        .split('\n')
        .filter(line => line.trim())
        .filter(line => line.match(/^\d+\.|^-|^•/) || line.includes('?'))
        .map(line => line.replace(/^\d+\.|^-|^•/, '').trim())
        .filter(q => q.length > 0)
        .slice(0, 3);

      return questions;
    } catch (error) {
      console.error('Failed to generate follow-up questions:', error);
      return [];
    }
  }

  async generateResponse(userQuestion, context, faqs = []) {
    // Build context from FAQs
    let faqContext = '';
    if (faqs.length > 0) {
      faqContext = '\n\nRelevant FAQs for reference:\n';
      faqs.forEach((faq, index) => {
        faqContext += `${index + 1}. Q: ${faq.questionEn}\n   A: ${faq.answer}\n`;
      });
    }

    const messages = [
      {
        role: 'system',
        content: `You are a helpful customer service assistant for eZhishi, an educational platform focused on Chinese language learning. 
        Answer questions accurately and helpfully. If you don't have specific information, suggest contacting customer service at WhatsApp +65 9012 6012 or email service@ecombay.com.
        ${faqContext}`
      }
    ];

    // Add context if available
    if (context) {
      messages.push({
        role: 'assistant',
        content: `Previous context: ${context}`
      });
    }

    messages.push({
      role: 'user',
      content: userQuestion
    });

    try {
      const completion = await this.createCompletion(messages, {
        temperature: 0.7,
        maxTokens: 800
      });

      return completion.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('Failed to generate response:', error);
      return null;
    }
  }

  // Check if the service is configured
  isConfigured() {
    return !!this.apiKey;
  }

  // Get available models (optional)
  async getModels() {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      throw error;
    }
  }
}

export { OpenRouterService };
export default new OpenRouterService(); 