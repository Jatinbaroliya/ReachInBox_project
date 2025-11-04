import React, { useState, useEffect } from 'react';
import { getSuggestedReply } from '../services/api';

interface Props {
  emailId: string;
}

const SuggestedReply: React.FC<Props> = ({ emailId }) => {
  const [reply, setReply] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestedReply();
  }, [emailId]);

  const loadSuggestedReply = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSuggestedReply(emailId);
      setReply(data.reply);
    } catch (err) {
      setError('Unable to generate reply');
      console.error('Error loading suggested reply:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(reply);
    alert('Copied to clipboard!');
  };

  return (
    <div className="suggested-reply">
      <h3>🤖 AI-Suggested Reply (RAG-Powered)</h3>
      {loading ? (
        <p>Generating reply...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="reply-content">
          <pre>{reply}</pre>
          <button onClick={copyToClipboard}>📋 Copy to Clipboard</button>
        </div>
      )}
    </div>
  );
};

export default SuggestedReply;