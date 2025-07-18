const SemanticSearch = require('./semantic-search');
const fs = require('fs');
const path = require('path');

// Test cases that demonstrate semantic understanding improvements
const testCases = [
    {
        query: "I can't log in",
        expectedKeywords: ["login", "access", "authentication"],
        description: "Semantic understanding of login variations"
    },
    {
        query: "Forgot my passcode",
        expectedKeywords: ["password", "reset", "forgot"],
        description: "Synonym recognition (passcode = password)"
    },
    {
        query: "How to enable my account",
        expectedKeywords: ["activate", "enable", "account"],
        description: "Semantic similarity (enable = activate)"
    },
    {
        query: "Want my money back",
        expectedKeywords: ["refund", "money back", "return"],
        description: "Natural language understanding"
    },
    {
        query: "When will I get my order",
        expectedKeywords: ["delivery", "order", "shipping"],
        description: "Context-aware keyword detection"
    },
    {
        query: "Submit my article",
        expectedKeywords: ["submit", "article", "contribute"],
        description: "Action-oriented queries"
    },
    {
        query: "My learning pen doesn't work",
        expectedKeywords: ["pen", "learning pen", "technical support"],
        description: "Product-specific semantic matching"
    },
    {
        query: "Need help with subscription",
        expectedKeywords: ["subscribe", "subscription", "help"],
        description: "Multi-concept understanding"
    }
];

async function testSemanticSearch() {
    console.log('🧪 Testing Semantic Search Improvements\n');
    
    // Load FAQs
    const faqs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'faqs_updated_full.json'), 'utf8'));
    console.log(`📚 Loaded ${faqs.length} FAQs for testing\n`);
    
    // Initialize semantic search
    const semanticSearch = new SemanticSearch();
    
    try {
        console.log('🤖 Initializing semantic search...');
        await semanticSearch.initialize();
        await semanticSearch.loadFAQs(faqs);
        
        console.log('✅ Semantic search ready!\n');
        
        // Test each case
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log(`\n${i + 1}. Testing: "${testCase.query}"`);
            console.log(`   Description: ${testCase.description}`);
            
            // Get semantic search results
            const results = await semanticSearch.semanticSearch(testCase.query, 3);
            
            if (results.length > 0) {
                const topResult = results[0];
                console.log(`   ✅ Top match: "${topResult.faq.questionEn}"`);
                console.log(`   📊 Similarity: ${topResult.similarity.toFixed(3)}`);
                console.log(`   📂 Category: ${topResult.faq.category}`);
                
                // Check if expected keywords are found in the answer
                const answerLower = topResult.faq.answer.toLowerCase();
                const foundKeywords = testCase.expectedKeywords.filter(keyword => 
                    answerLower.includes(keyword.toLowerCase())
                );
                
                if (foundKeywords.length > 0) {
                    console.log(`   ✅ Found expected keywords: ${foundKeywords.join(', ')}`);
                } else {
                    console.log(`   ⚠️  Expected keywords not found in answer`);
                }
            } else {
                console.log(`   ❌ No results found`);
            }
        }
        
        // Performance comparison
        console.log('\n' + '='.repeat(60));
        console.log('📊 PERFORMANCE COMPARISON');
        console.log('='.repeat(60));
        
        const comparisonQueries = [
            ["can't login", "login problem"],
            ["forgot password", "reset password"], 
            ["want refund", "get money back"],
            ["submit article", "send article"]
        ];
        
        for (const [query1, query2] of comparisonQueries) {
            console.log(`\nComparing: "${query1}" vs "${query2}"`);
            
            const result1 = await semanticSearch.semanticSearch(query1, 1);
            const result2 = await semanticSearch.semanticSearch(query2, 1);
            
            if (result1.length > 0 && result2.length > 0) {
                const similarity1 = result1[0].similarity;
                const similarity2 = result2[0].similarity;
                
                console.log(`   "${query1}": ${similarity1.toFixed(3)}`);
                console.log(`   "${query2}": ${similarity2.toFixed(3)}`);
                
                if (Math.abs(similarity1 - similarity2) < 0.1) {
                    console.log(`   ✅ Semantic search recognizes these as similar queries`);
                } else {
                    console.log(`   ⚠️  Different similarity scores`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
        console.log('\n⚠️  Falling back to keyword-based search...');
        
        // Test with fallback
        for (const testCase of testCases.slice(0, 3)) {
            console.log(`\nTesting fallback: "${testCase.query}"`);
            const results = semanticSearch.fallbackSearch(testCase.query, 1);
            
            if (results.length > 0) {
                console.log(`   ✅ Fallback result: "${results[0].faq.questionEn}"`);
                console.log(`   📊 Score: ${results[0].score.toFixed(3)}`);
            } else {
                console.log(`   ❌ No fallback results`);
            }
        }
    }
}

// Interactive testing
async function interactiveTest() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('🔍 Interactive Semantic Search Testing');
    console.log('Type your questions and see semantic search results. Type "quit" to exit.\n');
    
    const faqs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'faqs_updated_full.json'), 'utf8'));
    const semanticSearch = new SemanticSearch();
    
    try {
        await semanticSearch.initialize();
        await semanticSearch.loadFAQs(faqs);
        console.log('✅ Semantic search ready for interactive testing!\n');
    } catch (error) {
        console.log('⚠️  Using fallback search for interactive testing\n');
    }
    
    function askQuestion() {
        rl.question('❓ Enter your question: ', async (query) => {
            if (query.toLowerCase() === 'quit') {
                rl.close();
                return;
            }
            
            try {
                const results = await semanticSearch.semanticSearch(query, 3);
                
                console.log(`\n📋 Semantic search results for: "${query}"`);
                if (results.length > 0) {
                    results.forEach((result, index) => {
                        console.log(`\n${index + 1}. [${result.faq.category}] ${result.faq.questionEn}`);
                        console.log(`   Similarity: ${result.similarity.toFixed(3)}`);
                        console.log(`   Answer: ${result.faq.answer.substring(0, 150)}...`);
                    });
                } else {
                    console.log('❌ No results found');
                }
            } catch (error) {
                console.log('❌ Search error:', error.message);
            }
            
            console.log('\n' + '='.repeat(50) + '\n');
            askQuestion();
        });
    }
    
    askQuestion();
}

// Main execution
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'interactive') {
        interactiveTest();
    } else {
        testSemanticSearch();
    }
}

module.exports = { testSemanticSearch, interactiveTest }; 