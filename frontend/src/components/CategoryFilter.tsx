import React from 'react';

interface Props {
  selected: string;
  onChange: (category: string) => void;
}

const CategoryFilter: React.FC<Props> = ({ selected, onChange }) => {
  const categories = [
    { id: 'all', label: '📧 All', icon: '📧' },
    { id: 'Interested', label: '🎯 Interested', icon: '🎯' },
    { id: 'Meeting Booked', label: '📅 Meeting Booked', icon: '📅' },
    { id: 'Not Interested', label: '❌ Not Interested', icon: '❌' },
    { id: 'Spam', label: '🗑️ Spam', icon: '🗑️' },
    { id: 'Out of Office', label: '🏖️ Out of Office', icon: '🏖️' }
  ];

  return (
    <div className="category-filter">
      <h3>Categories</h3>
      <div className="categories-row">
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`category-btn ${selected === cat.id ? 'active' : ''}`}
            onClick={() => onChange(cat.id)}
            aria-pressed={selected === cat.id}
          >
            <span>{cat.icon}</span>
            <span>{cat.id === 'all' ? 'All' : cat.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilter;