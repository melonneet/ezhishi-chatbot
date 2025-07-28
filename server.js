import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import SemanticSearch from './semantic-search.js';
import RelatedQuestionsGenerator from './related-questions.js';
import RelatedFAQ from './related-faq.js';
import MyClassificationPipeline from './MyClassificationPipeline.js';
import natural from 'natural';
import emailService from './email-service.js';
import Fuse from 'fuse.js';
import stringSimilarity from 'string-similarity';
import { franc } from 'franc';
import { findBestMatch } from './faq-search.js';
import db from './database.js';
import openRouterService from './openrouter-service.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let relatedFAQ = null; // Declare relatedFAQ variable

const app = express();
const DEFAULT_PORT = process.env.PORT || 3000;

// ---- CONTEXT STORE ----
// In-memory context store for session chat history (for prototype only)
const sessionContexts = {};

// Initialize semantic search and related questions generator
const semanticSearch = new SemanticSearch();
const relatedQuestionsGenerator = new RelatedQuestionsGenerator();

// Middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Load FAQ data
let faqs = [];
let keywordSet = new Set();

try {
  const data = fs.readFileSync(path.join(__dirname, 'data', 'faqs_updated_full.json'), 'utf8');
  faqs = JSON.parse(data);
  console.log(`Loaded ${faqs.length} FAQs successfully`);

  // Define general nouns to exclude from keyword generation
  const generalNounsToExclude = new Set([
    'child', 'children', 'kid', 'kids', 'boy', 'girl', 'student', 'students',
    'person', 'people', 'user', 'users', 'someone', 'anyone', 'everyone',
    'thing', 'things', 'stuff', 'item', 'items', 'object', 'objects',
    'place', 'places', 'location', 'locations', 'area', 'areas',
    'time', 'times', 'day', 'days', 'week', 'weeks', 'month', 'months',
    'year', 'years', 'hour', 'hours', 'minute', 'minutes',
    'way', 'ways', 'method', 'methods', 'process', 'processes',
    'part', 'parts', 'piece', 'pieces', 'section', 'sections',
    'group', 'groups', 'team', 'teams', 'family', 'families',
    'work', 'works', 'job', 'jobs', 'task', 'tasks',
    'problem', 'problems', 'issue', 'issues', 'matter', 'matters',
    'question', 'questions', 'answer', 'answers', 'reply', 'replies',
    'help', 'helps', 'support', 'supports', 'service', 'services',
    'information', 'info', 'data', 'content', 'text', 'message', 'messages',
    'system', 'systems', 'platform', 'platforms', 'website', 'websites',
    'page', 'pages', 'screen', 'screens', 'window', 'windows',
    'button', 'buttons', 'link', 'links', 'menu', 'menus',
    'form', 'forms', 'field', 'fields', 'box', 'boxes',
    'file', 'files', 'folder', 'folders', 'document', 'documents',
    'email', 'emails', 'phone', 'phones', 'number', 'numbers',
    'code', 'codes', 'password', 'passwords', 'account', 'accounts',
    'money', 'cash', 'payment', 'payments', 'price', 'prices',
    'cost', 'costs', 'fee', 'fees', 'charge', 'charges',
    'point', 'points', 'reward', 'rewards', 'bonus', 'bonuses',
    'video', 'videos', 'image', 'images', 'picture', 'pictures',
    'text', 'texts', 'word', 'words', 'letter', 'letters',
    'name', 'names', 'title', 'titles', 'subject', 'subjects',
    'topic', 'topics', 'category', 'categories', 'type', 'types',
    'kind', 'kinds', 'sort', 'sorts', 'level', 'levels',
    'size', 'sizes', 'amount', 'amounts', 'quantity', 'quantities',
    'number', 'numbers', 'count', 'counts', 'total', 'totals',
    'result', 'results', 'outcome', 'outcomes', 'effect', 'effects',
    'change', 'changes', 'update', 'updates', 'modify', 'modifies',
    'create', 'creates', 'make', 'makes', 'build', 'builds',
    'start', 'starts', 'begin', 'begins', 'stop', 'stops', 'end', 'ends',
    'open', 'opens', 'close', 'closes', 'save', 'saves', 'delete', 'deletes',
    'add', 'adds', 'remove', 'removes', 'edit', 'edits', 'change', 'changes',
    'get', 'gets', 'find', 'finds', 'search', 'searches', 'look', 'looks',
    'see', 'sees', 'view', 'views', 'show', 'shows', 'display', 'displays',
    'use', 'uses', 'try', 'tries', 'test', 'tests', 'check', 'checks',
    'know', 'knows', 'think', 'thinks', 'feel', 'feels', 'want', 'wants',
    'need', 'needs', 'like', 'likes', 'love', 'loves', 'hate', 'hates',
    'good', 'bad', 'better', 'worse', 'best', 'worst', 'great', 'terrible',
    'big', 'small', 'large', 'tiny', 'high', 'low', 'long', 'short',
    'new', 'old', 'young', 'fresh', 'recent', 'current', 'latest',
    'first', 'last', 'next', 'previous', 'before', 'after', 'during',
    'here', 'there', 'where', 'when', 'why', 'how', 'what', 'which',
    'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them',
    'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'his', 'she', 'her', 'hers',
    'we', 'our', 'ours', 'they', 'their', 'theirs', 'who', 'whom', 'whose'
  ]);

  // Build keyword set from FAQ data
  faqs.forEach(faq => {
    // Extract meaningful phrases from English questions
    if (faq.questionEn) {
      // Add specific phrases that should be prioritized
      const specificPhrases = [
        'program not activated',
        'cannot login',
        'forgot password',
        'technical support',
        'customer service',
        'human agent',
        'activation delay',
        'payment made',
        'points balance',
        'security question'
      ];
      
      specificPhrases.forEach(phrase => {
        if (faq.questionEn.toLowerCase().includes(phrase)) {
          keywordSet.add(phrase);
        }
      });
      
      // Then add individual words (lower priority), excluding general nouns
      faq.questionEn.split(/[^\w]+/).forEach(word => {
        const wordLower = word.toLowerCase();
        if (word && word.length > 1 && !generalNounsToExclude.has(wordLower)) {
          keywordSet.add(wordLower);
        }
      });
    }
    
    // Chinese keywords from questions
    if (faq.questionZh) {
      faq.questionZh.split('').forEach(char => {
        if (/^[\u4e00-\u9fa5]$/.test(char)) keywordSet.add(char);
      });
    }
    
    // Add category keywords
    if (faq.category) {
      faq.category.split(/[^\w\u4e00-\u9fa5]+/).forEach(word => {
        if (word && word.length > 1) keywordSet.add(word.toLowerCase());
      });
    }
  });

  console.log('Enhanced keyword set with related terms:', Array.from(keywordSet).slice(0, 20), '...');
  
  // Build spellcheck dictionary from FAQ terms
  function buildSpellcheckDictionary(faqs) {
    const allTerms = new Set();
    faqs.forEach(faq => {
      // Add terms from English questions
      const tokens = faq.questionEn.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      tokens.forEach(token => allTerms.add(token));
      
      // Add terms from answers
      const answerTokens = (faq.answerEn || '').toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      answerTokens.forEach(token => allTerms.add(token));
    });
    
    const spellcheck = new natural.Spellcheck([...allTerms]);
    console.log(`📚 Built spellcheck dictionary with ${allTerms.size} terms`);
    return spellcheck;
  }

  // Initialize spellcheck
  global.spellcheck = buildSpellcheckDictionary(faqs);
  
  // Initialize semantic search and related questions generator with FAQs
  (async () => {
    try {
      // Initialize the semantic model first
      const semanticModel = await MyClassificationPipeline.getInstance();
      
      // Set the model in semantic search
      semanticSearch.model = semanticModel;
      semanticSearch.initialized = true;
      
      await semanticSearch.loadFAQs(faqs);
      console.log('✅ Semantic search ready with stats:', semanticSearch.getStats());
      
      await relatedQuestionsGenerator.initialize();
      relatedQuestionsGenerator.loadFAQs(faqs);
      console.log('✅ Related questions generator ready with stats:', relatedQuestionsGenerator.getStats());

      relatedFAQ = new RelatedFAQ(faqs.map(f => f.questionEn), semanticModel.process.bind(semanticModel));
      console.log('✅ Related FAQ module ready');
    } catch (error) {
      console.error('⚠️ Initialization failed, using fallback:', error);
    }
  })();
  
} catch (error) {
  console.error('Error loading FAQ data:', error);
  console.error('Make sure data/faqs.json exists and contains valid JSON');
}

// Spell correction function - moved outside try-catch block for global access
function correctQuery(query, spellcheck) {
  // Common abbreviations and technical terms that should not be spell-corrected
  const commonAbbreviations = new Set([
    'pls', 'plz', 'thx', 'ty', 'u', 'ur', 'yr', 'r', 'n', 'bc', 'b4', 'gr8', 'l8r',
    'asap', 'fyi', 'btw', 'imo', 'tbh', 'idk', 'dont', 'cant', 'wont', 'isnt', 'arent',
    'havent', 'hasnt', 'didnt', 'doesnt', 'wasnt', 'werent', 'hadnt', 'wouldnt',
    'couldnt', 'shouldnt', 'acc', 'acct', 'act', 'actv', 'pay', 'paid', 'pmt',
    'sub', 'subs', 'pwd', 'pass', 'moe', 'syllabus', 'curriculum', 'ezhishi', 'chinese',
    'mandarin', 'cantonese', 'singapore', 'primary', 'secondary', 'school', 'education',
    'learning', 'teaching', 'student', 'teacher', 'parent', 'account', 'login', 'password',
    'username', 'email', 'mobile', 'app', 'website', 'online', 'digital', 'platform'
  ]);

  return query
    .split(/\b/)                     // split on word boundaries
    .map(token => {
      const lower = token.toLowerCase();
      // Skip spell correction for common abbreviations
      if (commonAbbreviations.has(lower)) {
        return token;
      }
      // only try to correct alphabetic tokens longer than 2 chars
      if (/^[a-z]{3,}$/.test(lower)) {
        if (!spellcheck.isCorrect(lower)) {
          const corrections = spellcheck.getCorrections(lower, 1);
          if (corrections.length > 0) {
            const best = corrections[0];
            console.log(`🔤 Spell correction: "${token}" → "${best}"`);
            return best;
          }
        }
      }
      return token;
    })
    .join("");
}

// Global function declarations to ensure they're available everywhere
global.correctQuery = correctQuery;

// Normalize helper: trim + lowercase
function normalize(text) {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

// 1. Language-specific normalizers
function normalizeEn(text) {
  // lowercase, trim, remove common English punctuation
  return text
    .trim()
    .toLowerCase()
    .replace(/[?!.,"']/g, '');
}

function normalizeZh(text) {
  // trim and remove Chinese & ASCII punctuation/whitespace
  return text
    .trim()
    .replace(/[\s?？!！。，""]/g, '');
}

// 2. Quick Chinese-char detector
function hasChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

// 3. Abbreviation expansion function
function expandAbbreviations(text) {
  // Common abbreviation mappings
  const abbreviations = {
    'pls': 'please',
    'plz': 'please',
    'thx': 'thanks',
    'ty': 'thank you',
    'u': 'you',
    'ur': 'your',
    'yr': 'your',
    'r': 'are',
    'n': 'and',
    '&': 'and',
    'w/': 'with',
    'w/o': 'without',
    'b/c': 'because',
    'bc': 'because',
    'b4': 'before',
    '2': 'to',
    '4': 'for',
    '8': 'ate',
    'gr8': 'great',
    'l8r': 'later',
    'asap': 'as soon as possible',
    'fyi': 'for your information',
    'btw': 'by the way',
    'imo': 'in my opinion',
    'tbh': 'to be honest',
    'idk': 'i do not know',
    'dont': 'do not',
    'cant': 'cannot',
    'wont': 'will not',
    'isnt': 'is not',
    'arent': 'are not',
    'havent': 'have not',
    'hasnt': 'has not',
    'didnt': 'did not',
    'doesnt': 'does not',
    'wasnt': 'was not',
    'werent': 'were not',
    'hadnt': 'had not',
    'wouldnt': 'would not',
    'couldnt': 'could not',
    'shouldnt': 'should not',
    'mightnt': 'might not',
    'mustnt': 'must not',
    'shant': 'shall not',
    'neednt': 'need not',
    'darent': 'dare not',
    'usednt': 'used not',
    // Payment and account related abbreviations
    'acc': 'account',
    'acct': 'account',
    'act': 'activate',
    'actv': 'activate',
    'pay': 'payment',
    'paid': 'payment',
    'pmt': 'payment',
    'sub': 'subscription',
    'subs': 'subscription',
    'login': 'login',
    'log': 'login',
    'pwd': 'password',
    'pass': 'password'
  };

  let expandedText = text;
  
  // Replace abbreviations with their full forms
  Object.entries(abbreviations).forEach(([abbr, full]) => {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    expandedText = expandedText.replace(regex, full);
  });

  return expandedText;
}

// 4. Special Chinese reset-password override
const CHINESE_PWD_RESET_ANSWER =
  "If you have forgotten your eZhishi password, you can reset it using the \"Get Password 忘记密码\" function on the login page—provided that you have previously set up your security questions and answers.\n\n" +
  "To reset your password:\n" +
  "1. Go to the login page at www. and click \"Get Password 忘记密码\".\n" +
  "2. Enter your correct Login ID.\n" +
  "3. Enter your full name (as per your account).\n" +
  "4. Answer the three security questions you had set previously. All answers must be correct.\n" +
  "5. Provide a valid email address.\n" +
  "6. If all answers are correct, the system will send your login password to the email address provided.\n\n" +
  "If you need further assistance, please contact our customer service team via WhatsApp at +65 9012 6012 or by email at service@ecombay.com.";

// 5. Fallback message
const OUT_OF_SCOPE =
  "The question you asked cannot be answered here. " +
  "Please WhatsApp +65 90126012 or email service@ecombay.com to contact our customer service team.";

// --- ENHANCED CONTEXT STORE ----
const contextWindow = 5; // Number of previous messages to consider

// Enhanced context structure to store more information
class ConversationContext {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.messages = [];
    this.topics = new Set();
    this.lastFAQ = null;
    this.lastCategory = null;
    this.entities = new Set(); // Store mentioned entities (login ID, password, etc.)
  }

  addMessage(query, response) {
    this.messages.push({ 
      query, 
      response, 
      timestamp: new Date(),
      topics: this.extractTopics(query),
      entities: this.extractEntities(query)
    });
    
    // Keep only recent messages
    if (this.messages.length > contextWindow) {
      this.messages = this.messages.slice(-contextWindow);
    }
    
    // Update topics and entities
    this.updateTopics();
    this.updateEntities();
  }

  extractTopics(text) {
    const topics = new Set();
    const topicKeywords = {
      password: ['password', 'pwd', 'passcode', 'reset', 'forgot', '密码', '忘记密码'],
      login: ['login', 'log in', 'signin', 'sign in', 'access', '登录', '登入'],
      account: ['account', 'profile', 'user', '账号', '账户'],
      activation: ['activate', 'activation', 'activated', '激活'],
      payment: ['payment', 'pay', 'paid', 'invoice', '付款', '支付'],
      delivery: ['delivery', 'shipping', 'order', 'track', '送货', '订单'],
      points: ['points', 'rewards', 'redeem', '积分', '奖励'],
      technical: ['error', 'problem', 'issue', 'technical', '错误', '问题']
    };
    
    const textLower = text.toLowerCase();
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(kw => textLower.includes(kw))) {
        topics.add(topic);
      }
    });
    
    return topics;
  }

  extractEntities(text) {
    const entities = new Set();
    // Extract potential login IDs (alphanumeric patterns)
    const loginIdPattern = /\b[A-Za-z0-9]{6,}\b/g;
    const matches = text.match(loginIdPattern);
    if (matches) {
      matches.forEach(match => entities.add(JSON.stringify({ type: 'login_id', value: match })));
    }
    // Extract email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailPattern);
    if (emails) {
      emails.forEach(email => entities.add(JSON.stringify({ type: 'email', value: email })));
    }
    // Extract phone numbers
    const phonePattern = /\b\d{8}\b|\+65\s?\d{8}\b/g;
    const phones = text.match(phonePattern);
    if (phones) {
      phones.forEach(phone => entities.add(JSON.stringify({ type: 'phone', value: phone })));
    }
    return entities;
  }

  updateTopics() {
    this.topics.clear();
    this.messages.forEach(msg => {
      msg.topics.forEach(topic => this.topics.add(topic));
    });
  }

  updateEntities() {
    this.entities.clear();
    this.messages.forEach(msg => {
      msg.entities.forEach(entity => this.entities.add(entity));
    });
  }

  getRecentContext() {
    return {
      recentQueries: this.messages.map(m => m.query).slice(-3),
      activeTopics: Array.from(this.topics),
      lastFAQ: this.lastFAQ,
      lastCategory: this.lastCategory,
      entities: Array.from(this.entities).map(e => JSON.parse(e))
    };
  }

  isRelatedQuery(currentQuery) {
    // Check if current query is related to recent context
    const currentTopics = this.extractTopics(currentQuery);
    // Check topic overlap
    const topicOverlap = Array.from(currentTopics).some(topic => 
      this.topics.has(topic)
    );
    // Check for pronouns indicating continuation
    const continuationWords = ['it', 'this', 'that', 'the same', '它', '这个', '那个', '同样'];
    const hasContinuation = continuationWords.some(word => 
      currentQuery.toLowerCase().includes(word)
    );
    // Check for follow-up patterns
    const followUpPatterns = [
      /^(and|also|but|however|additionally)/i,
      /^(what about|how about|and if)/i,
      /^(yes|no|okay|ok)/i,
      /还有/,
      /那么/,
      /另外/
    ];
    const isFollowUp = followUpPatterns.some(pattern => 
      pattern.test(currentQuery.trim())
    );
    return topicOverlap || hasContinuation || isFollowUp;
  }
}

// --- ENHANCED getFaqAnswer and helpers for synonym/variation support ---

const FALLBACK_MESSAGE = 'The question you asked cannot be answered here. Please WhatsApp +65 9012 6012 or email service@ecombay.com to contact our customer service team.';

const E_ZHISHI_KEYWORDS = [
  // eZhishi specific terms
  'login', 'password', 'account', 'reset', 'activate', 'assignment',
  'reward', 'video', 'subscription', 'name', 'technical', '无法登录',
  '忘记密码', '账号', '登录', '奖励', '作业', '视频', '激活',
  
  // General help terms
  'help', 'need', 'want', 'how', 'what', 'where', 'when', 'why', 
  'can', 'could', 'should', 'would', 'please', 'trying', 'tried',
  
  // Common problem phrases
  'cannot', 'can\'t', 'unable', 'problem', 'issue', 'error', 'fail',
  'not working', 'doesn\'t work', 'forgot', 'lost', 'missing',
  
  // eZhishi brand name variations
  'ezhishi', 'e-zhishi', 'e zhishi', '知识网', '知识', '网',
  
  // General question words
  'is', 'are', 'was', 'were', 'do', 'does', 'did', 'will', 'would',
  'tell', 'explain', 'describe', 'show', 'give', 'provide'
];

// ✅ Utility function to detect relevance
function shouldFallback(message) {
  const text = message.trim().toLowerCase();
  const wordCount = text.split(/\s+/).length;

  const hasEzhishiKeyword = E_ZHISHI_KEYWORDS.some(keyword =>
    text.includes(keyword.toLowerCase())
  );

  const isQuestionLike = /[?？]$/.test(text) || 
                        text.startsWith('how') || 
                        text.startsWith('what') || 
                        text.startsWith('when') ||
                        text.startsWith('where') ||
                        text.startsWith('why') ||
                        text.startsWith('can') ||
                        text.startsWith('could') ||
                        text.startsWith('would') ||
                        text.startsWith('should') ||
                        text.includes('吗') ||
                        text.includes('什么') ||
                        text.includes('怎么') ||
                        text.includes('如何');

  // Only fallback for very long, clearly unrelated messages (more than 20 words)
  if (wordCount > 20 && !hasEzhishiKeyword && !isQuestionLike) return true;

  // Only fallback for very short, non-question, non-keyword messages (1-2 words that aren't questions)
  if (wordCount <= 2 && !hasEzhishiKeyword && !isQuestionLike) return true;

  return false;
}

// ✅ Usage in Chatbot Handler
function handleUserMessage(userMessage) {
  if (shouldFallback(userMessage)) {
    return FALLBACK_MESSAGE;
  }

  // Proceed with normal intent / FAQ handling
  return getFaqResponse(userMessage);
}

async function getFaqAnswer(userInput) {
  const fallbackResponse = {
    faq: {
      questionEn: 'Unrelated Query',
      questionZh: '无关查询',
      answer: FALLBACK_MESSAGE,
      category: 'Customer Service'
    },
    score: 0.0,
    similarity: 0.0,
    matchType: 'fallback',
    isFallback: true
  };

  if (!userInput || !userInput.trim()) {
    return {
      faq: null,
      answer: 'Please enter a question.',
      score: 0.0,
      similarity: 0.0,
      matchType: 'error'
    };
  }

  // Use the enhanced shouldFallback function
  if (shouldFallback(userInput)) {
    console.log('🎯 Unrelated content detected (enhanced fallback)');
    return fallbackResponse;
  }

  const normalizedInput = userInput.trim().toLowerCase();

  // Small talk
  if (/(\b(thank|thanks|thank you|thx|tq)\b)/.test(normalizedInput) || /谢谢|多谢|感谢/.test(userInput)) {
    return {
      faq: null,
      answer: "You're welcome! Anything else I can help with?",
      matchType: 'small_talk'
    };
  }

  // Greeting detection
  if (/^(hello|hi|你好|您好|hey|哈喽|嗨)$/i.test(normalizedInput)) {
    return {
      faq: null,
      answer: 'Hello again! 😊 Just let me know what you need help with.',
      matchType: 'greeting'
    };
  }

  // Rule-based overrides
  const ruleBasedResult = ruleBasedAnswer(normalizedInput);
  if (ruleBasedResult) {
    console.log(`🔍 Rule-based result found: ${ruleBasedResult.faq?.questionEn || 'no question'}`);
    return ruleBasedResult;
  }
  console.log(`🔍 No rule-based result, continuing to FAQ matching`);

  // Use findBestMatch for alternate questions
  console.log(`🔍 Trying findBestMatch for: "${userInput}"`);
  const bestMatch = findBestMatch(userInput);
  if (bestMatch) {
    console.log(`🔍 findBestMatch returned: "${bestMatch.text}"`);
    const matchedFaq = faqs.find(f =>
      f.questionEn === bestMatch.text ||
      f.questionZh === bestMatch.text ||
      (f.alternateQuestionsEn && f.alternateQuestionsEn.includes(bestMatch.text)) ||
      (f.alternateQuestionsZh && f.alternateQuestionsZh.includes(bestMatch.text))
    );
    if (matchedFaq) {
      console.log(`🔍 Found FAQ match via findBestMatch: "${matchedFaq.questionEn}"`);
      return {
        faq: matchedFaq,
        score: 1,
        similarity: 1,
        matchType: 'faq_match'
      };
    } else {
      console.log(`🔍 findBestMatch found "${bestMatch.text}" but no matching FAQ in database`);
    }
  } else {
    console.log(`🔍 findBestMatch returned null`);
  }

  // Direct FAQ matching as fallback
  console.log(`🔍 Trying direct FAQ matching for: "${userInput}"`);
  const directMatch = faqs.find(f =>
    f.questionEn.toLowerCase() === userInput.toLowerCase() ||
    f.questionZh && f.questionZh.toLowerCase() === userInput.toLowerCase()
  );
  if (directMatch) {
    console.log(`🔍 Found direct FAQ match: "${directMatch.questionEn}"`);
    return {
      faq: directMatch,
      score: 1,
      similarity: 1,
      matchType: 'direct_match'
    };
  } else {
    console.log(`🔍 No direct FAQ match found`);
  }

  // Chinese-specific matching
  const hasChinese = /[\u4e00-\u9fa5]/.test(userInput);
  if (hasChinese) {
    const zhMatch = findChineseMatch(userInput, faqs);
    if (zhMatch) {
      return {
        faq: zhMatch,
        score: 1,
        similarity: 1,
        matchType: 'chinese_match'
      };
    }
  }

  // If no direct match found, try semantic search
  try {
    const semanticResult = await semanticSearchPipeline(userInput);
    if (semanticResult && semanticResult.score > 0.3) {
      return semanticResult;
    }
  } catch (error) {
    console.error('Semantic search failed:', error);
  }

  // Final fallback - fuzzy search
  const fuzzyResult = performFuzzyAndKeywordSearch(userInput, faqs);
  if (fuzzyResult && fuzzyResult.score > 0.2) {
    return fuzzyResult;
  }

  // If no match found, return fallback response
  return fallbackResponse;
}

async function semanticSearchPipeline(query) {
  try {
    if (semanticSearch && semanticSearch.initialized) {
      const queryVariations = [
        query,
        expandAbbreviations(query),
        global.spellcheck && global.correctQuery ? global.correctQuery(query, global.spellcheck) : query
      ];
      let bestResult = null;
      let bestScore = 0;
      for (const variation of queryVariations) {
        const results = await semanticSearch.semanticSearch(variation, 3);
        if (results.length > 0 && results[0].similarity > bestScore) {
          bestResult = results[0];
          bestScore = results[0].similarity;
        }
      }
      if (bestResult && bestScore > 0.3) {
        return {
          faq: bestResult.faq,
          score: bestScore,
          similarity: bestScore,
          matchType: 'semantic'
        };
      }
    }
  } catch (error) {
    console.error('Semantic search error:', error);
  }
  return null;
}

function findChineseMatch(userInput, faqs) {
  const normalizedInput = normalizeChineseText(userInput);
  
  for (const faq of faqs) {
    if (faq.questionZh) {
      const normalizedFaq = normalizeChineseText(faq.questionZh);
      
      // Direct match
      if (normalizedFaq.includes(normalizedInput) || normalizedInput.includes(normalizedFaq)) {
        return faq;
      }
      
      // Check alternate questions
      if (faq.alternateQuestionsZh) {
        for (const altQuestion of faq.alternateQuestionsZh) {
          const normalizedAlt = normalizeChineseText(altQuestion);
          if (normalizedAlt.includes(normalizedInput) || normalizedInput.includes(normalizedAlt)) {
            return faq;
          }
        }
      }
    }
  }
  
  return null;
}

function performFuzzyAndKeywordSearch(query, faqs) {
  const queryLower = query.toLowerCase().trim();
  const expandedQuery = expandAbbreviations(queryLower);
  
  // Check if this is a subject-related query
  const subjectWords = ['math', 'maths', 'science', 'english', 'physics', 'chemistry', 'biology', 
                        'history', 'geography', 'music', 'art', '数学', '科学', '英文', '物理', 
                        '化学', '生物', '历史', '地理', '音乐', '美术'];
  const containsSubject = subjectWords.some(subject => queryLower.includes(subject));
  
  // If query contains subject words, deprioritize practice/exercise FAQs
  if (containsSubject) {
    // Filter out or deprioritize FAQs about practice/exercises that aren't subject-specific
    const filteredFaqs = faqs.map(faq => {
      const faqLower = (faq.questionEn || '').toLowerCase();
      const isGenericPractice = (faqLower.includes('practice') || faqLower.includes('exercise')) && 
                                !faqLower.includes('chinese') && 
                                !subjectWords.some(s => faqLower.includes(s));
      return {
        ...faq,
        _deprioritized: isGenericPractice
      };
    });
    // Continue with normal fuzzy search but use filtered FAQs
    return performNormalFuzzySearch(expandedQuery, filteredFaqs, true);
  }
  // Normal fuzzy search for non-subject queries
  return performNormalFuzzySearch(expandedQuery, faqs, false);
}

function performNormalFuzzySearch(expandedQuery, faqs, hasSubjectContext) {
  // ... existing fuzzy search logic ...
  // But when calculating scores, apply penalty for deprioritized FAQs
  let bestMatch = null;
  let bestScore = 0;
  for (const faq of faqs) {
    let score = 0;
    const questionText = (faq.questionEn || '').toLowerCase();
    const answerText = (faq.answer || '').toLowerCase();
    const queryWords = expandedQuery.split(/\s+/).filter(w => w.length > 2);
    for (const queryWord of queryWords) {
      if (questionText.includes(queryWord)) {
        score += 2;
      }
      if (answerText.includes(queryWord)) {
        score += 0.5;
      }
    }
    // Apply penalty if FAQ is deprioritized and we have subject context
    if (hasSubjectContext && faq._deprioritized) {
      score *= 0.1; // Significant penalty for generic practice FAQs in subject context
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }
  if (bestMatch && bestScore > 0) {
    return { faq: bestMatch, score: bestScore, similarity: bestScore, matchType: 'fuzzy' };
  }
  return null;
}

// --- Replace /api/search endpoint ---
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query || query.trim() === '') {
    return res.json({ results: [] });
  }
  try {
    const result = await getFaqAnswer(query);
    if (result.matchType === 'small_talk') {
      return res.json({
        results: [{ answer: result.answer, matchType: 'small_talk' }],
        relatedQuestions: []
      });
    }
    let results = [];
    if (result && !result.isFallback) {
      results = [{ ...result.faq, score: result.score, similarity: result.similarity }];
      if (semanticSearch && semanticSearch.initialized) {
        const additionalResults = await semanticSearch.semanticSearch(query, 4);
        const filtered = additionalResults.filter(r =>
          r.faq.questionEn !== result.faq.questionEn && r.similarity > 0.3
        );
        results = results.concat(filtered.map(r => ({
          ...r.faq,
          score: r.similarity,
          similarity: r.similarity
        })));
      }
    } else {
      results = [{ ...result.faq, score: result.score, similarity: result.similarity, isFallback: true }];
    }
    let relatedQuestions = [];
    if (relatedFAQ && !result.isFallback) {
      relatedQuestions = await relatedFAQ.relatedQuestionKeywords(query, 3, 3);
    }
    res.json({ results, relatedQuestions });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// --- Enhanced /chat endpoint with AI integration ---
app.post('/chat', async (req, res) => {
  try {
    const userQ = req.body.message || '';
    const sessionId = req.body.sessionId || 'default';
    
    // Get FAQ answer first
    console.log(`🔍 Complex chat endpoint - calling getFaqAnswer for: "${userQ}"`);
    const result = await getFaqAnswer(userQ);
    console.log(`🔍 Complex chat endpoint - getFaqAnswer result:`, result ? {
      matchType: result.matchType,
      score: result.score,
      similarity: result.similarity,
      hasFaq: !!result.faq,
      faqQuestion: result.faq?.questionEn,
      hasAnswer: !!result.faq?.answer
    } : 'null');
    
    let response = {
      reply: '',
      enhanced: false,
      followUpQuestions: [],
      aiGenerated: false
    };

    // Simplified logic - disable AI integration temporarily
    console.log(`🔍 Processing result with matchType: ${result?.matchType}, score: ${result?.score}`);
    
    if (result && result.faq && result.faq.answer && result.matchType !== 'fallback') {
      console.log(`🔍 Using FAQ answer: "${result.faq.questionEn}"`);
      response.reply = result.faq.answer;
    } else if (result && result.answer && result.matchType !== 'fallback') {
      console.log(`🔍 Using direct answer`);
      response.reply = result.answer;
    } else {
      console.log(`🔍 No valid match found, using fallback`);
      response.reply = "The question you asked cannot be answered here. " +
                      "Please WhatsApp +65 90126012 or email service@ecombay.com to contact our customer service team.";
    }

    // Update session context
    if (!sessionContexts[sessionId]) {
      sessionContexts[sessionId] = new ConversationContext(sessionId);
    }
    sessionContexts[sessionId].addMessage(userQ, response.reply);

    return res.json(response);
    
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      reply: "I apologize, but I encountered an error. Please try again or contact our support team.",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Test endpoint for OpenRouter API
app.post('/test-ai', async (req, res) => {
  try {
    const { message, model } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('🤖 OpenRouter API Test Request:', {
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      model: model || openRouterService.model,
      timestamp: new Date().toISOString()
    });

    const startTime = Date.now();
    const completion = await openRouterService.createCompletion([
      {
        role: 'user',
        content: message
      }
    ], {
      model: model || openRouterService.model,
      temperature: 0.7,
      maxTokens: 500
    });
    const endTime = Date.now();

    console.log('✅ OpenRouter API Test Success:', {
      responseLength: completion.choices[0]?.message?.content?.length || 0,
      usage: completion.usage,
      responseTime: `${endTime - startTime}ms`,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      response: completion.choices[0]?.message?.content,
      usage: completion.usage,
      responseTime: endTime - startTime
    });
  } catch (error) {
    console.error('❌ OpenRouter API Test Error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      error: 'AI test failed',
      details: error.message
    });
  }
});

// Test function to verify Chinese matching works
function testChineseQueries() {
  console.log('\n🧪 Testing Chinese Queries:');
  const testQueries = [
    '我的密码是什么',
    '忘记密码了',
    '无法登录',
    '怎么激活账号',
    '查看积分',
    '手机上可以用吗',
    '联系客服',
    '我的账号是什么'
  ];
  testQueries.forEach(query => {
    const result = getFaqAnswer(query);
    console.log(`\nQuery: "${query}"`);
    console.log(`Match: ${result.matchType}`);
    if (!result.isFallback) {
      console.log(`FAQ: "${result.faq.questionEn}"`);
    }
  });
}
// Uncomment to test when server starts
// setTimeout(testChineseQueries, 1000);

// Also update the detectIntentByKeywords function to include login ID intent
function detectIntentByKeywords(normalizedInput) {
  const keywordSets = [
    {
      intentKey: 'login id',
      keywords: [
        'login id', 'user id', 'username', 'login name', 'what about id',
        'my id', 'find id', 'retrieve id', 'check id'
      ]
    },
    {
      intentKey: 'password reset',
      keywords: [
        'forgot', 'login', 'credentials', 'reset', 'password', 'recover', 
        'get back in', 'lost', 'remember', 'cant login', 'cannot login',
        'forgotten', 'forget', 'sign in', 'signin'
      ]
    },
    {
      intentKey: 'account activation',
      keywords: [
        'activate', 'activation', 'activated', 'not activated', 'account not activated',
        'account activation', 'activate account', 'account activated', 'pending',
        'waiting', 'approval', 'approved'
      ]
    },
    {
      intentKey: 'login problem',
      keywords: [
        'login', 'log in', 'signin', 'sign in', 'cannot login', 'cant login',
        'unable to login', 'login problem', 'tried many times', 'many times cannot',
        'login failed', 'login error', 'access denied'
      ]
    },
    {
      intentKey: 'email update',
      keywords: [
        'update', 'change', 'email', 'address', 'modify', 'edit'
      ]
    },
    {
      intentKey: 'app download',
      keywords: [
        'download', 'app', 'mobile', 'phone', 'tablet', 'ipad', 'android',
        'ios', 'install', 'application'
      ]
    }
  ];

  // Check login ID intent first (higher priority)
  const loginIdSet = keywordSets.find(set => set.intentKey === 'login id');
  if (loginIdSet) {
    const matchCount = loginIdSet.keywords.filter(kw => normalizedInput.includes(kw)).length;
    if (matchCount >= 1) {
      console.log(`🎯 Intent detected: "login id" with ${matchCount} keyword matches`);
      return 'login id';
    }
  }

  // Then check other intents
  for (const { intentKey, keywords } of keywordSets) {
    if (intentKey === 'login id') continue; // Already checked
    
    const matchCount = keywords.filter(kw => normalizedInput.includes(kw)).length;
    const threshold = intentKey === 'login problem' ? 1 : 2;
    if (matchCount >= threshold) {
      console.log(`🎯 Intent detected: "${intentKey}" with ${matchCount} keyword matches`);
      return intentKey;
    }
  }

  return null;
}


function correctText(text) {
  return text.split(/\b/).map(token => {
    if (/^[a-z]{3,}$/.test(token)) {
      if (!spellcheck.isCorrect(token)) {
        const [best] = spellcheck.getCorrections(token, 1);
        return best || token;
      }
    }
    return token;
  }).join('');
}

// 密码重置意图检测（支持拼写错误和变体）
function detectPasswordResetIntent(text) {
  const ni = text.toLowerCase();
  const passwordTerms = ["password", "pwd", "pass", "pasword"];
  const resetTerms = ["reset", "forgot", "change", "recover", "rpset"];
  const hasPassword = passwordTerms.some(term => ni.includes(term));
  const hasReset = resetTerms.some(term => ni.includes(term));
  return hasPassword && hasReset;
}

// Enhanced rule-based override function with better subject detection logic
function ruleBasedAnswer(query) {
  const rawQueryLower = query.toLowerCase().trim();
  const queryLower = normalizePunctuation(rawQueryLower);
  console.log(`🔍 Rule-based check for query: "${query}"`);
  
  // RULE 0: CHECK FOR UNRELATED CONTENT FIRST (HIGHEST PRIORITY)
  // This should be the VERY FIRST check to prevent other rules from matching news/unrelated content
  if (shouldFallback(query)) {
    console.log('🎯 Rule-based override: Unrelated content detected');
    return null; // Return null to indicate no rule match, let getFaqAnswer handle the fallback
  }
  
  // RULE 1: SUBJECT-RELATED QUERIES
  // Modified to be more specific and not match general content
  const subjectKeywords = {
    math: ['math', 'maths', 'mathematics', 'arithmetic', 'algebra', 'geometry', 'calculus', '数学'],
    science: ['science', 'physics', 'chemistry', 'biology', 'scientific', '科学', '物理', '化学', '生物'],
    english: ['english language', 'english subject', 'english course', 'english class', '英文', '英语'],
    other_languages: ['japanese', 'korean', 'spanish', 'french', 'german', 'italian', 'portuguese', 'russian', 
                      'arabic', 'hindi', 'thai', 'vietnamese', 'indonesian', 'malay', 'tamil',
                      '日语', '韩语', '西班牙语', '法语', '德语', '意大利语', '葡萄牙语', '俄语', 
                      '阿拉伯语', '印地语', '泰语', '越南语', '印尼语', '马来语'],
    other_subjects: ['history', 'geography', 'social studies', 'music', 'art', 'physical education', 'pe',
                     '历史', '地理', '社会', '音乐', '美术', '体育']
  };
  
  // More specific action words that indicate asking about eZhishi's content
  const ezhishiActionWords = [
    'ezhishi practice', 'ezhishi learn', 'ezhishi study', 'ezhishi teach', 
    'ezhishi offer', 'ezhishi provide', 'ezhishi include', 'ezhishi support', 
    'ezhishi cover', 'ezhishi contain', 'ezhishi help',
    'does ezhishi', 'can ezhishi', 'will ezhishi', 'is ezhishi',
    'on ezhishi', 'in ezhishi', 'with ezhishi', 'using ezhishi'
  ];
  
  // Check if query is asking about non-Chinese subjects ON EZHISHI
  let isAskingAboutSubjectOnEzhishi = false;
  let detectedSubject = null;
  
  // Must mention ezhishi or be clearly about the platform
  const mentionsEzhishi = /\bezhishi\b|e-zhishi|知识网/i.test(queryLower);
  
  if (mentionsEzhishi) {
    // Check each subject category
    for (const [subject, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        // Check if there's also an action word indicating they're asking about availability
        if (ezhishiActionWords.some(action => queryLower.includes(action))) {
          isAskingAboutSubjectOnEzhishi = true;
          detectedSubject = subject;
          break;
        }
      }
    }
  }
  
  // If asking about any non-Chinese subject on eZhishi, return the language content FAQ
  if (isAskingAboutSubjectOnEzhishi && detectedSubject !== null) {
    console.log(`🎯 Rule-based override: Subject query detected - ${detectedSubject}`);
    return {
      faq: {
        questionEn: 'eZhishi content scope',
        answerEn: 'eZhishi primarily focuses on Chinese language education. While the platform\'s interface and instructions may be available in English for accessibility, the core content remains centred on Chinese language learning.',
        answer: 'eZhishi primarily focuses on Chinese language education. While the platform\'s interface and instructions may be available in English for accessibility, the core content remains centred on Chinese language learning.'
      },
      score: 1.0,
      similarity: 1.0,
      isRuleOverride: true,
      detectedSubject: detectedSubject
    };
  }
  
  // Additional patterns for subject queries - must be specifically about eZhishi
  if (mentionsEzhishi && (
    // Specific patterns that indicate asking about non-Chinese subjects
    (/\b(besides|apart from|other than|except|excluding)\b.*\bchinese\b/i.test(queryLower)) ||
    (/\bchinese\b.*\b(only|just|exclusively)\b/i.test(queryLower)) ||
    (/\b(only|just|exclusively)\b.*\bchinese\b/i.test(queryLower)) ||
    (/(subjects?|courses?|content|lessons?|modules?|topics?).*available/i.test(queryLower) && 
     !queryLower.includes('chinese')) ||
    (/what (subjects?|courses?|languages?) (can|do|does)/i.test(queryLower)) ||
    (/support.*other.*subjects?/i.test(queryLower)) ||
    (/bilingual/i.test(queryLower) && /(content|lessons?|courses?|exercises?)/i.test(queryLower))
  )) {
    console.log('🎯 Rule-based override: General subject availability query');
    return {
      faq: {
        questionEn: 'eZhishi content scope',
        answerEn: 'eZhishi primarily focuses on Chinese language education. While the platform\'s interface and instructions may be available in English for accessibility, the core content remains centred on Chinese language learning.',
        answer: 'eZhishi primarily focuses on Chinese language education. While the platform\'s interface and instructions may be available in English for accessibility, the core content remains centred on Chinese language learning.'
      },
      score: 1.0,
      similarity: 1.0,
      isRuleOverride: true
    };
  }

  // ... rest of the rules remain unchanged ...

}

// ---- TOPIC CHANGE HELPER ----
function detectTopicChange(prevQuery, currentQuery) {
  const topics = {
    password: ['password', 'pwd', 'passcode', 'reset', 'forgot', '密码', '忘记密码'],
    login: ['login', 'log in', 'signin', 'sign in', 'access', '登录', '登入'],
    loginId: ['login id', 'user id', 'username', 'login name', 'id', '登录账号', '用户账号'],
    activation: ['activate', 'activation', 'activated', '激活', '激活账号'],
    refund: ['refund', 'money back', 'cancel', '退款', '取消'],
    delivery: ['delivery', 'shipping', 'order', 'track', '送货', '订单'],
    points: ['points', 'rewards', 'redeem', '积分', '奖励'],
    app: ['app', 'download', 'mobile', 'install', '应用', '下载']
  };
  let prevTopics = [];
  let currTopics = [];
  Object.entries(topics).forEach(([topic, keywords]) => {
    if (keywords.some(kw => prevQuery.toLowerCase().includes(kw))) {
      prevTopics.push(topic);
    }
    if (keywords.some(kw => currentQuery.toLowerCase().includes(kw))) {
      currTopics.push(topic);
    }
  });
  // If current query has different topics, it's a topic change
  return currTopics.length > 0 && 
         prevTopics.length > 0 && 
         !currTopics.some(t => prevTopics.includes(t));
}

// Search endpoint
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  
  console.log('🔍 Search query received:', query);
  
  if (!query || query.trim() === '') {
    console.log('Empty query, returning empty results');
    return res.json({ results: [] });
  }

  // Exact-match shortcut for specific Chinese question
  if (query === '我使用了"忘记密码"功能，但没有收到邮件，该怎么办？') {
    const faq = faqs.find(f => f.questionZh === query);
    if (faq) {
      const override = { 
        faq,
        score: 1,
        similarity: 1
      };
      console.log('⚙️ Exact-match override for "didn\'t receive email"');
      return res.json({ results: [override] });
    }
  }

  try {
    // 1) Check for rule-based override first
    const ruleOverride = ruleBasedAnswer(query);
    console.log(`🔍 Rule override check for: "${query}" - Result:`, ruleOverride ? 'MATCH' : 'NO MATCH');
    if (ruleOverride) {
      const results = [{
        ...ruleOverride.faq,
        score: ruleOverride.score,
        similarity: ruleOverride.similarity
      }];
      
      // Get related questions
      let relatedQuestions = [];
      if (relatedFAQ) {
        relatedQuestions = await relatedFAQ.relatedQuestionKeywords(query, 3, 3);
      }
      
      console.log(`🎯 Rule-based result for query: "${query}"`);
      console.log(`🎯 Rule-based answer: "${ruleOverride.faq.answer || ruleOverride.faq.answerEn}"`);
      return res.json({ results, relatedQuestions });
    }
    
    // 2) Spell-correct the query
    const correctedQuery = global.spellcheck && global.correctQuery ? global.correctQuery(query, global.spellcheck) : query;
    if (correctedQuery !== query) {
      console.log(`🔤 Spell-corrected query: "${query}" → "${correctedQuery}"`);
    }
    
    // 3) Check for exact matches using enhanced case-insensitive lookup
    console.log(`🔍 Calling getFaqAnswer for query: "${query}"`);
    let exactMatch = await getFaqAnswer(query);
    console.log(`🔍 getFaqAnswer result:`, exactMatch ? { matchType: exactMatch.matchType, question: exactMatch.faq && exactMatch.faq.questionEn, answer: exactMatch.faq && exactMatch.faq.answer } : 'no match');
    if (exactMatch && exactMatch.matchType === 'small_talk') {
      return res.json({
        results: [{
          answer: exactMatch.answer,
          matchType: 'small_talk'
        }],
        relatedQuestions: []
      });
    }
    if (!exactMatch && correctedQuery !== query) {
      console.log(`🔍 Calling getFaqAnswer for corrected query: "${correctedQuery}"`);
      exactMatch = await getFaqAnswer(correctedQuery);
      console.log(`🔍 getFaqAnswer corrected result:`, exactMatch ? `matchType: ${exactMatch.matchType}` : 'no match');
      if (exactMatch && exactMatch.matchType === 'small_talk') {
        return res.json({
          results: [{
            answer: exactMatch.answer,
            matchType: 'small_talk'
          }],
          relatedQuestions: []
        });
      }
    }
    
    // Debug logging for login queries
    if (query.toLowerCase().includes('login')) {
      console.log('Debug - Query:', JSON.stringify(normalize(query)));
      console.log('Debug - Corrected Query:', JSON.stringify(normalize(correctedQuery)));
      console.log('Debug - Exact Match Found:', !!exactMatch);
      if (exactMatch) {
        console.log('Debug - Match Type:', exactMatch.matchType);
        console.log('Debug - Matched Question:', exactMatch.faq.questionEn);
      }
    }
    
    let searchResults;
    if (exactMatch) {
      // Check if it's a fallback response
      if (exactMatch.isFallback) {
        console.log(`❌ Unrelated query detected: "${query}"`);
        return res.json({ 
          results: [{ 
            faq: exactMatch.faq, 
            score: exactMatch.score, 
            similarity: exactMatch.similarity,
            matchType: exactMatch.matchType,
            isFallback: true
          }], 
          relatedQuestions: [] 
        });
      }
      
      // Check if it's a special case (highest priority)
      if (exactMatch.matchType === 'special_case') {
        console.log(`🎯 Special case match found: "${exactMatch.specialCase}"`);
        return res.json({ 
          results: [{ 
            faq: exactMatch.faq, 
            score: exactMatch.score, 
            similarity: exactMatch.similarity,
            matchType: exactMatch.matchType,
            specialCase: exactMatch.specialCase
          }], 
          relatedQuestions: [] 
        });
      }
      
      // If exact match found, prioritize it
      searchResults = [{
        faq: exactMatch.faq,
        score: exactMatch.score,
        similarity: exactMatch.similarity
      }];
      
      // Add additional semantic results (excluding the exact match)
      const additionalResults = await semanticSearch.semanticSearch(correctedQuery, 4);
      const filteredResults = additionalResults.filter(result => 
        result.faq.questionEn !== exactMatch.faq.questionEn
      );
      searchResults = searchResults.concat(filteredResults);
      
      console.log(`✅ Exact match found (${exactMatch.matchType}) for query: "${query}"`);
    } else {
      // Use semantic search if available, otherwise fallback to keyword search
      searchResults = await semanticSearch.semanticSearch(correctedQuery, 5);
      console.log(`🔍 No exact match found, using semantic search for query: "${query}"`);
      
      // Check if semantic search results are relevant (score > 0.5)
      const relevantResults = searchResults.filter(result => result.similarity > 0.5);
      if (relevantResults.length === 0) {
        console.log(`❌ No relevant semantic results found for query: "${query}"`);
        const fallbackMatch = await getFaqAnswer(query);
        return res.json({ 
          results: [{ 
            faq: fallbackMatch.faq, 
            score: fallbackMatch.score, 
            similarity: fallbackMatch.similarity,
            matchType: fallbackMatch.matchType,
            isFallback: true
          }], 
          relatedQuestions: [] 
        });
      }
    }
    
    const results = searchResults.map(result => ({
      ...result.faq,
      score: result.score,
      similarity: result.similarity
    }));

    console.log(`Found ${results.length} results for query: "${query}"`);
    if (results.length > 0) {
      console.log('Top result:', {
        question: results[0].questionEn,
        score: results[0].score,
        similarity: results[0].similarity
      });
    }

    // Related questions
    let relatedQuestions = [];
    if (relatedFAQ) {
      relatedQuestions = await relatedFAQ.relatedQuestionKeywords(query, 3, 3);
      
      // Special case: If query is about login problems, ensure "We tried many times cannot login" is included
      const loginKeywords = ['login', 'log in', 'signin', 'sign in', 'cannot login', 'cant login', 'unable to login', 'login problem', 'tried many times', 'many times cannot'];
      const isLoginQuery = loginKeywords.some(keyword => query.toLowerCase().includes(keyword));
      
      if (isLoginQuery) {
        const loginQuestion = "We tried many times cannot login";
        const hasLoginQuestion = relatedQuestions.some(q => q.question === loginQuestion);
        
        if (!hasLoginQuestion) {
          // Find the login question in FAQs and add it
          const loginFAQ = faqs.find(faq => faq.questionEn === loginQuestion);
          if (loginFAQ) {
            relatedQuestions.unshift({
              question: loginQuestion,
              similarity: "0.950",
              keywords: ["login", "password", "tried"]
            });
            // Keep only top 3
            relatedQuestions = relatedQuestions.slice(0, 3);
          }
        }
      }
      
      // Special case: If query is about activation problems, ensure "Why hasn't my account been activated yet?" is included
      const activationKeywords = ['activate', 'activation', 'activated', 'not activated', 'account not activated', 'account activation', 'activate account', 'account activated'];
      const isActivationQuery = activationKeywords.some(keyword => query.toLowerCase().includes(keyword));
      
      if (isActivationQuery) {
        const activationQuestion = "Why hasn't my account been activated yet?";
        const hasActivationQuestion = relatedQuestions.some(q => q.question === activationQuestion);
        
        if (!hasActivationQuestion) {
          // Find the activation question in FAQs and add it
          const activationFAQ = faqs.find(faq => faq.questionEn === activationQuestion);
          if (activationFAQ) {
            relatedQuestions.unshift({
              question: activationQuestion,
              similarity: "0.950",
              keywords: ["account", "activated", "activation"]
            });
            // Keep only top 3
            relatedQuestions = relatedQuestions.slice(0, 3);
          }
        }
      }
    }

    res.json({ results, relatedQuestions });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ---- REFINED CONTEXT-AWARE /apiChat/search ENDPOINT ----
app.post('/apiChat/search', async (req, res) => {
  const { query, sessionId } = req.body;
  
  console.log('API Chat search query received:', query);
  
  if (!query || query.trim() === '') {
    console.log('Empty query, returning empty results');
    return res.json({ results: [] });
  }

  // ---- CONTEXT LOGIC WITH TOPIC CHANGE ----
  const sid = sessionId || 'default';
  if (!sessionContexts[sid]) sessionContexts[sid] = [];
  let useContext = true;
  let contextualQuery = query;
  if (sessionContexts[sid].length > 0) {
    const prevQuery = sessionContexts[sid][sessionContexts[sid].length - 1];
    if (detectTopicChange(prevQuery, query)) {
      useContext = false;
      console.log('🔍 Topic change detected by helper - treating as new query');
    } else {
      contextualQuery = prevQuery + ' ' + query;
    }
  }
  // Update context store
  sessionContexts[sid].push(query);
  if (sessionContexts[sid].length > 5) sessionContexts[sid] = sessionContexts[sid].slice(-5);

  try {
    // 1) Check for rule-based override
    // Always check the individual query first for rule-based overrides
    let ruleOverride = ruleBasedAnswer(query);
    if (ruleOverride) {
      const results = [{
        ...ruleOverride.faq,
        score: ruleOverride.score,
        similarity: ruleOverride.similarity
      }];
      let relatedQuestions = [];
      if (relatedFAQ) {
        relatedQuestions = await relatedFAQ.relatedQuestionKeywords(query, 3, 3);
      }
      console.log(`🎯 Rule-based result for API Chat query: "${query}"`);
      return res.json({ results, relatedQuestions });
    }
    
    // 2) Try exact FAQ matching first (without spell correction)
    let exactMatch = await getFaqAnswer(query);
    if (exactMatch && !exactMatch.isFallback) {
      const results = [{
        faq: exactMatch.faq,
        score: exactMatch.score,
        similarity: exactMatch.similarity
      }];
      let relatedQuestions = [];
      if (relatedFAQ) {
        relatedQuestions = await relatedFAQ.relatedQuestionKeywords(query, 3, 3);
      }
      console.log(`✅ Exact FAQ match found for: "${query}"`);
      return res.json({ results, relatedQuestions });
    }
    
    // 3) Try semantic search
    console.log(`🔍 Using semantic search for query: "${query}"`);
    let searchResults = await semanticSearch.semanticSearch(query, 5);
    
    // 4) If semantic search returns good results, use them
    if (searchResults.length > 0 && searchResults[0].similarity > 0.5) {
      let relatedQuestions = [];
      if (relatedFAQ) {
        relatedQuestions = await relatedFAQ.relatedQuestionKeywords(query, 3, 3);
      }
      console.log(`✅ Good semantic matches found for: "${query}"`);
      return res.json({ results: searchResults, relatedQuestions });
    }
    
    // 5) If no good matches, use AI-powered understanding
    console.log(`🤖 No good matches found, using AI-powered understanding for: "${query}"`);
    try {
      const aiResponse = await getAIEnhancedResponse(query);
      if (aiResponse) {
        console.log(`✅ AI provided enhanced response for: "${query}"`);
        return res.json({
          results: [{
            questionEn: "AI Enhanced Response",
            questionZh: "AI增强回答",
            answer: aiResponse,
            score: 0.8,
            similarity: 0.8,
            isAIEnhanced: true
          }],
          relatedQuestions: []
        });
      }
    } catch (aiError) {
      console.log(`❌ AI enhancement failed: ${aiError.message}`);
    }
    
    // 6) Fallback to customer service
    console.log(`❌ No relevant results found for: "${query}"`);
    return res.json({
      results: [{
        questionEn: "Unrelated Query",
        questionZh: "无关查询",
        answer: "The question you asked cannot be answered here. Please WhatsApp +65 9012 6012 or email service@ecombay.com to contact our customer service team.",
        category: "Customer Service",
        score: 0,
        similarity: 0,
        isFallback: true
      }],
      relatedQuestions: []
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Add a new chat endpoint using the new matcher
app.post('/chat', async (req, res) => {
  const userQ = req.body.message || '';
  console.log('🔍 Chat endpoint received:', userQ);
  
  // Exact-match shortcut for specific Chinese question
  if (userQ === '我使用了"忘记密码"功能，但没有收到邮件，该怎么办？') {
    const faq = faqs.find(f => f.questionZh === userQ);
    if (faq) {
      console.log('⚙️ Exact-match override for "didn\'t receive email" (chat endpoint)');
      return res.json({ reply: faq.answer });
    }
  }
  
  const result = await getFaqAnswer(userQ);
  console.log('🔍 getFaqAnswer result (chat):', result ? { matchType: result.matchType, question: result.faq && result.faq.questionEn, answer: result.faq && result.faq.answer } : 'no match');
  
  // Check if we have a valid FAQ match
  if (result && result.faq && result.faq.answer && result.matchType !== 'fallback') {
    return res.json({ reply: result.faq.answer });
  }
  
  // Check if it's a special response (like small talk or greeting)
  if (result && result.answer && result.matchType !== 'fallback') {
    return res.json({ reply: result.answer });
  }
  
  return res.json({
    reply: FALLBACK_MESSAGE
  });
});

// Get all categories
app.get('/api/categories', (req, res) => {
  const categories = [...new Set(faqs.map(faq => faq.category))];
  res.json({ categories });
});

// Get all FAQs
app.get('/api/faqs', (req, res) => {
  res.json({ faqs: faqs });
});

// Get FAQs by category
app.get('/api/faqs/:category', (req, res) => {
  const { category } = req.params;
  const categoryFaqs = faqs.filter(faq => faq.category === category);
  res.json({ faqs: categoryFaqs });
});

// Get chat sessions (for admin)
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await db.getAllSessions(100, 0);
    res.json({ 
      sessions: sessions,
      totalSessions: sessions.length,
      recentSessions: sessions.filter(s => {
        const sessionDate = new Date(s.started_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return sessionDate > weekAgo;
      }).length
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get single session details with messages
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get session info
    const sessions = await db.getAllSessions();
    const session = sessions.find(s => s.session_id === sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get chat messages for this session
    const messages = await db.getChatHistory(sessionId);
    
    // Format messages for frontend
    const formattedMessages = messages.map(msg => ({
      role: msg.message_type === 'user' ? 'user' : 'bot',
      text: msg.message,
      createdAt: msg.timestamp
    }));
    
    const sessionDetail = {
      id: session.session_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      totalMessages: session.total_messages,
      customerEmail: session.customer_email,
      customerName: session.customer_name,
      userIp: session.user_ip,
      userAgent: session.user_agent,
      messages: formattedMessages
    };
    
    res.json(sessionDetail);
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({ error: 'Failed to fetch session details' });
  }
});

// Get analytics (for admin)
app.get('/api/analytics', async (req, res) => {
  try {
    const analytics = await db.getQuestionAnalytics();
    res.json({ 
      analytics: analytics,
      totalQuestions: analytics.length,
      topQuestion: analytics.length > 0 ? analytics[0].question : 'N/A'
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get dashboard data (for admin)
app.get('/api/dashboard', async (req, res) => {
  try {
    const sessions = await db.getAllSessions(100, 0);
    const analytics = await db.getQuestionAnalytics();
    
    // Calculate recent sessions (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentSessions = sessions.filter(s => new Date(s.started_at) > weekAgo).length;
    
    // Get FAQ statistics
    const categories = [...new Set(faqs.map(faq => faq.category))];
    const categoryStats = categories.map(category => ({
      category: category,
      count: faqs.filter(faq => faq.category === category).length
    }));
    
    res.json({
      totalFAQs: faqs.length,
      totalCategories: categories.length,
      totalSessions: sessions.length,
      totalQuestions: analytics.length,
      recentSessions: recentSessions,
      topQuestion: analytics.length > 0 ? analytics[0].question : 'N/A',
      categoryStats: categoryStats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Test endpoint to verify FAQs are loaded
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok',
    faqCount: faqs.length,
    categories: [...new Set(faqs.map(faq => faq.category))],
    message: 'Server is running and FAQs are loaded',
    timestamp: new Date().toISOString(),
    origin: req.get('origin') || 'unknown'
  });
});

// API Chat test endpoint
app.get('/apiChat/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'apiChat test endpoint is working',
    time: new Date().toISOString()
  });
});

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'eZhishi Chatbot API is running',
    timestamp: new Date().toISOString()
  });
});

// Semantic search status endpoint
app.get('/api/semantic-status', (req, res) => {
  const stats = semanticSearch.getStats();
  res.json({
    semanticSearch: stats,
    faqCount: faqs.length,
    keywordCount: keywordSet.size
  });
});

// Debug endpoint to test search with query parameter
app.get('/api/debug-search', (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.json({ error: 'Please provide a query parameter "q"' });
  }
  
  // Simulate the search logic
  const query = q;
  console.log('Debug search query:', query);
  
  const queryLower = query.toLowerCase().trim();
  
  // Enhanced keyword mapping
  const keywordMap = {
    'login': ['login', 'log in', 'signin', 'sign in', 'access', 'cannot login', 'cant login', 'unable to login', 'login problem'],
    'password': ['password', 'pwd', 'passcode', 'forgot password', 'reset password', 'recover password', 'change password', 'new password', 'password expired'],
    'activate': ['activate', 'activation', 'active', 'activating', 'activated', 'not activated'],
    'refund': ['refund', 'money back', 'cancel', 'return', 'get money back'],
    'delivery': ['delivery', 'shipping', 'mail', 'address', 'receive', 'parcel', 'order', 'when will i receive', 'track order'],
    'submit': ['submit', 'submission', 'contribute', 'article', 'essay', 'composition', 'send article'],
    'pen': ['pen', 'learning pen', 'reading pen', 'etutorstar', 'et-901', 'pointing pen', 'scanning pen'],
    'subscribe': ['subscribe', 'subscription', 'renew', 'cancel subscription', 'magazine subscription'],
    'points': ['points', 'rewards', 'reward points', 'redeem', 'earn points', 'check points'],
    'app': ['app', 'application', 'etutorlearning', 'mobile', 'download', 'install app'],
    'account': ['account', 'profile', 'my account', 'account settings'],
    'help': ['help', 'support', 'assistance', 'problem', 'issue', 'trouble'],
    'contact': ['contact', 'email', 'phone', 'call', 'reach', 'get in touch']
  };
  
  let keywordBoost = {};
  Object.entries(keywordMap).forEach(([category, keywords]) => {
    const matchedKeywords = keywords.filter(kw => queryLower.includes(kw));
    if (matchedKeywords.length > 0) {
      keywordBoost[category] = Math.min(0.4, matchedKeywords.length * 0.1);
    }
  });

  const scoredFaqs = faqs.map(faq => {
    const englishScore = calculateSimilarity(query, faq.questionEn);
    const chineseScore = calculateSimilarity(query, faq.questionZh || '');
    const categoryScore = calculateSimilarity(query, faq.category) * 0.4;
    const answerScore = calculateSimilarity(query, faq.answerEn || '') * 0.15;
    
    let boost = 0;
    Object.entries(keywordBoost).forEach(([category, boostValue]) => {
      const questionLower = faq.questionEn.toLowerCase();
      const answerLower = (faq.answerEn || '').toLowerCase();
      const categoryLower = faq.category.toLowerCase();
      
      if (questionLower.includes(category) || 
          answerLower.includes(category) ||
          categoryLower.includes(category)) {
        boost += boostValue;
      }
    });
    
    const totalScore = Math.max(englishScore, chineseScore) + categoryScore + answerScore + boost;
    
    return {
      questionEn: faq.questionEn,
      category: faq.category,
      score: totalScore,
      debug: {
        englishScore,
        chineseScore,
        categoryScore,
        answerScore,
        boost,
        totalScore
      }
    };
  });

  const results = scoredFaqs
    .filter(faq => faq.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  res.json({
    query: query,
    keywordBoost: keywordBoost,
    results: results
  });
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    if (!emailService.isConfigured()) {
      return res.status(500).json({ error: 'Email service not configured' });
    }
    
    await emailService.sendContactFormEmail(name, email, subject, message);
    res.json({ success: true, message: 'Contact form submitted successfully' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to send contact form' });
  }
});

// Email service status endpoint
app.get('/api/email-status', (req, res) => {
  res.json({
    configured: emailService.isConfigured(),
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER ? 'configured' : 'not configured'
  });
});

// Function to try different ports if the default is in use
function tryListen(port) {
  app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
  }).on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} in use, trying ${port + 1}...`);
      tryListen(port + 1);
    } else {
      console.error('❌ Server error:', err);
      throw err;
    }
  });
}

tryListen(DEFAULT_PORT);

// Place these helpers near the top of the file, outside ruleBasedAnswer
function getActivationFAQ(faqs) {
  const signals = [
    "i have made payment, please activate my account",
    "why is the activation taking so long",
    "when will my account be activated",
    "account activation",
  ];
  const lowerSignals = signals.map(s => s.toLowerCase());
  return faqs.find(f => {
    const q = (f.questionEn || '').toLowerCase();
    return lowerSignals.some(sig => q.includes(sig));
  });
}

function normalizePunctuation(str) {
  return str
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\u2014/g, '-') // em dash
    .replace(/\u2013/g, '-'); // en dash
}



// 1. Add this helper near the top of the file
function normalizeChineseText(text) {
  return text
    .replace(/[""]/g, '"')  // Normalize quotes
    .replace(/['']/g, "'")   // Normalize apostrophes
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim()
    .toLowerCase();
}

// Wrapper function for handleChat to use existing getFaqAnswer logic
async function getFaqResponse(message) {
  const result = await getFaqAnswer(message);
  if (result && result.faq && result.faq.answer) {
    return result.faq.answer;
  }
  return FALLBACK_MESSAGE;
}

// AI Enhanced Response Function
async function getAIEnhancedResponse(userQuery) {
  try {
    // Create context from available FAQs
    const contextFAQs = faqs.slice(0, 10).map(faq => 
      `Q: ${faq.questionEn}\nA: ${faq.answer}`
    ).join('\n\n');
    
    const messages = [
      {
        role: 'system',
        content: `You are a helpful customer service assistant for eZhishi, an educational platform for Chinese language learning. 
        
Based on the following FAQ context, provide a helpful and accurate answer to the user's question. If the question is related to eZhishi but not directly covered in the FAQs, provide a general but helpful response based on your knowledge of educational platforms.

FAQ Context:
${contextFAQs}

Guidelines:
- Be helpful and friendly
- If the question is about eZhishi features, curriculum, or usage, provide relevant information
- If the question is not related to eZhishi, politely redirect to customer service
- Keep responses concise but informative
- Use the same tone and style as the FAQ answers`
      },
      {
        role: 'user',
        content: userQuery
      }
    ];

    const completion = await openRouterService.createCompletion(messages, {
      temperature: 0.7,
      maxTokens: 300
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('AI enhancement error:', error);
    return null;
  }
}

