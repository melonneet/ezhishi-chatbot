import { pipeline } from '@xenova/transformers';

class MyClassificationPipeline {
    constructor() {
        this.model = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🤖 Initializing sentence transformer model...');
            
            // Load a sentence transformer model for semantic similarity
            this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            
            console.log('✅ Sentence transformer model loaded successfully');
            this.initialized = true;
        } catch (error) {
            console.error('❌ Error initializing sentence transformer model:', error);
            this.initialized = false;
            throw error;
        }
    }

    async process(text, options = {}) {
        if (!this.initialized || !this.model) {
            throw new Error('Model not initialized');
        }

        try {
            const output = await this.model(text, options);
            return output;
        } catch (error) {
            console.error('❌ Error processing text with model:', error);
            throw error;
        }
    }

    getStats() {
        return {
            initialized: this.initialized,
            modelType: 'sentence-transformer',
            modelName: 'Xenova/all-MiniLM-L6-v2'
        };
    }

    // Singleton pattern
    static async getInstance() {
        if (!MyClassificationPipeline.instance) {
            MyClassificationPipeline.instance = new MyClassificationPipeline();
            await MyClassificationPipeline.instance.initialize();
        }
        return MyClassificationPipeline.instance;
    }
}

export default MyClassificationPipeline; 