import { useState } from 'react';
import { generateContent } from '../api';

export function PipelinePage() {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [useClaude, setUseClaude] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const draft = await generateContent(topic, context || undefined, useClaude);
      setResult(draft);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>🧪 Content Pipeline</h2>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        Enter a topic to generate multi-format content (X thread, LinkedIn post, blog article).
      </p>

      <div className="card">
        <div className="form-group">
          <label>Topic *</label>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g., AI agents replacing traditional SaaS"
          />
        </div>
        <div className="form-group">
          <label>Additional Context (optional)</label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Brand brief, target audience, key messages..."
          />
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={useClaude}
              onChange={e => setUseClaude(e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }}
            />
            Use Claude (instead of Gemini)
          </label>
        </div>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || !topic.trim()}>
          {loading ? '⏳ Generating...' : '🚀 Generate Content'}
        </button>
      </div>

      {error && <div className="error">❌ {error}</div>}

      {result && (
        <div className="card mt-4">
          <h3 style={{ marginBottom: 12 }}>✅ Draft Created — <code>{result.id.slice(0, 8)}</code></h3>
          <p style={{ color: '#94a3b8', marginBottom: 16 }}>
            Status: <span className="badge badge-draft">{result.status}</span>
          </p>

          <h4 style={{ marginBottom: 8 }}>Research Summary</h4>
          <p style={{ color: '#cbd5e1', marginBottom: 16 }}>{result.research?.summary}</p>

          {(['xThread', 'linkedinPost', 'blogArticle'] as const).map(fmt => (
            <details key={fmt} style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer', color: '#a5b4fc' }}>
                {fmt === 'xThread' ? '🐦 X Thread' : fmt === 'linkedinPost' ? '💼 LinkedIn' : '📝 Blog'}
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', marginTop: 8, fontSize: 13 }}>
                {result.formats[fmt]}
              </pre>
            </details>
          ))}

          <a href={`/drafts/${result.id}`} className="btn btn-secondary mt-4" style={{ display: 'inline-block', textDecoration: 'none' }}>
            View Draft →
          </a>
        </div>
      )}
    </div>
  );
}
