import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDraft, approveDraft, rejectDraft, updateDraftContent, publishDraft } from '../api';

const FORMAT_LABELS = {
  xThread: '🐦 X Thread',
  linkedinPost: '💼 LinkedIn Post',
  blogArticle: '📝 Blog Article',
} as const;

type Format = keyof typeof FORMAT_LABELS;

const PLATFORMS = ['x', 'linkedin', 'threads', 'bluesky', 'facebook', 'instagram'];

export function DraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Format>('xThread');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['x']);

  useEffect(() => {
    if (!id) return;
    getDraft(id).then(setDraft).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    try {
      const updated = await approveDraft(id!);
      setDraft(updated);
    } catch (e: any) { setError(e.message); }
  };

  const handleReject = async () => {
    if (!feedback.trim()) return;
    try {
      const updated = await rejectDraft(id!, feedback);
      setDraft(updated);
      setFeedback('');
    } catch (e: any) { setError(e.message); }
  };

  const handleSave = async () => {
    try {
      const updated = await updateDraftContent(id!, activeTab, editContent);
      setDraft(updated);
      setEditing(false);
    } catch (e: any) { setError(e.message); }
  };

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) return;
    setPublishing(true);
    try {
      await publishDraft(id!, selectedPlatforms, activeTab);
      const updated = await getDraft(id!);
      setDraft(updated);
    } catch (e: any) { setError(e.message); }
    finally { setPublishing(false); }
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  if (loading) return <p className="loading">Loading...</p>;
  if (!draft) return <p className="error">Draft not found</p>;

  return (
    <div>
      <button className="btn btn-secondary mb-4" onClick={() => navigate('/drafts')}>← Back</button>
      <h2>{draft.topic}</h2>
      <div className="flex gap-2 mb-4" style={{ alignItems: 'center' }}>
        <span className={`badge badge-${draft.status}`}>{draft.status}</span>
        <span style={{ color: '#64748b', fontSize: 13 }}>{draft.id.slice(0, 8)} · {new Date(draft.createdAt).toLocaleString()}</span>
      </div>

      {error && <p className="error">❌ {error}</p>}

      {/* Research */}
      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔍 Research</summary>
        <p style={{ marginTop: 8, color: '#cbd5e1' }}>{draft.research?.summary}</p>
        <ul style={{ marginTop: 8, color: '#94a3b8' }}>
          {draft.research?.keyPoints?.map((p: string, i: number) => <li key={i}>{p}</li>)}
        </ul>
      </details>

      {/* Content Tabs */}
      <div className="tabs">
        {(Object.keys(FORMAT_LABELS) as Format[]).map(fmt => (
          <button key={fmt} className={`tab ${activeTab === fmt ? 'active' : ''}`} onClick={() => { setActiveTab(fmt); setEditing(false); }}>
            {FORMAT_LABELS[fmt]}
          </button>
        ))}
      </div>

      <div className="card">
        {editing ? (
          <>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              style={{ minHeight: 200 }}
            />
            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary" onClick={handleSave}>💾 Save</button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <pre style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
              {draft.formats[activeTab]}
            </pre>
            <button className="btn btn-secondary mt-4" onClick={() => { setEditing(true); setEditContent(draft.formats[activeTab]); }}>
              ✏️ Edit
            </button>
          </>
        )}
      </div>

      {/* Actions */}
      {draft.status === 'draft' && (
        <div className="card">
          <h4 style={{ marginBottom: 12 }}>Actions</h4>
          <div className="flex gap-2">
            <button className="btn btn-success" onClick={handleApprove}>✅ Approve</button>
            <div style={{ flex: 1 }}>
              <div className="flex gap-2">
                <input
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Feedback for rejection..."
                  style={{ flex: 1 }}
                />
                <button className="btn btn-danger" onClick={handleReject} disabled={!feedback.trim()}>❌ Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish via Blotato */}
      {(draft.status === 'approved' || draft.status === 'draft') && (
        <div className="card">
          <h4 style={{ marginBottom: 12 }}>🚀 Publish via Blotato</h4>
          <label>Select platforms:</label>
          <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
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
          <button
            className="btn btn-primary"
            onClick={handlePublish}
            disabled={publishing || selectedPlatforms.length === 0}
          >
            {publishing ? '⏳ Publishing...' : `Publish ${FORMAT_LABELS[activeTab]} to ${selectedPlatforms.length} platform(s)`}
          </button>
        </div>
      )}

      {draft.feedback && (
        <div className="card" style={{ borderColor: '#7f1d1d' }}>
          <h4>Rejection Feedback</h4>
          <p style={{ color: '#fca5a5' }}>{draft.feedback}</p>
        </div>
      )}
    </div>
  );
}
