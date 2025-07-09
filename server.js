const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Load FAQ data
let faqs = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'data', 'faqs.json'), 'utf8');
  faqs = JSON.parse(data);
  console.log(`Loaded ${faqs.length} FAQs successfully`);
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

// Search endpoint
app.post('/api/search', (req, res) => {
  const { query } = req.body;
  
  console.log('Search query received:', query);
  
  if (!query || query.trim() === '') {
    console.log('Empty query, returning empty results');
    return res.json({ results: [] });
  }

  const queryLower = query.toLowerCase().trim();
  
  // Enhanced keyword mapping for better matching
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
  
  // Check for keyword matches with improved logic
  let keywordBoost = {};
  Object.entries(keywordMap).forEach(([category, keywords]) => {
    const matchedKeywords = keywords.filter(kw => queryLower.includes(kw));
    if (matchedKeywords.length > 0) {
      keywordBoost[category] = Math.min(0.4, matchedKeywords.length * 0.1);
      console.log(`Keyword boost for ${category}:`, matchedKeywords);
    }
  });

  // Calculate similarity scores for each FAQ
  const scoredFaqs = faqs.map(faq => {
    const englishScore = calculateSimilarity(query, faq.questionEn);
    const chineseScore = calculateSimilarity(query, faq.questionZh || '');
    const categoryScore = calculateSimilarity(query, faq.category) * 0.4;
    const answerScore = calculateSimilarity(query, faq.answer) * 0.15; // Lower weight for answer
    
    // Add keyword boost based on category and content
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
      ...faq,
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

  // Filter and sort results with lower threshold
  const results = scoredFaqs
    .filter(faq => faq.score > 0.15) // Lower threshold for better coverage
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // Top 5 results

  console.log(`Found ${results.length} results for query: "${query}"`);
  if (results.length > 0) {
    console.log('Top result:', {
      question: results[0].questionEn,
      score: results[0].score,
      debug: results[0].debug
    });
  }

  res.json({ 
    results: results.map(r => ({
      ...r,
      debug: undefined // Remove debug info from response
    }))
  });
});

// Get all categories
app.get('/api/categories', (req, res) => {
  const categories = [...new Set(faqs.map(faq => faq.category))];
  res.json({ categories });
});

// Get FAQs by category
app.get('/api/faqs/:category', (req, res) => {
  const { category } = req.params;
  const categoryFaqs = faqs.filter(faq => faq.category === category);
  res.json({ faqs: categoryFaqs });
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

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'eZhishi Chatbot API is running',
    timestamp: new Date().toISOString()
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});