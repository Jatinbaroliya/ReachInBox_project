import React, { useState } from 'react';
import SuggestedReply from './SuggestedReply';
import { Email } from '../types';

interface Props {
  email: Email;
}

const EmailDetail: React.FC<Props> = ({ email }) => {
  const [showReply, setShowReply] = useState(false);

  return (
    <div className="email-detail">
      <div className="email-detail-header">
        <h2>{email.subject}</h2>
        <span className={`category-badge ${email.category?.toLowerCase().replace(/ /g, '-')}`}>
          {email.category || 'Uncategorized'}
        </span>
      </div>

      <div className="email-meta">
        <div><strong>From:</strong> {email.from}</div>
        <div><strong>To:</strong> {email.to.join(', ')}</div>
        <div><strong>Date:</strong> {new Date(email.date).toLocaleString()}</div>
        <div><strong>Account:</strong> {email.account}</div>
      </div>

      <div className="email-body">
        {email.html ? (
          <div dangerouslySetInnerHTML={{ __html: email.html }} />
        ) : (
          <pre>{email.body}</pre>
        )}
      </div>

      {email.attachments && email.attachments.length > 0 && (
        <div className="attachments">
          <h4>Attachments ({email.attachments.length})</h4>
          {email.attachments.map((att, idx) => (
            <div key={idx} className="attachment">
              📎 {att.filename} ({Math.round(att.size / 1024)} KB)
            </div>
          ))}
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