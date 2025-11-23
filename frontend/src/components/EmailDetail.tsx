import { useState } from 'react';
import SuggestedReply from './SuggestedReply';
import { Email } from '../types';

interface Props {
  email: Email;
}

// Helper function to format plain text email body
const formatPlainText = (text: string): string => {
  if (!text) return '';
  
  // Convert line breaks to <br> tags
  return text
    .split('\n')
    .map((line, index) => {
      // Handle quoted text (common in email replies)
      if (line.trim().startsWith('>')) {
        return `<div class="email-quote">${line}</div>`;
      }
      // Handle empty lines
      if (line.trim() === '') {
        return '<br>';
      }
      return line;
    })
    .join('\n');
};

// Helper function to sanitize and format HTML email
const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove potentially dangerous elements
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form'];
  dangerousTags.forEach(tag => {
    const elements = tempDiv.getElementsByTagName(tag);
    while (elements.length > 0) {
      elements[0].parentNode?.removeChild(elements[0]);
    }
  });
  
  // Remove inline styles that might break layout
  const allElements = tempDiv.getElementsByTagName('*');
  Array.from(allElements).forEach(el => {
    const element = el as HTMLElement;
    // Keep only safe styles
    if (element.style) {
      const safeStyles = ['color', 'font-weight', 'text-decoration'];
      const currentStyle = element.getAttribute('style') || '';
      const newStyle = safeStyles
        .map(prop => {
          const match = currentStyle.match(new RegExp(`${prop}:\\s*[^;]+`, 'i'));
          return match ? match[0] : '';
        })
        .filter(Boolean)
        .join('; ');
      element.setAttribute('style', newStyle || '');
    }
  });
  
  return tempDiv.innerHTML;
};

// Helper to extract name from email address
const extractName = (emailString: string): string => {
  if (!emailString) return 'Unknown';
  
  // Try to extract name from "Name <email@example.com>" format
  const match = emailString.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return match[1].trim().replace(/['"]/g, '');
  }
  
  // If no name, return email address
  return emailString;
};

const EmailDetail: React.FC<Props> = ({ email }) => {
  const [showReply, setShowReply] = useState(false);

  const formattedDate = new Date(email.date).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const emailBody = email.html 
    ? sanitizeHtml(email.html) 
    : formatPlainText(email.body || '');

  return (
    <div className="email-detail">
      <div className="email-detail-header">
        <h2>{email.subject || '(No Subject)'}</h2>
        <span className={`category-badge ${email.category?.toLowerCase().replace(/ /g, '-') || 'uncategorized'}`}>
          {email.category || 'Uncategorized'}
        </span>
      </div>

      <div className="email-meta">
        <div className="meta-item">
          <span className="meta-label">From:</span>
          <span className="meta-value" title={email.from}>
            {extractName(email.from)}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">To:</span>
          <span className="meta-value" title={email.to?.join(', ') || ''}>
            {email.to && email.to.length > 0 
              ? email.to.length === 1 
                ? extractName(email.to[0]) 
                : `${extractName(email.to[0])} +${email.to.length - 1} more`
              : 'N/A'}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Date:</span>
          <span className="meta-value">{formattedDate}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Account:</span>
          <span className="meta-value" title={email.account}>{email.account}</span>
        </div>
      </div>

      <div className="email-body">
        {email.html ? (
          <div 
            className="email-html-content"
            dangerouslySetInnerHTML={{ __html: emailBody }} 
          />
        ) : (
          <div 
            className="email-text-content"
            dangerouslySetInnerHTML={{ __html: emailBody }} 
          />
        )}
        {(!email.body && !email.html) && (
          <div className="email-empty">
            <p>📭 This email has no content</p>
          </div>
        )}
      </div>

      {email.attachments && email.attachments.length > 0 && (
        <div className="attachments">
          <h4>📎 Attachments ({email.attachments.length})</h4>
          <div className="attachments-list">
            {email.attachments.map((att, idx) => (
              <div key={idx} className="attachment">
                <span className="attachment-icon">📎</span>
                <div className="attachment-info">
                  <span className="attachment-name">{att.filename || 'Unknown file'}</span>
                  <span className="attachment-size">
                    {att.size > 1024 * 1024 
                      ? `${(att.size / (1024 * 1024)).toFixed(2)} MB`
                      : `${Math.round(att.size / 1024)} KB`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="actions">
        <button onClick={() => setShowReply(!showReply)}>
          {showReply ? '✖️ Hide' : '🤖 Show'} AI Suggested Reply
        </button>
      </div>

      {showReply && <SuggestedReply emailId={email._id} />}
    </div>
  );
};

export default EmailDetail;