// EZhishi Configuration
window.EZhishiConfig = {
    // API base URL - defaults to current origin
    getApiUrl: function() {
        return '';
    },
    
    // Get current API URL
    getCurrentApiUrl: function() {
        return window.location.origin + this.getApiUrl();
    },
    
    // Version info
    version: '1.0.0',
    
    // Default settings
    settings: {
        enableCustomerProfile: true,
        enableAnalytics: true,
        enableSessions: true,
        maxRelatedQuestions: 3,
        maxSearchResults: 5
    }
};

// Utility functions
window.EZhishiUtils = {
    // Format date
    formatDate: function(date) {
        return new Date(date).toLocaleString();
    },
    
    // Truncate text
    truncateText: function(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },
    
    // Escape HTML
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Show loading
    showLoading: function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '<div class="loading">Loading...</div>';
        }
    },
    
    // Show error
    showError: function(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div class="error">❌ ${message}</div>`;
        }
    },
    
    // Show success
    showSuccess: function(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div class="success">✅ ${message}</div>`;
        }
    }
};

// Common styles
const commonStyles = `
    .loading {
        text-align: center;
        padding: 20px;
        color: #666;
    }
    
    .error {
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        padding: 10px;
        border-radius: 5px;
        margin: 10px 0;
    }
    
    .success {
        color: #155724;
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        padding: 10px;
        border-radius: 5px;
        margin: 10px 0;
    }
    
    .table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
    }
    
    .table th,
    .table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
    }
    
    .table th {
        background-color: #f8f9fa;
        font-weight: bold;
    }
    
    .table tr:hover {
        background-color: #f5f5f5;
    }
    
    .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        text-decoration: none;
        display: inline-block;
    }
    
    .btn-primary {
        background-color: #007bff;
        color: white;
    }
    
    .btn-primary:hover {
        background-color: #0056b3;
    }
    
    .btn-secondary {
        background-color: #6c757d;
        color: white;
    }
    
    .btn-secondary:hover {
        background-color: #545b62;
    }
    
    .faq-item {
        border: 1px solid #ddd;
        margin: 15px 0;
        padding: 20px;
        border-radius: 8px;
        background-color: #f9f9f9;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .faq-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
    }
    
    .faq-number {
        background-color: #007bff;
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
    }
    
    .faq-category {
        font-size: 12px;
        color: #666;
        background-color: #e9ecef;
        padding: 4px 8px;
        border-radius: 4px;
    }
    
    .faq-question {
        font-weight: bold;
        margin-bottom: 8px;
        color: #333;
        font-size: 16px;
    }
    
    .faq-question-zh {
        font-style: italic;
        margin-bottom: 12px;
        color: #666;
        font-size: 14px;
    }
    
    .faq-answer {
        color: #555;
        line-height: 1.6;
        margin-bottom: 8px;
    }
    
    .faq-answer-length {
        text-align: right;
        color: #999;
        font-size: 11px;
    }
    
    .category-section {
        margin: 30px 0;
        padding: 20px;
        border: 2px solid #e9ecef;
        border-radius: 8px;
        background-color: white;
    }
    
    .category-section h4 {
        color: #333;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #007bff;
    }
    
    .faq-summary {
        background-color: #e3f2fd;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 30px;
        border-left: 4px solid #2196f3;
    }
    
    .faq-summary h3 {
        color: #1976d2;
        margin-bottom: 15px;
    }
    
    .dashboard-section {
        background-color: white;
        padding: 20px;
        margin: 15px 0;
        border-radius: 8px;
        border: 1px solid #e9ecef;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .dashboard-section h3 {
        color: #333;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #007bff;
    }
    
    .category-list {
        list-style: none;
        padding: 0;
    }
    
    .category-list li {
        padding: 8px 0;
        border-bottom: 1px solid #eee;
    }
    
    .category-list li:last-child {
        border-bottom: none;
    }
`;

// Inject common styles
if (!document.getElementById('ezhishi-common-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'ezhishi-common-styles';
    styleElement.textContent = commonStyles;
    document.head.appendChild(styleElement);
} 