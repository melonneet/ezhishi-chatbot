// context-manager.js - Enhanced context management for the chatbot

class ContextManager {
  constructor(windowSize = 5) {
    this.sessions = new Map();
    this.windowSize = windowSize;
    this.topicHierarchy = this.buildTopicHierarchy();
  }

  buildTopicHierarchy() {
    // Define relationships between topics for better context understanding
    return {
      account: {
        parent: null,
        children: ['login', 'password', 'activation', 'profile'],
        related: ['subscription', 'payment']
      },
      login: {
        parent: 'account',
        children: ['login_id', 'login_process', 'login_issues'],
        related: ['password', 'access']
      },
      password: {
        parent: 'account',
        children: ['password_reset', 'password_change', 'security_questions'],
        related: ['login', 'security']
      },
      activation: {
        parent: 'account',
        children: ['payment_activation', 'delay_issues'],
        related: ['payment', 'subscription']
      },
      learning: {
        parent: null,
        children: ['subjects', 'exercises', 'content'],
        related: ['curriculum', 'practice']
      },
      subjects: {
        parent: 'learning',
        children: ['chinese', 'math', 'science', 'other_subjects'],
        related: ['curriculum', 'content']
      },
      technical: {
        parent: null,
        children: ['errors', 'browser_issues', 'app_issues'],
        related: ['support', 'help']
      },
      rewards: {
        parent: null,
        children: ['points', 'redemption', 'delivery'],
        related: ['buddy', 'motivation']
      }
    };
  }

  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new SessionContext(sessionId, this.windowSize));
    }
    return this.sessions.get(sessionId);
  }

  analyzeQuery(query, sessionId) {
    const session = this.getSession(sessionId);
    const analysis = {
      topics: this.extractTopics(query),
      entities: this.extractEntities(query),
      intent: this.detectIntent(query, session),
      isFollowUp: this.isFollowUp(query, session),
      referenceType: this.detectReference(query),
      sentiment: this.analyzeSentiment(query)
    };
    
    return analysis;
  }

  extractTopics(text) {
    const topics = new Set();
    const topicPatterns = {
      login: /\b(login|log\s*in|sign\s*in|access|enter|登录|登入)\b/i,
      password: /\b(password|pwd|passcode|pin|secret|密码|口令)\b/i,
      account: /\b(account|profile|user|subscription|账号|账户|用户)\b/i,
      activation: /\b(activat|enabl|start|open|激活|开通|启用)\b/i,
      payment: /\b(pay|paid|payment|invoice|fee|cost|付款|支付|费用)\b/i,
      subjects: /\b(subject|course|math|science|english|chinese|科目|课程|数学|科学)\b/i,
      technical: /\b(error|problem|issue|bug|crash|fail|错误|问题|故障)\b/i,
      rewards: /\b(reward|point|redeem|gift|prize|积分|奖励|礼物)\b/i,
      delivery: /\b(deliver|ship|send|receive|mail|送货|发货|收到)\b/i,
      help: /\b(help|support|assist|contact|service|帮助|支持|客服)\b/i
    };
    
    const textLower = text.toLowerCase();
    Object.entries(topicPatterns).forEach(([topic, pattern]) => {
      if (pattern.test(textLower)) {
        topics.add(topic);
        // Add parent topics from hierarchy
        const parent = this.topicHierarchy[topic]?.parent;
        if (parent) topics.add(parent);
      }
    });
    
    return Array.from(topics);
  }

  extractEntities(text) {
    const entities = [];
    
    // Login ID patterns
    const loginIdPattern = /\b[A-Za-z0-9]{6,20}\b/g;
    const loginIds = text.match(loginIdPattern);
    if (loginIds) {
      loginIds.forEach(id => {
        if (!this.isCommonWord(id)) {
          entities.push({ type: 'login_id', value: id });
        }
      });
    }
    
    // Email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailPattern);
    if (emails) {
      emails.forEach(email => {
        entities.push({ type: 'email', value: email });
      });
    }
    
    // Phone numbers
    const phonePattern = /(?:\+65\s?)?[689]\d{7}\b/g;
    const phones = text.match(phonePattern);
    if (phones) {
      phones.forEach(phone => {
        entities.push({ type: 'phone', value: phone });
      });
    }
    
    // Dates and times
    const datePattern = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}\b/gi;
    const dates = text.match(datePattern);
    if (dates) {
      dates.forEach(date => {
        entities.push({ type: 'date', value: date });
      });
    }
    
    // Duration mentions
    const durationPattern = /\b\d+\s*(days?|hours?|minutes?|weeks?|months?)\b/gi;
    const durations = text.match(durationPattern);
    if (durations) {
      durations.forEach(duration => {
        entities.push({ type: 'duration', value: duration });
      });
    }
    
    return entities;
  }

  detectIntent(query, session) {
    const queryLower = query.toLowerCase();
    const context = session.getRecentContext();
    
    // Question types
    if (/^(what|who|when|where|why|how|which|什么|谁|何时|哪里|为什么|怎么|哪个)/i.test(query.trim())) {
      if (queryLower.includes('how') && (queryLower.includes('do') || queryLower.includes('can'))) {
        return 'how_to';
      }
      if (queryLower.includes('what') && queryLower.includes('is')) {
        return 'definition';
      }
      if (queryLower.includes('when') || queryLower.includes('how long')) {
        return 'timing';
      }
      if (queryLower.includes('where')) {
        return 'location';
      }
      if (queryLower.includes('why')) {
        return 'reason';
      }
      return 'question';
    }
    
    // Statement types
    if (/^(i|my|we|our|the|it|this|that)/i.test(query.trim())) {
      if (queryLower.includes("can't") || queryLower.includes("cannot") || queryLower.includes("unable")) {
        return 'problem_statement';
      }
      if (queryLower.includes('need') || queryLower.includes('want')) {
        return 'request';
      }
      return 'statement';
    }
    
    // Follow-up intents based on context
    if (context.lastIntent === 'problem_statement' && this.isFollowUp(query, session)) {
      return 'solution_request';
    }
    
    return 'general';
  }

  isFollowUp(query, session) {
    const queryLower = query.toLowerCase().trim();
    const context = session.getRecentContext();
    
    // Check for explicit follow-up patterns
    const followUpPatterns = [
      /^(yes|no|okay|ok|sure|alright)/i,
      /^(and|also|but|however|additionally|furthermore)/i,
      /^(what about|how about|and if|what if)/i,
      /^(can you|could you|would you|please)/i,
      /^(that'?s? |it'?s? |this is )/i,
      /还有|那么|另外|而且|但是/
    ];
    
    if (followUpPatterns.some(pattern => pattern.test(queryLower))) {
      return true;
    }
    
    // Check for pronouns without clear antecedents
    const pronouns = ['it', 'this', 'that', 'they', 'them', 'those', 'these'];
    const hasUnresolvedPronoun = pronouns.some(pronoun => {
      const regex = new RegExp(`\\b${pronoun}\\b`, 'i');
      return regex.test(queryLower) && !this.hasClearAntecedent(queryLower, pronoun);
    });
    
    if (hasUnresolvedPronoun) {
      return true;
    }
    
    // Check for short queries that likely depend on context
    if (query.split(/\s+/).length <= 4 && context.messages.length > 0) {
      // Check topic continuity
      const currentTopics = this.extractTopics(query);
      const recentTopics = context.activeTopics;
      const hasTopicOverlap = currentTopics.some(topic => recentTopics.includes(topic));
      
      if (hasTopicOverlap) {
        return true;
      }
    }
    
    return false;
  }

  detectReference(query) {
    const queryLower = query.toLowerCase();
    
    if (/\b(it|this|that)\b/.test(queryLower)) {
      if (/how (do|can|should) (i|we) (do|use|access|get) (it|this|that)/i.test(queryLower)) {
        return 'action_reference';
      }
      if (/what (is|are|does|do) (it|this|that|they)/i.test(queryLower)) {
        return 'definition_reference';
      }
      if (/where (is|are|can) (i|we) (find|get|see) (it|this|that)/i.test(queryLower)) {
        return 'location_reference';
      }
      return 'pronoun_reference';
    }
    
    if (/\b(the same|same thing|same issue|same problem)\b/i.test(queryLower)) {
      return 'same_reference';
    }
    
    if (/\b(above|previous|earlier|before)\b/i.test(queryLower)) {
      return 'previous_reference';
    }
    
    return null;
  }

  analyzeSentiment(query) {
    const queryLower = query.toLowerCase();
    
    // Negative indicators
    const negativePatterns = [
      /\b(can'?t|cannot|unable|fail|error|problem|issue|trouble|difficult|hard)\b/i,
      /\b(frustrated|annoyed|angry|upset|disappointed|confused)\b/i,
      /\b(not work|doesn'?t work|broken|stuck)\b/i,
      /不能|无法|失败|错误|问题|困难/
    ];
    
    // Positive indicators
    const positivePatterns = [
      /\b(thank|thanks|great|good|excellent|perfect|helpful|solved)\b/i,
      /\b(working|works|success|successful)\b/i,
      /谢谢|感谢|很好|解决了/
    ];
    
    // Urgency indicators
    const urgencyPatterns = [
      /\b(urgent|asap|immediately|now|quickly|hurry)\b/i,
      /\b(been waiting|still waiting|how long|when will)\b/i,
      /紧急|马上|立即|赶紧/
    ];
    
    const sentiment = {
      negative: negativePatterns.some(p => p.test(queryLower)),
      positive: positivePatterns.some(p => p.test(queryLower)),
      urgent: urgencyPatterns.some(p => p.test(queryLower)),
      neutral: true
    };
    
    if (sentiment.negative || sentiment.positive || sentiment.urgent) {
      sentiment.neutral = false;
    }
    
    return sentiment;
  }

  hasClearAntecedent(text, pronoun) {
    // Simple heuristic: check if there's a noun before the pronoun
    const beforePronoun = text.substring(0, text.toLowerCase().indexOf(pronoun));
    const nouns = /\b(ezhishi|account|password|login|subscription|reward|point)\b/i;
    return nouns.test(beforePronoun);
  }

  isCommonWord(word) {
    const commonWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'have', 'her', 'was',
      'one', 'our', 'out', 'his', 'has', 'had', 'how', 'can', 'when', 'make'
    ]);
    return commonWords.has(word.toLowerCase());
  }

  resolveReferences(query, session) {
    const context = session.getRecentContext();
    const referenceType = this.detectReference(query);
    
    if (!referenceType || context.messages.length === 0) {
      return query;
    }
    
    let resolvedQuery = query;
    
    switch (referenceType) {
      case 'pronoun_reference':
        // Replace pronouns with last mentioned entity
        if (context.lastTopic) {
          resolvedQuery = query.replace(/\b(it|this|that)\b/gi, context.lastTopic);
        }
        break;
        
      case 'same_reference':
        // Add context from previous query
        if (context.messages.length > 0) {
          const lastQuery = context.messages[context.messages.length - 1].query;
          resolvedQuery = `${query} (referring to: ${lastQuery})`;
        }
        break;
        
      case 'action_reference':
        // Add action context
        if (context.lastFAQ) {
          resolvedQuery = query.replace(/\b(it|this|that)\b/gi, `"${context.lastFAQ}"`);
        }
        break;
    }
    
    console.log(`🔄 Reference resolution: "${query}" → "${resolvedQuery}"`);
    return resolvedQuery;
  }

  suggestNextQuestions(session, currentFAQ) {
    const context = session.getRecentContext();
    const suggestions = [];
    
    // Based on topic hierarchy
    if (currentFAQ && currentFAQ.category) {
      const currentTopic = this.extractTopics(currentFAQ.questionEn)[0];
      const relatedTopics = this.topicHierarchy[currentTopic]?.children || [];
      
      relatedTopics.forEach(topic => {
        suggestions.push({
          topic,
          question: this.generateQuestionForTopic(topic, context)
        });
      });
    }
    
    // Based on conversation flow
    if (context.lastIntent === 'problem_statement') {
      suggestions.push({
        topic: 'solution',
        question: 'How can I fix this issue?'
      });
    }
    
    // Based on incomplete information
    if (context.entities.length === 0 && context.activeTopics.includes('login')) {
      suggestions.push({
        topic: 'login_id',
        question: 'Where can I find my login ID?'
      });
    }
    
    return suggestions.slice(0, 3);
  }

  generateQuestionForTopic(topic, context) {
    const questionTemplates = {
      password_reset: 'How do I reset my password?',
      security_questions: 'What if I forgot my security questions?',
      login_process: 'What are the steps to log in?',
      activation_delay: 'Why is my account not activated yet?',
      payment_status: 'How can I check my payment status?',
      chinese: 'What Chinese learning resources are available?',
      math: 'Does eZhishi offer math content?',
      points: 'How do I earn reward points?',
      redemption: 'How can I redeem my points?'
    };
    
    return questionTemplates[topic] || `Tell me more about ${topic}`;
  }

  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  getSessionStats() {
    const stats = {
      activeSessions: this.sessions.size,
      totalMessages: 0,
      averageMessagesPerSession: 0
    };
    
    this.sessions.forEach(session => {
      stats.totalMessages += session.messages.length;
    });
    
    if (stats.activeSessions > 0) {
      stats.averageMessagesPerSession = stats.totalMessages / stats.activeSessions;
    }
    
    return stats;
  }
}

// Session Context class
class SessionContext {
  constructor(sessionId, windowSize = 5) {
    this.sessionId = sessionId;
    this.windowSize = windowSize;
    this.messages = [];
    this.entities = new Map();
    this.topics = new Set();
    this.lastFAQ = null;
    this.lastCategory = null;
    this.lastIntent = null;
    this.lastTopic = null;
  }

  addMessage(query, response, analysis) {
    const message = {
      query,
      response,
      timestamp: new Date(),
      analysis
    };
    
    this.messages.push(message);
    
    // Maintain window size
    if (this.messages.length > this.windowSize) {
      this.messages = this.messages.slice(-this.windowSize);
    }
    
    // Update context
    this.updateContext(analysis);
    
    // Update FAQ tracking
    if (response && response.faq) {
      this.lastFAQ = response.faq.questionEn;
      this.lastCategory = response.faq.category;
    }
  }

  updateContext(analysis) {
    // Update topics
    if (analysis.topics) {
      analysis.topics.forEach(topic => {
        this.topics.add(topic);
        this.lastTopic = topic;
      });
    }
    
    // Update entities
    if (analysis.entities) {
      analysis.entities.forEach(entity => {
        this.entities.set(entity.type, entity.value);
      });
    }
    
    // Update intent
    if (analysis.intent) {
      this.lastIntent = analysis.intent;
    }
    
    // Maintain topic freshness (remove old topics)
    if (this.topics.size > 10) {
      const topicsArray = Array.from(this.topics);
      this.topics = new Set(topicsArray.slice(-10));
    }
  }

  getRecentContext() {
    return {
      messages: this.messages.slice(-3),
      activeTopics: Array.from(this.topics),
      entities: Object.fromEntries(this.entities),
      lastFAQ: this.lastFAQ,
      lastCategory: this.lastCategory,
      lastIntent: this.lastIntent,
      lastTopic: this.lastTopic
    };
  }

  hasRecentTopic(topic) {
    return this.topics.has(topic);
  }

  getEntity(type) {
    return this.entities.get(type);
  }

  clear() {
    this.messages = [];
    this.entities.clear();
    this.topics.clear();
    this.lastFAQ = null;
    this.lastCategory = null;
    this.lastIntent = null;
    this.lastTopic = null;
  }
}

module.exports = { ContextManager, SessionContext }; 