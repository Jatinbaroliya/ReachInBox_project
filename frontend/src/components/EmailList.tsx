import React from 'react';
import { Email } from '../types';

interface Props {
  emails: Email[];
  onSelectEmail: (email: Email) => void;
  selectedEmail: Email | null;
  loading?: boolean;
}

const EmailList: React.FC<Props> = ({ emails, onSelectEmail, selectedEmail, loading }) => {
  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'Interested': return '🎯';
      case 'Meeting Booked': return '📅';
      case 'Not Interested': return '❌';
      case 'Spam': return '🗑️';
      case 'Out of Office': return '🏖️';
      default: return '📧';
    }
  };

  return (
    <div className="email-list">
      {loading ? (
        <p>Loading emails...</p>
      ) : emails.length === 0 ? (
        <p>No emails found</p>
      ) : (
        emails.map(email => (
          <div
            key={email._id}
            className={`email-item ${selectedEmail?._id === email._id ? 'selected' : ''}`}
            onClick={() => onSelectEmail(email)}
          >
            <div className="email-header">
              <span className="category-icon">{getCategoryIcon(email.category)}</span>
              <span className="from">{email.from}</span>
            </div>
            <div className="subject">{email.subject}</div>
            <div className="preview">{email.body.substring(0, 80)}...</div>
            <div className="date">{new Date(email.date).toLocaleDateString()}</div>
          </div>
        ))
      )}
    </div>
  );
};

export default EmailList;