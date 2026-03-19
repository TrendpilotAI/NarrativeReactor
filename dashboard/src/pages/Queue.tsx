import { useState, useEffect } from 'react';
import { getQueue, cancelQueueItem } from '../api';

export function QueuePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getQueue();
      setQueue(Array.isArray(data) ? data : data.items || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id: string) => {
    try {
      await cancelQueueItem(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>📋 Publishing Queue</h2>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>
        View and manage scheduled and recent posts via Blotato.
      </p>

      {loading && <p className="loading">Loading queue...</p>}
      {error && <p className="error">❌ {error}</p>}

      {!loading && queue.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: '#64748b' }}>
          No items in the queue.
        </div>
      )}

      {queue.map((item: any) => (
        <div className="card" key={item.id}>
          <div className="flex gap-4" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{item.id?.slice(0, 12)}</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                {item.platforms?.join(', ')} · {item.status || 'pending'}
              </div>
              {item.scheduledAt && (
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  Scheduled: {new Date(item.scheduledAt).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <span className={`badge ${item.status === 'published' ? 'badge-published' : item.status === 'failed' ? 'badge-rejected' : 'badge-draft'}`}>
                {item.status || 'pending'}
              </span>
              {item.status !== 'published' && (
                <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => handleCancel(item.id)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
          {item.content && (
            <pre style={{ marginTop: 8, color: '#cbd5e1', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden' }}>
              {item.content.slice(0, 200)}...
            </pre>
          )}
        </div>
      ))}

      <button className="btn btn-secondary mt-4" onClick={load}>🔄 Refresh</button>
    </div>
  );
}
