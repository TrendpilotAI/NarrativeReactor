import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';

export function LoginPage() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(password);
    if (!success) {
      setError('Invalid password');
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#0f172a',
    }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 400, maxWidth: '90vw' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>🎬 NarrativeReactor</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
          Enter your dashboard password to continue.
        </p>

        {error && (
          <div style={{
            background: '#7f1d1d',
            color: '#fca5a5',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
