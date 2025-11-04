import React, { useState, useEffect } from 'react';
import EmailList from '../components/EmailList';
import EmailDetail from '../components/EmailDetail';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import { Email } from '../types';
import { fetchEmails, searchEmails } from '../services/api';

const Dashboard: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadEmails();
  }, [selectedCategory]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      const data = await fetchEmails(params);
      setEmails(data);
    } catch (error) {
      console.error('Error loading emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query) {
      loadEmails();
      return;
    }

    setLoading(true);
    try {
      const results = await searchEmails(query);
      setEmails(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="sidebar">
        <SearchBar onSearch={handleSearch} />
        <CategoryFilter
          selected={selectedCategory}
          onChange={setSelectedCategory}
        />
        <EmailList
          emails={emails}
          onSelectEmail={setSelectedEmail}
          selectedEmail={selectedEmail}
          loading={loading}
        />
      </div>

      <div className="main-content">
        {selectedEmail ? (
          <EmailDetail email={selectedEmail} />
        ) : (
          <div className="no-selection">
            <p>📧 Select an email to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;