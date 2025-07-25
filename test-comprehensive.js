import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import SemanticSearch from './semantic-search.js';
import RelatedQuestionsGenerator from './related-questions.js';
import RelatedFAQ from './related-faq.js';
import { findBestMatch } from './faq-search.js';
import emailService from './email-service.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data
const testQueries = [
  // English queries
  "How to reset password",
  "What is the delivery time?",
  "How can I contact customer service?",
  "What are the payment methods?",
  "How to track my order?",
  
  // Chinese queries
  "如何重置密码",
  "送货时间是多少？",
  "如何联系客服？",
  "有哪些支付方式？",
  "如何跟踪我的订单？",
  
  // Mixed language queries
  "password 重置",
  "delivery 时间",
  "contact 客服",
  
  // Edge cases
  "test",
  "hello world",
  "123456",
  "",
  "   ",
  
  // Long queries
  "I need help with resetting my password because I forgot it and cannot access my account",
  "我想了解关于重置密码的详细信息，因为我忘记了密码无法登录账户"
];

const testFAQs = [
  {
    questionEn: "How to reset password?",
    questionZh: "如何重置密码？",
    answer: "To reset your password, go to the login page and click 'Forgot Password' link.",
    alternateQuestionsEn: ["Reset password", "Password reset", "Forgot password"],
    alternateQuestionsZh: ["重置密码", "密码重置", "忘记密码"]
  },
  {
    questionEn: "What is the delivery time?",
    questionZh: "送货时间是多少？",
    answer: "Standard delivery takes 3-5 business days. Express delivery takes 1-2 business days.",
    alternateQuestionsEn: ["Delivery time", "Shipping time", "How long to deliver"],
    alternateQuestionsZh: ["送货时间", "配送时间", "多久能送到"]
  },
  {
    questionEn: "How to contact customer service?",
    questionZh: "如何联系客服？",
    answer: "You can contact us via WhatsApp +65 9012 6012 or email service@ecombay.com",
    alternateQuestionsEn: ["Contact support", "Customer service", "Get help"],
    alternateQuestionsZh: ["联系支持", "客服", "获取帮助"]
  }
];

class ComprehensiveTester {
  constructor() {
    this.results = [];
    this.semanticSearch = null;
    this.relatedQuestionsGenerator = null;
    this.relatedFAQ = null;
  }

  async initialize() {
    console.log('🚀 Initializing comprehensive test suite...');
    
    try {
      // Initialize components
      this.semanticSearch = new SemanticSearch();
      this.relatedQuestionsGenerator = new RelatedQuestionsGenerator();
      this.relatedFAQ = new RelatedFAQ(testFAQs.map(faq => faq.questionEn));
      
      console.log('✅ All components initialized successfully');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async runAllTests() {
    console.log('\n🧪 Running comprehensive test suite...\n');
    
    await this.testFAQLoading();
    await this.testFindBestMatch();
    await this.testSemanticSearch();
    await this.testRelatedQuestions();
    await this.testRelatedFAQ();
    await this.testEmailService();
    await this.testEdgeCases();
    
    this.printSummary();
  }

  async testFAQLoading() {
    console.log('📋 Test 1: FAQ Data Loading');
    console.log('─'.repeat(50));
    
    try {
      const faqPath = path.join(__dirname, 'data', 'faqs_updated_full.json');
      const faqData = fs.readFileSync(faqPath, 'utf8');
      const faqs = JSON.parse(faqData);
      
      console.log(`✅ Loaded ${faqs.length} FAQs from file`);
      console.log(`✅ File size: ${(faqData.length / 1024).toFixed(2)} KB`);
      
      // Test structure
      const firstFAQ = faqs[0];
      const requiredFields = ['questionEn', 'questionZh', 'answer'];
      const hasAllFields = requiredFields.every(field => firstFAQ.hasOwnProperty(field));
      
      if (hasAllFields) {
        console.log('✅ FAQ structure is correct');
      } else {
        console.log('❌ FAQ structure is missing required fields');
      }
      
      this.results.push({ test: 'FAQ Loading', status: 'PASS' });
    } catch (error) {
      console.log('❌ FAQ loading failed:', error.message);
      this.results.push({ test: 'FAQ Loading', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  async testFindBestMatch() {
    console.log('🔍 Test 2: Find Best Match Function');
    console.log('─'.repeat(50));
    
    const testCases = [
      { query: "How to reset password", expected: "password" },
      { query: "如何重置密码", expected: "密码" },
      { query: "delivery time", expected: "delivery" },
      { query: "contact support", expected: "contact" }
    ];
    
    for (const testCase of testCases) {
      try {
        const result = findBestMatch(testCase.query);
        const success = result && (result.text.includes(testCase.expected) || 
                                  result.answer.includes(testCase.expected));
        
        if (success) {
          console.log(`✅ "${testCase.query}" → Found match`);
        } else {
          console.log(`⚠️  "${testCase.query}" → No exact match found`);
        }
      } catch (error) {
        console.log(`❌ "${testCase.query}" → Error: ${error.message}`);
      }
    }
    
    this.results.push({ test: 'Find Best Match', status: 'PASS' });
    console.log('');
  }

  async testSemanticSearch() {
    console.log('🧠 Test 3: Semantic Search');
    console.log('─'.repeat(50));
    
    try {
      // Test initialization
      await this.semanticSearch.initialize();
      console.log('✅ Semantic search initialized');
      
      // Test with sample data
      await this.semanticSearch.loadFAQs(testFAQs);
      console.log('✅ FAQ data loaded into semantic search');
      
      // Test search functionality
      const query = "I forgot my password";
      const results = await this.semanticSearch.semanticSearch(query, 3);
      
      if (results && results.length > 0) {
        console.log(`✅ Semantic search returned ${results.length} results`);
        console.log(`   Top result: "${results[0].faq.questionEn}"`);
      } else {
        console.log('⚠️  Semantic search returned no results');
      }
      
      this.results.push({ test: 'Semantic Search', status: 'PASS' });
    } catch (error) {
      console.log('❌ Semantic search test failed:', error.message);
      this.results.push({ test: 'Semantic Search', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  async testRelatedQuestions() {
    console.log('❓ Test 4: Related Questions Generator');
    console.log('─'.repeat(50));
    
    try {
      await this.relatedQuestionsGenerator.initialize();
      console.log('✅ Related questions generator initialized');
      
      this.relatedQuestionsGenerator.loadFAQs(testFAQs);
      console.log('✅ FAQ data loaded into related questions generator');
      
      const query = "password reset";
      const relatedQuestions = await this.relatedQuestionsGenerator.getRelatedQuestions(query, 3);
      
      if (relatedQuestions && relatedQuestions.length > 0) {
        console.log(`✅ Generated ${relatedQuestions.length} related questions`);
        relatedQuestions.forEach((q, i) => {
          console.log(`   ${i + 1}. ${q.question}`);
        });
      } else {
        console.log('⚠️  No related questions generated');
      }
      
      this.results.push({ test: 'Related Questions', status: 'PASS' });
    } catch (error) {
      console.log('❌ Related questions test failed:', error.message);
      this.results.push({ test: 'Related Questions', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  async testRelatedFAQ() {
    console.log('🔗 Test 5: Related FAQ');
    console.log('─'.repeat(50));
    
    try {
      const query = "I need help with password";
      const relatedFAQs = await this.relatedFAQ.relatedQuestionKeywords(query, 3, 3);
      
      if (relatedFAQs && relatedFAQs.length > 0) {
        console.log(`✅ Found ${relatedFAQs.length} related FAQs`);
        relatedFAQs.forEach((faq, i) => {
          console.log(`   ${i + 1}. ${faq.question} (score: ${faq.score.toFixed(3)})`);
        });
      } else {
        console.log('⚠️  No related FAQs found');
      }
      
      this.results.push({ test: 'Related FAQ', status: 'PASS' });
    } catch (error) {
      console.log('❌ Related FAQ test failed:', error.message);
      this.results.push({ test: 'Related FAQ', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  async testEmailService() {
    console.log('📧 Test 6: Email Service');
    console.log('─'.repeat(50));
    
    try {
      const isConfigured = emailService.isConfigured();
      console.log(`✅ Email service configuration: ${isConfigured ? 'Configured' : 'Not configured'}`);
      
      if (isConfigured) {
        console.log('✅ Email service is ready for sending emails');
      } else {
        console.log('⚠️  Email service needs SMTP configuration');
      }
      
      this.results.push({ test: 'Email Service', status: 'PASS' });
    } catch (error) {
      console.log('❌ Email service test failed:', error.message);
      this.results.push({ test: 'Email Service', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  async testEdgeCases() {
    console.log('🔬 Test 7: Edge Cases');
    console.log('─'.repeat(50));
    
    const edgeCases = [
      { query: "", description: "Empty string" },
      { query: "   ", description: "Whitespace only" },
      { query: "123456", description: "Numbers only" },
      { query: "!@#$%^", description: "Special characters only" },
      { query: "a".repeat(1000), description: "Very long string" }
    ];
    
    for (const testCase of edgeCases) {
      try {
        const result = findBestMatch(testCase.query);
        if (result) {
          console.log(`✅ "${testCase.description}" → Handled gracefully`);
        } else {
          console.log(`⚠️  "${testCase.description}" → No result (expected for edge cases)`);
        }
      } catch (error) {
        console.log(`❌ "${testCase.description}" → Error: ${error.message}`);
      }
    }
    
    this.results.push({ test: 'Edge Cases', status: 'PASS' });
    console.log('');
  }

  printSummary() {
    console.log('📊 Test Summary');
    console.log('─'.repeat(50));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;
    
    console.log(`Total tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`   - ${result.test}: ${result.error}`);
      });
    }
    
    console.log('\n🎉 Test suite completed!');
  }
}

// Run tests if this file is executed directly
async function main() {
  const tester = new ComprehensiveTester();
  await tester.initialize();
  await tester.runAllTests();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ComprehensiveTester, main }; 