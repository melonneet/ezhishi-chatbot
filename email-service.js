const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      console.log('✅ Email service initialized with:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER ? 'configured' : 'not configured'
      });
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      this.transporter = null;
    }
  }

  async sendEmail(to, subject, html, text = null) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP credentials not configured');
    }

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  async sendContactFormEmail(customerName, customerEmail, subject, message) {
    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${customerName}</p>
      <p><strong>Email:</strong> ${customerEmail}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
      <hr>
      <p><small>Sent from eZhishi Chatbot at ${new Date().toLocaleString()}</small></p>
    `;

    return this.sendEmail(
      'service@ecombay.com',
      `Contact Form: ${subject}`,
      html
    );
  }

  async sendNotificationEmail(to, subject, message) {
    const html = `
      <h2>eZhishi Notification</h2>
      <p>${message}</p>
      <hr>
      <p><small>Sent from eZhishi Chatbot at ${new Date().toLocaleString()}</small></p>
    `;

    return this.sendEmail(to, subject, html);
  }

  isConfigured() {
    return this.transporter !== null && 
           process.env.SMTP_USER && 
           process.env.SMTP_PASS;
  }
}

module.exports = new EmailService(); 