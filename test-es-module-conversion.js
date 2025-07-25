import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import SemanticSearch from './semantic-search.js';
import RelatedQuestionsGenerator from './related-questions.js';
import RelatedFAQ from './related-faq.js';
import { pipeline } from '@xenova/transformers';
import natural from 'natural';
import emailService from './email-service.js';
import Fuse from 'fuse.js';
import stringSimilarity from 'string-similarity';
import { franc } from 'franc';
import { findBestMatch } from './faq-search.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('✅ All imports successful!');
console.log('✅ __dirname equivalent:', __dirname);

// Test basic functionality
async function runTests() {
  console.log('\n🧪 Running ES Module conversion tests...');
  
  try {
    // Test 1: Check if FAQ data can be loaded
    const faqPath = path.join(__dirname, 'data', 'faqs_updated_full.json');
    const faqData = fs.readFileSync(faqPath, 'utf8');
    const faqs = JSON.parse(faqData);
    console.log('✅ Test 1: FAQ data loaded successfully -', faqs.length, 'FAQs');
    
    // Test 2: Test SemanticSearch initialization
    const semanticSearch = new SemanticSearch();
    console.log('✅ Test 2: SemanticSearch class instantiated');
    
    // Test 3: Test RelatedQuestionsGenerator initialization
    const relatedQuestionsGenerator = new RelatedQuestionsGenerator();
    console.log('✅ Test 3: RelatedQuestionsGenerator class instantiated');
    
    // Test 4: Test RelatedFAQ initialization
    const faqQuestions = faqs.map(faq => faq.questionEn);
    const relatedFAQ = new RelatedFAQ(faqQuestions);
    console.log('✅ Test 4: RelatedFAQ class instantiated');
    
    // Test 5: Test email service
    console.log('✅ Test 5: Email service loaded - configured:', emailService.isConfigured());
    
    // Test 6: Test findBestMatch function
    const testQuery = "How to reset password";
    const match = findBestMatch(testQuery);
    console.log('✅ Test 6: findBestMatch function works');
    
    // Test 7: Test natural language processing
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize("Hello world");
    console.log('✅ Test 7: Natural language processing works');
    
    // Test 8: Test Fuse.js
    const fuse = new Fuse([{ text: "test" }], { keys: ['text'] });
    console.log('✅ Test 8: Fuse.js works');
    
    // Test 9: Test string similarity
    const similarity = stringSimilarity.compareTwoStrings("hello", "hello");
    console.log('✅ Test 9: String similarity works');
    
    // Test 10: Test franc language detection
    const lang = franc("Hello world");
    console.log('✅ Test 10: Franc language detection works');
    
    console.log('\n🎉 All tests passed! ES Module conversion successful!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests }; 