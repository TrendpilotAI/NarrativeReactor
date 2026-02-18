import { useState, useEffect } from 'react';
import { listAccounts, publishDirect } from '../api';

const PLATFORMS = ['x', 'linkedin', 'threads', 'bluesky', 'facebook', 'instagram'];

export function PublishPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listAccounts().then(setAccounts).catch(() => {});
  }, []);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handlePublish = async () => {
    if (!content.trim() || selectedPlatforms.length === 0) return;
    setPublishing(true);
    setError('');
    setResult(null);
    try {
      const res = await publishDirect(content, selectedPlatforms);
      setResult(res);
      setContent('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <h2>🚀 Quick Publish</h2>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Publish content directly to connected platforms via Blotato.
      </p>

      {accounts.length > 0 && (
        <div className="card">
          <h4 style={{ marginBottom: 8 }}>Connected Accounts</h4>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {accounts.map((a: any, i: number) => (
              <span key={i} className="badge badge-approved">{a.platform} — {a.name || a.id}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="form-group">
          <label>Content *</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your post content here..."
            style={{ minHeight: 150 }}
          />
        </div>

        <div className="form-group">
          <label>Platforms *</label>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {PLATFORMS.map(p => (
              <span
                key={p}
                className={`chip ${selectedPlatforms.includes(p) ? 'selected' : ''}`}
                onClick={() => togglePlatform(p)}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handlePublish}
          disabled={publishing || !content.trim() || selectedPlatforms.length === 0}
        >
          {publishing ? '⏳ Publishing...' : `Publish to ${selectedPlatforms.length} platform(s)`}
        </button>
      </div>

      {error && <p className="error">❌ {error}</p>}

      {result && (
        <div className="card" style={{ borderColor: '#166534' }}>
          <h4>✅ Published Successfully</h4>
          <pre style={{ color: '#86efac', fontSize: 13, marginTop: 8 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
