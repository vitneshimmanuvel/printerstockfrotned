import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('admin@sevadesk.com');
  const [password, setPassword] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const u = await login(email, password);
      showToast(`Welcome back, ${u.name}!`, 'success');
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 19 }}>SD</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>SevaDesk Pro</h1>
            <p style={{ fontSize: 12.5, color: '#64748b' }}>Multi-Store e-Seva, Recharge, DMT & Operations Platform</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff1f2', color: '#be123c', fontSize: 13, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sevadesk.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px', marginTop: 4 }} disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In to Workspace'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: '11px 13px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
          <div style={{ fontWeight: 700, marginBottom: 3, color: '#1e293b' }}>Default Super Admin Login</div>
          <div>Email: <code>admin@sevadesk.com</code> · Password: <code>admin123</code></div>
        </div>
      </div>
    </div>
  );
}
