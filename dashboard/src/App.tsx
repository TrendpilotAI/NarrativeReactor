import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { PipelinePage } from './pages/Pipeline';
import { DraftsPage } from './pages/Drafts';
import { DraftDetailPage } from './pages/DraftDetail';
import { PublishPage } from './pages/Publish';
import { QueuePage } from './pages/Queue';
import { LoginPage } from './pages/Login';
import './App.css';

function AuthenticatedApp() {
  const { authenticated, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p className="loading">Loading…</p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <h1 className="logo">🧪 NarrativeReactor</h1>
        <NavLink to="/" end>📝 Generate</NavLink>
        <NavLink to="/drafts">📄 Drafts</NavLink>
        <NavLink to="/publish">🚀 Publish</NavLink>
        <NavLink to="/queue">📋 Queue</NavLink>
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #334155' }}>
          <button
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 14,
              padding: '10px 12px',
              width: '100%',
              textAlign: 'left',
              borderRadius: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            🚪 Sign out
          </button>
        </div>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<PipelinePage />} />
          <Route path="/drafts" element={<DraftsPage />} />
          <Route path="/drafts/:id" element={<DraftDetailPage />} />
          <Route path="/publish" element={<PublishPage />} />
          <Route path="/queue" element={<QueuePage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
