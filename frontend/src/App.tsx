import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import './styles/App.css';

// Initialize socket only when a URL is provided (avoids errors on static hosts)
const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL as string | undefined;
const socket: Socket | null = SOCKET_URL ? io(SOCKET_URL) : null as any;

function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'settings'>('dashboard');
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    socket.on('new-email', (email) => {
      setNotification(`📬 New email: ${email.subject.substring(0, 50)}`);
      setTimeout(() => setNotification(null), 5000);
    });

    return () => {
      socket?.off('new-email');
    };
  }, []);

  return (
    <div className="app app-shell">
      <aside className="nav-rail">
        <div className="brand">
          <span className="brand-icon">📮</span>
          <span className="brand-name">Onebox</span>
        </div>
        <div className="nav-group">
          <button
            className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
            title="Dashboard"
          >
            <span className="nav-emoji">📊</span>
            <span className="nav-label">Dashboard</span>
          </button>
          <button
            className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('settings')}
            title="Settings"
          >
            <span className="nav-emoji">⚙️</span>
            <span className="nav-label">Settings</span>
          </button>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <h1 className="topbar-title">ReachInbox Onebox</h1>
        </header>

        {notification && (
          <div className="notification floating">
            {notification}
          </div>
        )}

        <main className="workspace">
          {currentPage === 'dashboard' ? <Dashboard /> : <Settings />}
        </main>
      </div>
    </div>
  );
}

export default App;