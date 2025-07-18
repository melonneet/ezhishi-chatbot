const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const SemanticSearch = require('./semantic-search');
const RelatedQuestionsGenerator = require('./related-questions');
const RelatedFAQ = require('./related-faq');
const { pipeline } = require('@xenova/transformers');
const natural = require('natural');
const emailService = require('./email-service');

const app = express();
const PORT = process.env.PORT || 3000;

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
      const answerTokens = faq.answer.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      answerTokens.forEach(token => allTerms.add(token));
    });
    
    const spellcheck = new natural.Spellcheck([...allTerms]);
    console.log(`📚 Built spellcheck dictionary with ${allTerms.size} terms`);
    return spellcheck;
  }

  function correctQuery(query, spellcheck) {
    return query
      .split(/\b/)                     // split on word boundaries
      .map(token => {
        const lower = token.toLowerCase();
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

  // Initialize spellcheck
  global.spellcheck = buildSpellcheckDictionary(faqs);
  
  // Initialize semantic search and related questions generator with FAQs
  (async () => {
    try {
      await semanticSearch.initialize();
      await semanticSearch.loadFAQs(faqs);
      console.log('✅ Semantic search ready with stats:', semanticSearch.getStats());
      
      await relatedQuestionsGenerator.initialize();
      relatedQuestionsGenerator.loadFAQs(faqs);
      console.log('✅ Related questions generator ready with stats:', relatedQuestionsGenerator.getStats());

      const semanticModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      relatedFAQ = new RelatedFAQ(faqs.map(f => f.questionEn), semanticModel);
      console.log('✅ Related FAQ module ready');
    } catch (error) {
      console.error('⚠️ Initialization failed, using fallback:', error);
    }
  })();
  
} catch (error) {
  console.error('Error loading FAQ data:', error);
  console.error('Make sure data/faqs.json exists and contains valid JSON');
}

// Helper function to calculate similarity score
function calculateSimilarity(query, text) {
  if (!text) return 0;
  
  const queryLower = query.toLowerCase().trim();
  const textLower = text.toLowerCase().trim();
  
  // Exact match gets highest score
  if (textLower === queryLower) return 1;
  
  // Check if the text contains the entire query
  if (textLower.includes(queryLower)) return 0.95;
  
  // Check if query contains the text (for partial matches)
  if (queryLower.includes(textLower) && textLower.length > 10) return 0.8;
  
  // Word-based matching with improved logic
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1); // Include 2+ letter words
  const textWords = textLower.split(/\s+/);
  
  if (queryWords.length === 0) return 0;
  
  let matches = 0;
  let exactMatches = 0;
  let partialMatches = 0;
  
  queryWords.forEach(qWord => {
    // Check for exact word match
    if (textWords.includes(qWord)) {
      exactMatches++;
      matches += 1;
    } else {
      // Check for partial matches (substring)
      const partialMatch = textWords.some(tWord => {
        if (tWord.includes(qWord) || qWord.includes(tWord)) {
          partialMatches++;
          return true;
        }
        return false;
      });
      if (partialMatch) matches += 0.6;
    }
  });
  
  // Calculate score with improved weighting
  const baseScore = matches / queryWords.length;
  const exactBonus = (exactMatches / queryWords.length) * 0.3;
  const partialBonus = (partialMatches / queryWords.length) * 0.1;
  
  return Math.min(baseScore + exactBonus + partialBonus, 1);
}

// Rule-based override function for specific queries
function ruleBasedAnswer(query) {
  const queryLower = query.toLowerCase();
  
  // Catch "account not activated" or similar activation-related queries
  if (/account.*activated|activate.*account|not.*activated|activation.*problem/i.test(queryLower)) {
    // Normalize apostrophes for comparison
    const normalizeText = (text) => {
      return text
        .replace(/[''′]/g, "'") // Replace curly apostrophes with straight apostrophe
        .replace(/[""″]/g, '"') // Replace curly quotes with straight quotes
        .replace(/\u2019/g, "'") // Replace right single quotation mark
        .replace(/\u2018/g, "'") // Replace left single quotation mark
        .replace(/\u201D/g, '"') // Replace right double quotation mark
        .replace(/\u201C/g, '"'); // Replace left double quotation mark
    };
    
    const activationFAQ = faqs.find(faq => {
      const normalizedFAQ = normalizeText(faq.questionEn);
      const targetQuestion1 = normalizeText("Why hasn't my account been activated yet?");
      const targetQuestion2 = normalizeText("When will my account be activated?");
      
      return normalizedFAQ === targetQuestion1 || normalizedFAQ === targetQuestion2;
    });
    
    if (activationFAQ) {
      console.log(`🎯 Rule-based override for activation query: "${query}"`);
      return {
        faq: activationFAQ,
        score: 1.0,
        similarity: 1.0,
        isRuleOverride: true
      };
    }
  }
  
  return null;
}

// Search endpoint
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  
  console.log('🔍 Search query received:', query);
  
  if (!query || query.trim() === '') {
    console.log('Empty query, returning empty results');
    return res.json({ results: [] });
  }

  try {
    // 1) Check for rule-based override first
    const ruleOverride = ruleBasedAnswer(query);
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
      return res.json({ results, relatedQuestions });
    }
    
    // 2) Spell-correct the query
    const correctedQuery = correctQuery(query, global.spellcheck);
    if (correctedQuery !== query) {
      console.log(`🔤 Spell-corrected query: "${query}" → "${correctedQuery}"`);
    }
    
    // 3) Check for exact matches with both original and corrected query
    const exactMatch = faqs.find(faq => {
      const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedCorrectedQuery = correctedQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedQuestionEn = faq.questionEn.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedQuestionZh = faq.questionZh.toLowerCase().trim().replace(/\s+/g, ' ');
      
      // Debug logging for login queries
      if (query.toLowerCase().includes('login')) {
        console.log('Debug - Query:', JSON.stringify(normalizedQuery));
        console.log('Debug - Corrected Query:', JSON.stringify(normalizedCorrectedQuery));
        console.log('Debug - QuestionEn:', JSON.stringify(normalizedQuestionEn));
        console.log('Debug - Match:', normalizedQuestionEn === normalizedQuery || normalizedQuestionEn === normalizedCorrectedQuery);
      }
      
      return normalizedQuestionEn === normalizedQuery || 
             normalizedQuestionZh === normalizedQuery ||
             normalizedQuestionEn === normalizedCorrectedQuery || 
             normalizedQuestionZh === normalizedCorrectedQuery;
    });
    
    let searchResults;
    if (exactMatch) {
      // If exact match found, prioritize it
      searchResults = [{
        faq: exactMatch,
        score: 1.0,
        similarity: 1.0
      }];
      
      // Add additional semantic results (excluding the exact match)
      const additionalResults = await semanticSearch.semanticSearch(correctedQuery, 4);
      const filteredResults = additionalResults.filter(result => 
        result.faq.questionEn !== exactMatch.questionEn
      );
      searchResults = searchResults.concat(filteredResults);
    } else {
      // Use semantic search if available, otherwise fallback to keyword search
      searchResults = await semanticSearch.semanticSearch(correctedQuery, 5);
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

// API Chat search endpoint (mirrors /api/search for compatibility)
app.post('/apiChat/search', async (req, res) => {
  const { query } = req.body;
  
  console.log('API Chat search query received:', query);
  
  if (!query || query.trim() === '') {
    console.log('Empty query, returning empty results');
    return res.json({ results: [] });
  }

  try {
    // 1) Check for rule-based override first
    const ruleOverride = ruleBasedAnswer(query);
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
      
      console.log(`🎯 Rule-based result for API Chat query: "${query}"`);
      return res.json({ results, relatedQuestions });
    }
    
    // 2) Spell-correct the query
    const correctedQuery = correctQuery(query, global.spellcheck);
    if (correctedQuery !== query) {
      console.log(`🔤 Spell-corrected query: "${query}" → "${correctedQuery}"`);
    }
    
    // 3) Check for exact matches with both original and corrected query
    const exactMatch = faqs.find(faq => {
      const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedCorrectedQuery = correctedQuery.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedQuestionEn = faq.questionEn.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedQuestionZh = faq.questionZh.toLowerCase().trim().replace(/\s+/g, ' ');
      
      return normalizedQuestionEn === normalizedQuery || 
             normalizedQuestionZh === normalizedQuery ||
             normalizedQuestionEn === normalizedCorrectedQuery || 
             normalizedQuestionZh === normalizedCorrectedQuery;
    });
    
    let searchResults;
    if (exactMatch) {
      // If exact match found, prioritize it
      searchResults = [{
        faq: exactMatch,
        score: 1.0,
        similarity: 1.0
      }];
      
      // Add additional semantic results (excluding the exact match)
      const additionalResults = await semanticSearch.semanticSearch(correctedQuery, 4);
      const filteredResults = additionalResults.filter(result => 
        result.faq.questionEn !== exactMatch.questionEn
      );
      searchResults = searchResults.concat(filteredResults);
    } else {
      // Use semantic search if available, otherwise fallback to keyword search
      searchResults = await semanticSearch.semanticSearch(correctedQuery, 5);
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
    const db = require('./database.js');
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

// Get analytics (for admin)
app.get('/api/analytics', async (req, res) => {
  try {
    const db = require('./database.js');
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
    const db = require('./database.js');
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
    'password': ['password', 'pwd', 'passcode', 'forgot password', 'reset password', 'change password', 'new password', 'password expired'],
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
    const answerScore = calculateSimilarity(query, faq.answer) * 0.15;
    
    let boost = 0;
    Object.entries(keywordBoost).forEach(([category, boostValue]) => {
      const questionLower = faq.questionEn.toLowerCase();
      const answerLower = faq.answer.toLowerCase();
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});