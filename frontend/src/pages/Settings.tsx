import React from 'react';

const Settings: React.FC = () => {
  return (
    <div className="settings">
      <h2>⚙️ Settings</h2>
      <div className="settings-section">
        <h3>API Configuration</h3>
        <p>Configure your email accounts and API keys in the .env file</p>
        <ul>
          <li>IMAP_ACCOUNTS - Email addresses (comma separated)</li>
          <li>OPENAI_API_KEY - Your OpenAI API key</li>
          <li>SLACK_WEBHOOK_URL - Slack integration</li>
          <li>EXTERNAL_WEBHOOK_URL - External automation webhook</li>
        </ul>
      </div>

      <div className="settings-section">
        <h3>Email Accounts</h3>
        <p>Currently connected accounts will appear here</p>
      </div>

      <div className="settings-section">
        <h3>Integrations</h3>
        <ul>
          <li>✅ Slack - Sends notifications for Interested emails</li>
          <li>✅ Webhooks - Triggers external automation</li>
          <li>✅ OpenAI - AI categorization and suggested replies</li>
          <li>✅ Elasticsearch - Email search and indexing</li>
          <li>✅ MongoDB - Email storage</li>
        </ul>
      </div>
    </div>
  );
};

export default Settings;