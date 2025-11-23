 
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
              <span className="from" title={email.from}>
                {email.from?.includes('<') 
                  ? email.from.split('<')[0].trim().replace(/['"]/g, '') || email.from.split('<')[1]?.replace('>', '') || 'Unknown'
                  : email.from || 'Unknown'}
              </span>
            </div>
            <div className="subject" title={email.subject}>
              {email.subject || '(No Subject)'}
            </div>
            <div className="preview" title={email.body}>
              {email.body 
                ? (email.body.length > 80 ? `${email.body.substring(0, 80)}...` : email.body)
                : '(No preview available)'}
            </div>
            <div className="date" title={new Date(email.date).toLocaleString()}>
              {new Date(email.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: new Date(email.date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default EmailList;