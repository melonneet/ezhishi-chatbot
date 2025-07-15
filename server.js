require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');
const nodemailer = require('nodemailer');

// In-memory store for verification codes (for demo)
const verificationCodes = {};

// Configure nodemailer using environment variables
const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE || 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || '';

// Middleware
app.use(cors());
app.use(express.json());
app.use(BASE_PATH, express.static('public'));

// Load FAQ data
let faqs = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'data', 'faqs_updated.json'), 'utf8');
  faqs = JSON.parse(data);
  console.log(`Loaded ${faqs.length} FAQs successfully`);
} catch (error) {
  console.error('Error loading FAQ data:', error);
  console.error('Make sure data/faqs_updated.json exists and contains valid JSON');
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
  
  // Word-based matching with stricter logic
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2); // Only 3+ letter words
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
      // Check for partial matches only for longer words (4+ characters)
      if (qWord.length >= 4) {
      const partialMatch = textWords.some(tWord => {
        if (tWord.includes(qWord) || qWord.includes(tWord)) {
          partialMatches++;
          return true;
        }
        return false;
      });
        if (partialMatch) matches += 0.4; // Lower score for partial matches
      }
    }
  });
  
  // Calculate score with improved weighting
  const baseScore = matches / queryWords.length;
  const exactBonus = (exactMatches / queryWords.length) * 0.3;
  const partialBonus = (partialMatches / queryWords.length) * 0.1;
  
  return Math.min(baseScore + exactBonus + partialBonus, 1);
}

// Create new chat session
app.post(`${BASE_PATH}/apiChat/session/start`, async (req, res) => {
  try {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const userIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    await db.createSession(sessionId, userIp, userAgent);
    res.json({ sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// End chat session
app.post(`${BASE_PATH}/apiChat/session/end`, async (req, res) => {
  try {
    const { sessionId } = req.body;
    await db.endSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Search endpoint with chat recording
app.post(`${BASE_PATH}/apiChat/search`, async (req, res) => {
  const { query, sessionId } = req.body;
  
  if (!query || query.trim() === '') {
    return res.json({ results: [] });
  }

  // Save user message
  if (sessionId) {
    try {
      await db.saveMessage(sessionId, 'user', query);
    } catch (error) {
      console.error('Error saving user message:', error);
    }
  }

  const queryLower = query.toLowerCase();
  
  // Check if query contains meaningful keywords
  const meaningfulKeywords = [
    'login', 'password', 'activate', 'refund', 'delivery', 'submit', 'pen', 'subscribe', 'points', 'app',
    'account', 'help', 'support', 'problem', 'issue', 'question', 'how', 'what', 'when', 'where', 'why',
    'eZhishi', 'ecombay', 'etutor', 'etutorstar', 'et-901', 'mobile', 'download', 'reset', 'change',
    'forgot', 'cannot', 'cant', 'access', 'signin', 'sign in', 'pwd', 'passcode', 'activation', 'active',
    'money back', 'cancel', 'return', 'shipping', 'mail', 'address', 'receive', 'parcel', 'order',
    'submission', 'contribute', 'article', 'essay', 'composition', 'learning pen', 'reading pen',
    'subscription', 'renew', 'rewards', 'reward points', 'redeem', 'application', 'etutorlearning'
  ];
  
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const meaningfulWords = queryWords.filter(word => 
    meaningfulKeywords.some(keyword => 
      word.includes(keyword) || keyword.includes(word)
    )
  );
  
  // If no meaningful words found, return no results
  if (meaningfulWords.length === 0) {
    return res.json({ results: [] });
  }
  
  // Check if the query is actually asking a question or seeking help
  const questionWords = ['how', 'what', 'when', 'where', 'why', 'can', 'could', 'would', 'should', 'help', 'problem', 'issue', 'trouble', 'error', 'cannot', 'cant', 'doesnt', 'doesn\'t', 'dont', 'don\'t'];
  const hasQuestionIntent = questionWords.some(word => queryLower.includes(word)) || 
                           queryLower.includes('?') || 
                           queryLower.includes('help') ||
                           queryLower.includes('problem') ||
                           queryLower.includes('issue');
  
  // If no question intent detected, return no results
  if (!hasQuestionIntent) {
    return res.json({ results: [] });
  }
  
  // Define keywords for better matching
  const keywordMap = {
    'login': ['login', 'log in', 'signin', 'sign in', 'access', 'cannot login', 'cant login'],
    'password': ['password', 'pwd', 'passcode', 'forgot password', 'reset password', 'change password'],
    'activate': ['activate', 'activation', 'active', 'activating'],
    'refund': ['refund', 'money back', 'cancel', 'return'],
    'delivery': ['delivery', 'shipping', 'mail', 'address', 'receive', 'parcel', 'order'],
    'submit': ['submit', 'submission', 'contribute', 'article', 'essay', 'composition'],
    'pen': ['pen', 'learning pen', 'reading pen', 'etutorstar', 'et-901'],
    'subscribe': ['subscribe', 'subscription', 'renew', 'cancel subscription'],
    'points': ['points', 'rewards', 'reward points', 'redeem'],
    'app': ['app', 'application', 'etutorlearning', 'mobile', 'download']
  };
  
  // Check for keyword matches
  let keywordBoost = {};
  Object.entries(keywordMap).forEach(([category, keywords]) => {
    if (keywords.some(kw => queryLower.includes(kw))) {
      keywordBoost[category] = 0.3;
    }
  });

  // Calculate similarity scores for each FAQ with stricter matching
  const scoredFaqs = faqs.map(faq => {
    const englishScore = calculateSimilarity(query, faq.questionEn);
    const chineseScore = calculateSimilarity(query, faq.questionZh || '');
    const categoryScore = calculateSimilarity(query, faq.category) * 0.2; // Reduced weight
    const answerScore = calculateSimilarity(query, faq.answer) * 0.1; // Much lower weight for answer
    
    // Add keyword boost based on category
    let boost = 0;
    Object.entries(keywordBoost).forEach(([category, boostValue]) => {
      if (faq.questionEn.toLowerCase().includes(category) || 
          faq.category.toLowerCase().includes(category)) {
        boost += boostValue;
      }
    });
    
    // Require at least one strong match (question or category)
    const hasStrongMatch = Math.max(englishScore, chineseScore) > 0.4 || categoryScore > 0.15;
    
    return {
      ...faq,
      score: hasStrongMatch ? (Math.max(englishScore, chineseScore) + categoryScore + answerScore + boost) : 0
    };
  });

  // Filter and sort results with very strict matching
  const results = scoredFaqs
    .filter(faq => faq.score > 0.5) // Much higher threshold to avoid meaningless matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // Top 5 results

  // Track question in analytics
  const wasAnswered = results.length > 0 && results[0].score > 0.5;
  const category = results.length > 0 ? results[0].category : 'Unknown';
  
  try {
    await db.trackQuestion(query, category, wasAnswered);
  } catch (error) {
    console.error('Error tracking question:', error);
  }

  // Save bot response
  if (sessionId && results.length > 0) {
    try {
      await db.saveMessage(sessionId, 'bot', results[0].answer);
    } catch (error) {
      console.error('Error saving bot message:', error);
    }
  }

  res.json({ results });
});

// Get chat history for download
app.get(`${BASE_PATH}/apiChat/chat/history/:sessionId`, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await db.getChatHistory(sessionId);
    res.json({ history });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// Customer profile management
app.post(`${BASE_PATH}/apiChat/customer/profile`, async (req, res) => {
  try {
    const { email, name, phone } = req.body;
    await db.updateCustomerProfile(email, name, phone);
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating customer profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get(`${BASE_PATH}/apiChat/customer/profile/:email`, async (req, res) => {
  try {
    const { email } = req.params;
    const profile = await db.getCustomerProfile(email);
    if (profile) {
      res.json({ profile });
    } else {
      res.status(404).json({ error: 'Profile not found' });
    }
  } catch (error) {
    console.error('Error getting customer profile:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.get(`${BASE_PATH}/apiChat/customer/history/:email`, async (req, res) => {
  try {
    const { email } = req.params;
    const history = await db.getCustomerChatHistory(email);
    res.json({ history });
  } catch (error) {
    console.error('Error getting customer history:', error);
    res.status(500).json({ error: 'Failed to get customer history' });
  }
});

// Start session with customer info
app.post(`${BASE_PATH}/apiChat/session/start-with-customer`, async (req, res) => {
  try {
    const { email, name, phone } = req.body;
    const sessionId = crypto.randomBytes(16).toString('hex');
    const userIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    await db.createSession(sessionId, userIp, userAgent, email, name);
    
    // Update customer profile
    if (email) {
      await db.updateCustomerProfile(email, name, phone);
    }
    
    res.json({ sessionId });
  } catch (error) {
    console.error('Error creating session with customer:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Admin endpoints
app.get(`${BASE_PATH}/apiChat/admin/sessions`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const sessions = await db.getAllSessions(limit, offset);
    res.json({ sessions });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

app.get(`${BASE_PATH}/apiChat/admin/analytics`, async (req, res) => {
  try {
    const analytics = await db.getQuestionAnalytics();
    const totalQuestions = analytics.reduce((sum, item) => sum + item.times_asked, 0);
    const avgSessionTime = await db.getAverageSessionTime();
    
    res.json({ 
      questions: analytics, 
      totalQuestions,
      avgSessionTime: Math.round(avgSessionTime || 0)
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

app.get(`${BASE_PATH}/apiChat/admin/customers`, async (req, res) => {
  try {
    const customers = await db.getAllCustomers();
    res.json({ customers, total: customers.length });
  } catch (error) {
    console.error('Error getting customers:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
});

// FAQ Management endpoints
app.get(`${BASE_PATH}/apiChat/faqs`, async (req, res) => {
  try {
    res.json({ faqs });
  } catch (error) {
    console.error('Error getting FAQs:', error);
    res.status(500).json({ error: 'Failed to get FAQs' });
  }
});

app.post(`${BASE_PATH}/apiChat/faqs`, async (req, res) => {
  try {
    const { questionEn, questionZh, answer, category } = req.body;
    
    if (!questionEn || !answer) {
      return res.status(400).json({ error: 'English question and answer are required' });
    }
    
    const newFaq = {
      id: Date.now(), // Simple ID generation
      questionEn,
      questionZh: questionZh || '',
      answer,
      category: category || 'General'
    };
    
    faqs.push(newFaq);
    
    // Save to file
    fs.writeFileSync(path.join(__dirname, 'data', 'faqs_updated.json'), JSON.stringify(faqs, null, 2));
    
    res.json({ success: true, faq: newFaq });
  } catch (error) {
    console.error('Error adding FAQ:', error);
    res.status(500).json({ error: 'Failed to add FAQ' });
  }
});

app.put(`${BASE_PATH}/apiChat/faqs/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    const { questionEn, questionZh, answer, category } = req.body;
    
    const faqIndex = faqs.findIndex(faq => faq.id == id);
    if (faqIndex === -1) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    
    faqs[faqIndex] = {
      ...faqs[faqIndex],
      questionEn: questionEn || faqs[faqIndex].questionEn,
      questionZh: questionZh || faqs[faqIndex].questionZh,
      answer: answer || faqs[faqIndex].answer,
      category: category || faqs[faqIndex].category
    };
    
    // Save to file
    fs.writeFileSync(path.join(__dirname, 'data', 'faqs_updated.json'), JSON.stringify(faqs, null, 2));
    
    res.json({ success: true, faq: faqs[faqIndex] });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

app.delete(`${BASE_PATH}/apiChat/faqs/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    
    const faqIndex = faqs.findIndex(faq => faq.id == id);
    if (faqIndex === -1) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    
    const deletedFaq = faqs.splice(faqIndex, 1)[0];
    
    // Save to file
    fs.writeFileSync(path.join(__dirname, 'data', 'faqs_updated.json'), JSON.stringify(faqs, null, 2));
    
    res.json({ success: true, message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

app.get('/api/admin/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await db.getChatHistory(sessionId);
    res.json({ messages });
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({ error: 'Failed to get session details' });
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

// Test endpoint to verify FAQs are loaded
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok',
    faqCount: faqs.length,
    categories: [...new Set(faqs.map(faq => faq.category))],
    message: 'Server is running and FAQs are loaded'
  });
});

// Send verification code to email
app.post('/api/customer/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[email] = { code, expires: Date.now() + 10 * 60 * 1000 }; // 10 min expiry
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER || 'your-email@gmail.com',
      to: email,
      subject: 'Your eZhishi Verification Code',
      text: `Your verification code is: ${code}`
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send code' });
  }
});

// Verify code
app.post('/api/customer/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });
  const entry = verificationCodes[email];
  if (!entry || entry.code !== code) {
    return res.status(400).json({ error: 'Invalid code' });
  }
  if (Date.now() > entry.expires) {
    delete verificationCodes[email];
    return res.status(400).json({ error: 'Code expired' });
  }
  delete verificationCodes[email];
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});