const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Load JSON FAQ data
function loadFAQs() {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', 'faqs_updated.json'), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading FAQs:', error);
        return [];
    }
}

// Access SQLite database
function getDatabase() {
    return new sqlite3.Database(path.join(__dirname, 'data', 'chat_records.db'));
}

// 1. View all FAQs
function viewAllFAQs() {
    const faqs = loadFAQs();
    console.log(`📚 Total FAQs: ${faqs.length}`);
    console.log('\n=== All FAQs ===');
    faqs.forEach((faq, index) => {
        console.log(`${index + 1}. [${faq.category}] ${faq.questionEn}`);
        console.log(`   Answer: ${faq.answer.substring(0, 100)}...`);
        console.log('');
    });
}

// 2. Search FAQs by category
function searchByCategory(category) {
    const faqs = loadFAQs();
    const filtered = faqs.filter(faq => 
        faq.category.toLowerCase().includes(category.toLowerCase())
    );
    
    console.log(`🔍 Found ${filtered.length} FAQs in category "${category}":`);
    filtered.forEach((faq, index) => {
        console.log(`${index + 1}. ${faq.questionEn}`);
        console.log(`   Answer: ${faq.answer.substring(0, 100)}...`);
        console.log('');
    });
}

// 3. Search FAQs by keyword
function searchByKeyword(keyword) {
    const faqs = loadFAQs();
    const filtered = faqs.filter(faq => 
        faq.questionEn.toLowerCase().includes(keyword.toLowerCase()) ||
        faq.answer.toLowerCase().includes(keyword.toLowerCase())
    );
    
    console.log(`🔍 Found ${filtered.length} FAQs containing "${keyword}":`);
    filtered.forEach((faq, index) => {
        console.log(`${index + 1}. [${faq.category}] ${faq.questionEn}`);
        console.log(`   Answer: ${faq.answer.substring(0, 100)}...`);
        console.log('');
    });
}

// 4. Get all categories
function getAllCategories() {
    const faqs = loadFAQs();
    const categories = [...new Set(faqs.map(faq => faq.category))];
    
    console.log('📂 All Categories:');
    categories.forEach((category, index) => {
        const count = faqs.filter(faq => faq.category === category).length;
        console.log(`${index + 1}. ${category} (${count} FAQs)`);
    });
}

// 5. View chat sessions from SQLite
function viewChatSessions() {
    const db = getDatabase();
    
    db.all("SELECT * FROM chat_sessions ORDER BY started_at DESC LIMIT 10", (err, rows) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        console.log('💬 Recent Chat Sessions:');
        rows.forEach((session, index) => {
            console.log(`${index + 1}. Session: ${session.session_id}`);
            console.log(`   Started: ${session.started_at}`);
            console.log(`   Messages: ${session.total_messages}`);
            console.log(`   IP: ${session.user_ip}`);
            console.log('');
        });
        
        db.close();
    });
}

// 6. View chat messages for a session
function viewChatMessages(sessionId) {
    const db = getDatabase();
    
    db.all("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp", [sessionId], (err, rows) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        console.log(`💬 Chat Messages for Session: ${sessionId}`);
        rows.forEach((message, index) => {
            console.log(`${index + 1}. [${message.message_type}] ${message.timestamp}`);
            console.log(`   ${message.message}`);
            console.log('');
        });
        
        db.close();
    });
}

// 7. View question analytics
function viewQuestionAnalytics() {
    const db = getDatabase();
    
    db.all("SELECT * FROM question_analytics ORDER BY times_asked DESC LIMIT 20", (err, rows) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        console.log('📊 Question Analytics (Top 20):');
        rows.forEach((question, index) => {
            console.log(`${index + 1}. "${question.question}"`);
            console.log(`   Asked: ${question.times_asked} times`);
            console.log(`   Category: ${question.category || 'N/A'}`);
            console.log(`   Last asked: ${question.last_asked}`);
            console.log('');
        });
        
        db.close();
    });
}

// 8. Add new FAQ
function addNewFAQ(category, questionEn, questionZh, answer) {
    const faqs = loadFAQs();
    const newFAQ = {
        category,
        questionEn,
        questionZh,
        answer
    };
    
    faqs.push(newFAQ);
    
    try {
        fs.writeFileSync(
            path.join(__dirname, 'data', 'faqs_updated.json'), 
            JSON.stringify(faqs, null, 2)
        );
        console.log('✅ New FAQ added successfully!');
    } catch (error) {
        console.error('Error adding FAQ:', error);
    }
}

// 9. Export FAQs to CSV
function exportToCSV() {
    const faqs = loadFAQs();
    let csv = 'Category,Question (English),Question (Chinese),Answer\n';
    
    faqs.forEach(faq => {
        const escapedAnswer = faq.answer.replace(/"/g, '""');
        csv += `"${faq.category}","${faq.questionEn}","${faq.questionZh}","${escapedAnswer}"\n`;
    });
    
    fs.writeFileSync(path.join(__dirname, 'data', 'faqs_export.csv'), csv);
    console.log('✅ FAQs exported to data/faqs_export.csv');
}

// Command line interface
function main() {
    const command = process.argv[2];
    const arg1 = process.argv[3];
    const arg2 = process.argv[4];
    const arg3 = process.argv[5];
    const arg4 = process.argv[6];
    
    switch (command) {
        case 'view-all':
            viewAllFAQs();
            break;
        case 'categories':
            getAllCategories();
            break;
        case 'search-category':
            if (!arg1) {
                console.log('Usage: node database-access.js search-category <category>');
                return;
            }
            searchByCategory(arg1);
            break;
        case 'search-keyword':
            if (!arg1) {
                console.log('Usage: node database-access.js search-keyword <keyword>');
                return;
            }
            searchByKeyword(arg1);
            break;
        case 'chat-sessions':
            viewChatSessions();
            break;
        case 'chat-messages':
            if (!arg1) {
                console.log('Usage: node database-access.js chat-messages <session-id>');
                return;
            }
            viewChatMessages(arg1);
            break;
        case 'analytics':
            viewQuestionAnalytics();
            break;
        case 'add-faq':
            if (!arg1 || !arg2 || !arg3 || !arg4) {
                console.log('Usage: node database-access.js add-faq <category> <question-en> <question-zh> <answer>');
                return;
            }
            addNewFAQ(arg1, arg2, arg3, arg4);
            break;
        case 'export-csv':
            exportToCSV();
            break;
        default:
            console.log(`
📊 eZhishi Database Access Tool

Usage:
  node database-access.js <command> [arguments]

Commands:
  view-all                    - View all FAQs
  categories                  - List all categories
  search-category <category>  - Search FAQs by category
  search-keyword <keyword>    - Search FAQs by keyword
  chat-sessions              - View recent chat sessions
  chat-messages <session-id> - View messages for a session
  analytics                  - View question analytics
  add-faq <cat> <q-en> <q-zh> <answer> - Add new FAQ
  export-csv                 - Export FAQs to CSV

Examples:
  node database-access.js view-all
  node database-access.js search-category "账号相关问题"
  node database-access.js search-keyword "password"
  node database-access.js chat-sessions
  node database-access.js analytics
            `);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    loadFAQs,
    getDatabase,
    viewAllFAQs,
    searchByCategory,
    searchByKeyword,
    getAllCategories,
    viewChatSessions,
    viewChatMessages,
    viewQuestionAnalytics,
    addNewFAQ,
    exportToCSV
}; 