import { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2, User, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { ScionMark } from '../components/ScionLogo';
import { ApiError } from '../models/types';

// Clinical scene illustration, blended into a soft brand-tinted panel so it
// reads as part of the page rather than a pasted-in image.
function LoginIllustration() {
  return (
    <div className="relative w-full max-w-lg">
      {/* Soft brand glow behind the art */}
      <div
        className="absolute inset-0 rounded-[40%_60%_55%_45%/55%_45%_60%_40%]"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 45%, var(--scion-green-50) 0%, rgba(233,248,239,0.35) 55%, transparent 80%)',
        }}
      />
      <img
        src="/images/login-illustration.png"
        alt="Clinical care illustration"
        className="relative w-full"
        style={{
          // Multiply drops the image's white background into the page,
          // leaving only the figures so it blends seamlessly.
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { login } = useAuth();
  // Always land a fresh login on the role dashboard, never the previous session.
  const redirectTo = '/dashboard';

  const MAX_ATTEMPTS = 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await login(username.trim(), password, redirectTo);
      setFailedAttempts(0);
      toast.success(`Welcome back, ${username.trim()}`, { description: 'Signed in successfully.' });
    } catch (err) {
      const apiErr = err as ApiError;
      const statusCode = apiErr?.status;

      if (statusCode === 429) {
        setError('Too many sign-in attempts. For security, please wait about a minute before trying again.');
        toast.error('Account temporarily locked', {
          description: 'You have exceeded the limit of 5 attempts per minute.',
        });
      } else if (statusCode === 403) {
        setError('This account has been deactivated. Please contact your administrator.');
      } else if (statusCode === 401 || statusCode === 400) {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
        setError(
          remaining > 0
            ? `Invalid username or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before a temporary lock.`
            : 'Invalid username or password. The account may now be temporarily locked.'
        );
      } else if (statusCode === undefined) {
        setError('Cannot reach the server. Please check your connection and try again.');
      } else {
        setError(apiErr?.detail || 'Sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Brand header */}
      <div className="flex items-center gap-2.5 px-8 py-6">
        <ScionMark size={30} />
        <div className="leading-none">
          <span className="text-h3 font-bold" style={{ color: 'var(--text-primary)' }}>
            Scion <span style={{ color: 'var(--scion-green-600)' }}>Hospital</span>
          </span>
          <p className="text-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>Mwiki Branch</p>
        </div>
      </div>

      <div className="flex-1 flex items-center">
        <div className="w-full grid lg:grid-cols-2 items-center gap-10 px-8 pb-10 max-w-6xl mx-auto">
          {/* Illustration panel */}
          <div className="hidden lg:flex justify-center">
            <LoginIllustration />
          </div>

          {/* Credentials panel */}
          <div className="w-full max-w-sm mx-auto">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--scion-green-50)', border: '1px solid var(--scion-green-100)' }}
              >
                <ScionMark size={24} />
              </div>
              <div className="leading-tight">
                <span className="text-h3 font-bold" style={{ color: 'var(--text-primary)' }}>Scion Hospital</span>
                <p className="text-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>Clinical Information System</p>
              </div>
            </div>

            <h1 className="text-h1 font-bold" style={{ color: 'var(--text-primary)' }}>Welcome Back</h1>
            <p className="text-body mt-1 mb-6" style={{ color: 'var(--text-secondary)' }}>Let's get you signed in</p>

            {error && (
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-lg mb-5 text-body-sm border animate-fade-in"
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

            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full pl-10 pr-3.5 py-3 text-body-sm border focus:outline-none transition-colors"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-card)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--scion-green-600)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                  required
                />
              </div>

              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-10 pr-11 py-3 text-body-sm border focus:outline-none transition-colors"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-card)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--scion-green-600)')}
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

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--scion-green-600)' }}
                  />
                  <span className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>Remember me</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 text-body-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                style={{ background: 'var(--scion-green-600)', borderRadius: 'var(--radius-card)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--scion-green-700)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--scion-green-600)')}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>

            <p className="text-meta text-center mt-8" style={{ color: 'var(--text-disabled)' }}>
              Authorised users only. All sessions are logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
