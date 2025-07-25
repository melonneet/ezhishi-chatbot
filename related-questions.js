const natural = require('natural');
const MyClassificationPipeline = require('./MyClassificationPipeline');
const path = require('path');
const fs = require('fs');

class RelatedQuestionsGenerator {
    constructor() {
        this.vectorizer = new natural.TfIdf();
        this.faqQuestions = [];
        this.faqAnswers = [];
        this.model = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🤖 Initializing related questions generator...');
            
            // Load the sentence transformer model for semantic similarity
            this.model = await MyClassificationPipeline.getInstance();
            
            this.initialized = true;
            console.log('✅ Related questions generator ready');
        } catch (error) {
            console.error('❌ Error initializing related questions generator:', error);
            this.initialized = false;
        }
    }

    loadFAQs(faqs) {
        this.faqQuestions = faqs.map(faq => faq.questionEn);
        this.faqAnswers = faqs.map(faq => faq.answer);
        
        // Build TF-IDF index
        this.faqQuestions.forEach((question, index) => {
            this.vectorizer.addDocument(question);
        });
        
        console.log(`📚 Loaded ${this.faqQuestions.length} FAQ questions for related questions generation`);
    }

    extractKeywords(text, topK = 3) {
        // Simple keyword extraction using TF-IDF
        const tokens = new natural.WordTokenizer().tokenize(text.toLowerCase());
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
        
        const filteredTokens = tokens.filter(token => 
            token.length > 2 && !stopWords.has(token) && /^[a-zA-Z]+$/.test(token)
        );
        
        // Count frequency
        const frequency = {};
        filteredTokens.forEach(token => {
            frequency[token] = (frequency[token] || 0) + 1;
        });
        
        // Sort by frequency and return top K
        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, topK)
            .map(([word]) => word);
    }

    async getRelatedQuestions(userQuestion, topN = 3, topK = 3) {
        if (!this.initialized || this.faqQuestions.length === 0) {
            return [];
        }

        try {
            // Method 1: TF-IDF similarity
            const tfidfResults = this.getTFIDFRelatedQuestions(userQuestion, topN, topK);
            
            // Method 2: Semantic similarity (if model is available)
            let semanticResults = [];
            if (this.model) {
                semanticResults = await this.getSemanticRelatedQuestions(userQuestion, topN, topK);
            }
            
            // Combine and deduplicate results
            const combined = this.combineResults(tfidfResults, semanticResults, topN);
            
            return combined;
        } catch (error) {
            console.error('Error generating related questions:', error);
            return this.getTFIDFRelatedQuestions(userQuestion, topN, topK);
        }
    }

    getTFIDFRelatedQuestions(userQuestion, topN = 3, topK = 3) {
        // Calculate TF-IDF similarity
        const similarities = [];
        
        for (let i = 0; i < this.faqQuestions.length; i++) {
            const question = this.faqQuestions[i];
            const similarity = this.calculateTFIDFSimilarity(userQuestion, question);
            similarities.push({ index: i, similarity, question });
        }
        
        // Sort by similarity and get top N
        similarities.sort((a, b) => b.similarity - a.similarity);
        const topQuestions = similarities.slice(0, topN);
        
        // Extract keywords for each related question
        return topQuestions.map(item => ({
            question: item.question,
            keywords: this.extractKeywords(item.question, topK),
            similarity: item.similarity,
            method: 'tfidf'
        }));
    }

    async getSemanticRelatedQuestions(userQuestion, topN = 3, topK = 3) {
        try {
            // Get user question embedding
            const userEmbedding = await this.getEmbedding(userQuestion);
            
            // Calculate similarities with all FAQ questions
            const similarities = [];
            
            for (let i = 0; i < this.faqQuestions.length; i++) {
                const question = this.faqQuestions[i];
                const questionEmbedding = await this.getEmbedding(question);
                const similarity = this.cosineSimilarity(userEmbedding, questionEmbedding);
                
                similarities.push({ index: i, similarity, question });
            }
            
            // Sort by similarity and get top N
            similarities.sort((a, b) => b.similarity - a.similarity);
            const topQuestions = similarities.slice(0, topN);
            
            // Extract keywords for each related question
            return topQuestions.map(item => ({
                question: item.question,
                keywords: this.extractKeywords(item.question, topK),
                similarity: item.similarity,
                method: 'semantic'
            }));
        } catch (error) {
            console.error('Error in semantic related questions:', error);
            return [];
        }
    }

    async getEmbedding(text) {
        if (!this.model) {
            throw new Error('Model not initialized');
        }

        const output = await this.model(text, {
            pooling: 'mean',
            normalize: true
        });

        return Array.from(output.data);
    }

    cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (normA * normB);
    }

    calculateTFIDFSimilarity(text1, text2) {
        // Simple Jaccard similarity for TF-IDF
        const tokens1 = new Set(new natural.WordTokenizer().tokenize(text1.toLowerCase()));
        const tokens2 = new Set(new natural.WordTokenizer().tokenize(text2.toLowerCase()));
        
        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);
        
        return intersection.size / union.size;
    }

    combineResults(tfidfResults, semanticResults, topN) {
        // Combine results and remove duplicates
        const combined = [...tfidfResults, ...semanticResults];
        const seen = new Set();
        const unique = [];
        
        for (const item of combined) {
            if (!seen.has(item.question)) {
                seen.add(item.question);
                unique.push(item);
            }
        }
        
        // Sort by similarity and return top N
        unique.sort((a, b) => b.similarity - a.similarity);
        return unique.slice(0, topN);
    }

    generateRelatedQuestionsPrompt(relatedQuestions) {
        if (relatedQuestions.length === 0) {
            return null;
        }

        let prompt = "\n\n💡 Related questions you might find helpful:\n";
        
        relatedQuestions.forEach((item, index) => {
            prompt += `\n${index + 1}. ${item.question}`;
            if (item.keywords.length > 0) {
                prompt += `\n   Keywords: ${item.keywords.join(', ')}`;
            }
        });
        
        return prompt;
    }

    getStats() {
        return {
            initialized: this.initialized,
            faqCount: this.faqQuestions.length,
            modelLoaded: !!this.model
        };
    }
}

module.exports = RelatedQuestionsGenerator; 