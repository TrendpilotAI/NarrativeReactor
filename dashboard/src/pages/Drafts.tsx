import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listDrafts } from '../api';

export function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await listDrafts(filter || undefined);
      setDrafts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div>
      <h2>📄 Content Drafts</h2>

      <div className="tabs">
        {['', 'draft', 'approved', 'rejected', 'published'].map(s => (
          <button
            key={s}
            className={`tab ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading && <p className="loading">Loading drafts...</p>}
      {error && <p className="error">❌ {error}</p>}

      {!loading && drafts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: '#64748b' }}>
          No drafts found. <Link to="/" style={{ color: '#818cf8' }}>Generate some content</Link>
        </div>
      )}

      {drafts.map(d => (
        <Link to={`/drafts/${d.id}`} key={d.id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card" style={{ cursor: 'pointer' }}>
            <div className="flex gap-4" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong>{d.topic}</strong>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                  {new Date(d.createdAt).toLocaleString()} · {d.id.slice(0, 8)}
                </div>
              </div>
              <span className={`badge badge-${d.status}`}>{d.status}</span>
            </div>
          </div>
        </Link>
      ))}

      <button className="btn btn-secondary mt-4" onClick={load}>🔄 Refresh</button>
    </div>
  );
}
