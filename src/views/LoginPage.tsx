import { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2, ShieldCheck, Activity, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch {
      setError('Invalid credentials. Please check your username and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-12"
        style={{ background: 'var(--clinical-900)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">TAT-PAS</span>
        </div>

        <div className="space-y-10">
          <div>
            <h1 className="text-display text-white leading-tight">
              Hospital<br />Workstation
            </h1>
            <p className="text-body-lg mt-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Prescription Audit & Patient Flow System
            </p>
          </div>

          <div className="space-y-5">
            {[
              { Icon: Activity,   text: 'Track prescription progress from order to administration' },
              { Icon: ShieldCheck, text: 'Full audit trail with multi-level review and sign-off' },
              { Icon: BarChart3,  text: 'Performance reports and wait time monitoring' },
            ].map(({ Icon, text }) => (
              <div key={text} className="flex items-start gap-3.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-body-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-meta" style={{ color: 'rgba(255,255,255,0.35)' }}>
          St. Jude's General Hospital · v1.2.1
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Activity className="w-5 h-5" style={{ color: 'var(--clinical-600)' }} />
            <span className="text-h3 font-black" style={{ color: 'var(--text-primary)' }}>TAT-PAS</span>
          </div>

          <div className="mb-8">
            <h2 className="text-h1" style={{ color: 'var(--text-primary)' }}>Sign in</h2>
            <p className="text-body mt-1" style={{ color: 'var(--text-secondary)' }}>
              Enter your clinical workstation credentials
            </p>
          </div>

          {error && (
            <div
              className="flex items-start gap-2.5 p-3.5 rounded-xl mb-5 text-body-sm border animate-fade-in"
              style={{
                background: 'var(--status-critical-bg)',
                borderColor: 'var(--status-critical-border)',
                color: 'var(--status-critical-text)',
              }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-body-sm font-semibold mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-3.5 py-2.5 text-body-sm border rounded-xl focus:outline-none transition-colors"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-card)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-body-sm font-semibold mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 pr-11 text-body-sm border rounded-xl focus:outline-none transition-colors"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-card)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-body-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{
                background: 'var(--clinical-600)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p
            className="text-meta text-center mt-8"
            style={{ color: 'var(--text-disabled)' }}
          >
            Authorised users only. All sessions are logged.
          </p>
        </div>
      </div>
    </div>
  );
}
