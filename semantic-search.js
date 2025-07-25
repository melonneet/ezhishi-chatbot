import { pipeline } from '@xenova/transformers';

class SemanticSearch {
    constructor() {
        this.model = null;
        this.faqEmbeddings = [];
        this.faqs = [];
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🤖 Initializing semantic search with sentence transformers...');
            
            // Load the sentence transformer model
            this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            
            console.log('✅ Semantic search model loaded successfully');
            this.initialized = true;
        } catch (error) {
            console.error('❌ Error initializing semantic search:', error);
            this.initialized = false;
        }
    }

    async loadFAQs(faqs) {
        if (!this.initialized) {
            console.warn('⚠️ Semantic search not initialized, falling back to keyword matching');
            return;
        }

        this.faqs = faqs;
        console.log(`📚 Generating embeddings for ${faqs.length} FAQs...`);

        // Generate embeddings for all FAQs
        this.faqEmbeddings = await Promise.all(
            faqs.map(async (faq, index) => {
                try {
                    // Combine question and answer for better semantic understanding
                    const text = `${faq.questionEn} ${faq.answer}`;
                    const embedding = await this.getEmbedding(text);
                    
                    if (index % 10 === 0) {
                        console.log(`   Processed ${index + 1}/${faqs.length} FAQs`);
                    }
                    
                    return {
                        faq,
                        embedding,
                        index
                    };
                } catch (error) {
                    console.error(`Error processing FAQ ${index}:`, error);
                    return null;
                }
            })
        );

        this.faqEmbeddings = this.faqEmbeddings.filter(item => item !== null);
        console.log(`✅ Generated embeddings for ${this.faqEmbeddings.length} FAQs`);
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

    async semanticSearch(query, topK = 5) {
        if (!this.initialized || this.faqEmbeddings.length === 0) {
            console.warn('⚠️ Semantic search not available, using fallback');
            return this.fallbackSearch(query, topK);
        }

        try {
            // Expand abbreviations for better semantic matching
            const expandedQuery = this.expandAbbreviations(query);
            
            // Get query embedding using expanded query
            const queryEmbedding = await this.getEmbedding(expandedQuery);
            
            // Calculate cosine similarities
            const similarities = this.faqEmbeddings.map(({ faq, embedding, index }) => {
                const similarity = this.cosineSimilarity(queryEmbedding, embedding);
                return {
                    faq,
                    similarity,
                    index,
                    score: similarity
                };
            });

            // Sort by similarity and return top results
            return similarities
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK)
                .filter(result => result.similarity > 0.3); // Minimum similarity threshold

        } catch (error) {
            console.error('Error in semantic search:', error);
            return this.fallbackSearch(query, topK);
        }
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

    // Fallback to original keyword-based search
    fallbackSearch(query, topK = 5) {
        const queryLower = query.toLowerCase().trim();
        
        // Expand common abbreviations
        const expandedQuery = this.expandAbbreviations(queryLower);
        
        // Enhanced keyword mapping with semantic variations
        const semanticKeywordMap = {
            'login': ['login', 'log in', 'signin', 'sign in', 'access', 'cannot login', 'cant login', 'unable to login', 'login problem', 'sign on', 'authentication'],
            'password': ['password', 'pwd', 'passcode', 'forgot password', 'reset password', 'recover password', 'change password', 'new password', 'password expired', 'security code', 'pin'],
            'activate': ['activate', 'activation', 'active', 'activating', 'activated', 'not activated', 'enable', 'enabling', 'start', 'begin'],
            'refund': ['refund', 'money back', 'cancel', 'return', 'get money back', 'reimbursement', 'credit back'],
            'delivery': ['delivery', 'shipping', 'mail', 'address', 'receive', 'parcel', 'order', 'when will i receive', 'track order', 'shipment', 'postage'],
            'submit': ['submit', 'submission', 'contribute', 'article', 'essay', 'composition', 'send article', 'upload', 'send'],
            'pen': ['pen', 'learning pen', 'reading pen', 'etutorstar', 'et-901', 'pointing pen', 'scanning pen', 'smart pen', 'digital pen'],
            'subscribe': ['subscribe', 'subscription', 'renew', 'cancel subscription', 'magazine subscription', 'membership', 'renewal'],
            'points': ['points', 'rewards', 'reward points', 'redeem', 'earn points', 'check points', 'bonus', 'credits'],
            'app': ['app', 'application', 'etutorlearning', 'mobile', 'download', 'install app', 'software', 'program'],
            'account': ['account', 'profile', 'my account', 'account settings', 'user account', 'registration'],
            'help': ['help', 'support', 'assistance', 'problem', 'issue', 'trouble', 'guidance', 'aid'],
            'contact': ['contact', 'email', 'phone', 'call', 'reach', 'get in touch', 'message', 'communication']
        };

        // Check for semantic keyword matches
        let keywordBoost = {};
        Object.entries(semanticKeywordMap).forEach(([category, keywords]) => {
            const matchedKeywords = keywords.filter(kw => expandedQuery.includes(kw));
            if (matchedKeywords.length > 0) {
                keywordBoost[category] = Math.min(0.5, matchedKeywords.length * 0.15);
            }
        });

        // Calculate similarity scores
        const scoredFaqs = this.faqs.map(faq => {
            const englishScore = this.calculateSimilarity(expandedQuery, faq.questionEn);
            const chineseScore = this.calculateSimilarity(query, faq.questionZh || '');
            const categoryScore = this.calculateSimilarity(expandedQuery, faq.category) * 0.4;
            const answerScore = this.calculateSimilarity(expandedQuery, faq.answer) * 0.15;
            
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
                faq,
                score: totalScore,
                similarity: totalScore // For compatibility
            };
        });

        return scoredFaqs
            .filter(result => result.score > 0.1)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    expandAbbreviations(text) {
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

    calculateSimilarity(query, text) {
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

    // Get search statistics
    getStats() {
        return {
            initialized: this.initialized,
            faqCount: this.faqs.length,
            embeddingCount: this.faqEmbeddings.length,
            modelLoaded: !!this.model
        };
    }
}

export default SemanticSearch; 