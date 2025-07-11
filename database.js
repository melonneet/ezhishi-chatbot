const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'data', 'chat_records.db'));
        this.init();
    }

    init() {
        // Create chat_sessions table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                user_ip TEXT,
                user_agent TEXT,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ended_at DATETIME,
                total_messages INTEGER DEFAULT 0,
                customer_email TEXT,
                customer_name TEXT
            )
        `);

        // Create chat_messages table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                message_type TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
            )
        `);

        // Create question_analytics table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS question_analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                category TEXT,
                times_asked INTEGER DEFAULT 1,
                last_asked DATETIME DEFAULT CURRENT_TIMESTAMP,
                was_answered BOOLEAN DEFAULT 1,
                session_id TEXT,
                customer_email TEXT
            )
        `);

        // Create customer_profiles table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS customer_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                name TEXT,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_contact DATETIME,
                total_sessions INTEGER DEFAULT 0
            )
        `);

        console.log('Database tables created');
    }

    // Create new chat session
    async createSession(sessionId, userIp, userAgent, customerEmail = null, customerName = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO chat_sessions (session_id, user_ip, user_agent, customer_email, customer_name) VALUES (?, ?, ?, ?, ?)',
                [sessionId, userIp, userAgent, customerEmail, customerName],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // End chat session
    async endSession(sessionId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE chat_sessions SET ended_at = CURRENT_TIMESTAMP WHERE session_id = ?',
                [sessionId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // Save chat message
    async saveMessage(sessionId, messageType, message) {
        return new Promise((resolve, reject) => {
            const self = this;
            self.db.run(
                'INSERT INTO chat_messages (session_id, message_type, message) VALUES (?, ?, ?)',
                [sessionId, messageType, message],
                function(err) {
                    if (err) reject(err);
                    else {
                        // Update total messages count
                        self.db.run(
                            'UPDATE chat_sessions SET total_messages = total_messages + 1 WHERE session_id = ?',
                            [sessionId]
                        );
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    // Track question analytics
    async trackQuestion(question, category, wasAnswered, sessionId = null, customerEmail = null) {
        return new Promise((resolve, reject) => {
            // Check if question already exists
            this.db.get(
                'SELECT * FROM question_analytics WHERE question = ?',
                [question],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        // Update existing question
                        this.db.run(
                            'UPDATE question_analytics SET times_asked = times_asked + 1, last_asked = CURRENT_TIMESTAMP, was_answered = ? WHERE id = ?',
                            [wasAnswered, row.id],
                            function(err) {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    } else {
                        // Insert new question
                        this.db.run(
                            'INSERT INTO question_analytics (question, category, was_answered, session_id, customer_email) VALUES (?, ?, ?, ?, ?)',
                            [question, category, wasAnswered, sessionId, customerEmail],
                            function(err) {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    }
                }
            );
        });
    }

    // Get chat history for a session
    async getChatHistory(sessionId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp',
                [sessionId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Get all sessions (for admin)
    async getAllSessions(limit = 100, offset = 0) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM chat_sessions ORDER BY started_at DESC LIMIT ? OFFSET ?',
                [limit, offset],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Get question analytics (for admin)
    async getQuestionAnalytics() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM question_analytics ORDER BY times_asked DESC',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Get customer profile
    async getCustomerProfile(email) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM customer_profiles WHERE email = ?',
                [email],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Create or update customer profile
    async updateCustomerProfile(email, name, phone) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO customer_profiles (email, name, phone, last_contact) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                [email, name, phone],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // Get customer chat history
    async getCustomerChatHistory(email) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT cs.*, COUNT(cm.id) as message_count FROM chat_sessions cs LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id WHERE cs.customer_email = ? GROUP BY cs.session_id ORDER BY cs.started_at DESC',
                [email],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Get all customers
    async getAllCustomers() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT cp.*, COUNT(cs.id) as total_sessions FROM customer_profiles cp LEFT JOIN chat_sessions cs ON cp.email = cs.customer_email GROUP BY cp.email ORDER BY cp.last_contact DESC',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Get average session time
    async getAverageSessionTime() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT AVG((julianday(ended_at) - julianday(started_at)) * 24 * 60) as avg_minutes FROM chat_sessions WHERE ended_at IS NOT NULL',
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.avg_minutes : 0);
                }
            );
        });
    }

    // Close database connection
    close() {
        this.db.close();
    }
}

module.exports = new Database();