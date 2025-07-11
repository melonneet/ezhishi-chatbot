const fs = require('fs');
const path = require('path');

// Load FAQ data
function loadFAQs() {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', 'faqs_updated.json'), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading FAQs:', error);
        return [];
    }
}

// Test queries with expected answers
const testCases = [
    {
        query: "How do I reset my password?",
        expectedKeywords: ["reset", "password", "forgetpassword.html"],
        category: "账号相关问题"
    },
    {
        query: "I cannot login",
        expectedKeywords: ["reset", "forgetpassword.html", "login"],
        category: "账号相关问题"
    },
    {
        query: "How to submit article",
        expectedKeywords: ["submit", "article", "editor@EtutorStar.com"],
        category: "投稿问题"
    },
    {
        query: "I forgot my password",
        expectedKeywords: ["reset", "password", "forgetpassword.html"],
        category: "账号相关问题"
    },
    {
        query: "How to change password",
        expectedKeywords: ["change", "password", "My Account"],
        category: "账号相关问题"
    },
    {
        query: "Where is my order",
        expectedKeywords: ["track", "order", "delivery"],
        category: "换地址/发货 / 物流 / 订单问题"
    },
    {
        query: "I want refund",
        expectedKeywords: ["refund", "invoice"],
        category: "退款问题"
    },
    {
        query: "How to activate account",
        expectedKeywords: ["activate", "payment", "invoice"],
        category: "项目激活 / 使用问题"
    }
];

// Test the search algorithm
function testSearchAlgorithm() {
    const faqs = loadFAQs();
    console.log(`📊 Testing search algorithm with ${faqs.length} FAQs\n`);
    
    testCases.forEach((testCase, index) => {
        console.log(`🧪 Test ${index + 1}: "${testCase.query}"`);
        console.log(`   Expected category: ${testCase.category}`);
        console.log(`   Expected keywords: ${testCase.expectedKeywords.join(', ')}`);
        
        // Simulate the search algorithm
        const results = searchFAQs(testCase.query, faqs);
        
        if (results.length > 0) {
            const topResult = results[0];
            console.log(`   ✅ Found: "${topResult.questionEn}"`);
            console.log(`   📂 Category: ${topResult.category}`);
            console.log(`   📈 Score: ${topResult.score.toFixed(3)}`);
            
            // Check if expected keywords are in the answer
            const answerLower = topResult.answer.toLowerCase();
            const foundKeywords = testCase.expectedKeywords.filter(keyword => 
                answerLower.includes(keyword.toLowerCase())
            );
            
            if (foundKeywords.length > 0) {
                console.log(`   ✅ Found expected keywords: ${foundKeywords.join(', ')}`);
            } else {
                console.log(`   ⚠️  Missing expected keywords in answer`);
            }
            
            if (topResult.category === testCase.category) {
                console.log(`   ✅ Correct category match`);
            } else {
                console.log(`   ⚠️  Category mismatch (expected: ${testCase.category})`);
            }
        } else {
            console.log(`   ❌ No results found`);
        }
        
        console.log('');
    });
}

// Simple search algorithm (similar to server)
function searchFAQs(query, faqs) {
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
    
    // Check for keyword matches
    let keywordBoost = {};
    Object.entries(keywordMap).forEach(([category, keywords]) => {
        const matchedKeywords = keywords.filter(kw => queryLower.includes(kw));
        if (matchedKeywords.length > 0) {
            keywordBoost[category] = Math.min(0.4, matchedKeywords.length * 0.1);
        }
    });

    // Calculate similarity scores
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
            ...faq,
            score: totalScore
        };
    });

    return scoredFaqs
        .filter(faq => faq.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}

// Similarity calculation (same as server)
function calculateSimilarity(query, text) {
    if (!text) return 0;
    
    const queryLower = query.toLowerCase().trim();
    const textLower = text.toLowerCase().trim();
    
    if (textLower === queryLower) return 1;
    if (textLower.includes(queryLower)) return 0.95;
    if (queryLower.includes(textLower) && textLower.length > 10) return 0.8;
    
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
    const textWords = textLower.split(/\s+/);
    
    if (queryWords.length === 0) return 0;
    
    let matches = 0;
    let exactMatches = 0;
    let partialMatches = 0;
    
    queryWords.forEach(qWord => {
        if (textWords.includes(qWord)) {
            exactMatches++;
            matches += 1;
        } else {
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
    
    const baseScore = matches / queryWords.length;
    const exactBonus = (exactMatches / queryWords.length) * 0.3;
    const partialBonus = (partialMatches / queryWords.length) * 0.1;
    
    return Math.min(baseScore + exactBonus + partialBonus, 1);
}

// Interactive testing
function interactiveTest() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('🔍 Interactive FAQ Testing');
    console.log('Type your questions and see the results. Type "quit" to exit.\n');
    
    function askQuestion() {
        rl.question('❓ Enter your question: ', (query) => {
            if (query.toLowerCase() === 'quit') {
                rl.close();
                return;
            }
            
            const faqs = loadFAQs();
            const results = searchFAQs(query, faqs);
            
            console.log(`\n📋 Results for: "${query}"`);
            if (results.length > 0) {
                results.forEach((result, index) => {
                    console.log(`\n${index + 1}. [${result.category}] ${result.questionEn}`);
                    console.log(`   Score: ${result.score.toFixed(3)}`);
                    console.log(`   Answer: ${result.answer.substring(0, 150)}...`);
                });
            } else {
                console.log('❌ No results found');
            }
            
            console.log('\n' + '='.repeat(50) + '\n');
            askQuestion();
        });
    }
    
    askQuestion();
}

// Main execution
const command = process.argv[2];

if (command === 'test') {
    testSearchAlgorithm();
} else if (command === 'interactive') {
    interactiveTest();
} else {
    console.log(`
🔍 eZhishi FAQ Answer Testing Tool

Usage:
  node test-answers.js test          - Run automated tests
  node test-answers.js interactive   - Interactive testing mode

Examples:
  node test-answers.js test
  node test-answers.js interactive
    `);
} 