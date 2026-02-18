import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { PipelinePage } from './pages/Pipeline';
import { DraftsPage } from './pages/Drafts';
import { DraftDetailPage } from './pages/DraftDetail';
import { PublishPage } from './pages/Publish';
import { QueuePage } from './pages/Queue';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="sidebar">
          <h1 className="logo">🧪 NarrativeReactor</h1>
          <NavLink to="/" end>📝 Generate</NavLink>
          <NavLink to="/drafts">📄 Drafts</NavLink>
          <NavLink to="/publish">🚀 Publish</NavLink>
          <NavLink to="/queue">📋 Queue</NavLink>
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
    </BrowserRouter>
  );
}

export default App;
