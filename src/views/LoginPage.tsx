import { useState } from 'react';
import {
  Eye, EyeOff, AlertCircle, Loader2, Shield, Stethoscope,
  HeartPulse, FlaskConical, ClipboardCheck, Receipt, UserCog, ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { ScionMark } from '../components/ScionLogo';
import { ApiError } from '../models/types';

const ROLES = [
  { id: 'admin',        label: 'Administrator', icon: Shield,          hint: 'Full system oversight' },
  { id: 'doctor',       label: 'Doctor',        icon: Stethoscope,     hint: 'Consult and prescribe' },
  { id: 'nurse',        label: 'Nurse',         icon: HeartPulse,      hint: 'Triage and administer' },
  { id: 'pharmacist',   label: 'Pharmacist',    icon: FlaskConical,    hint: 'Dispense medication' },
  { id: 'auditor',      label: 'Auditor',       icon: ClipboardCheck,  hint: 'Review prescriptions' },
  { id: 'billing',      label: 'Billing',       icon: Receipt,         hint: 'Bills and payments' },
  { id: 'receptionist', label: 'Receptionist',  icon: UserCog,         hint: 'Register and discharge' },
] as const;

type RoleId = typeof ROLES[number]['id'];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { login } = useAuth();
  // Always land a fresh login on the role dashboard, never the previous
  // session's page (which would leak one user's location to the next).
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
    <div
      className="min-h-screen flex"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="hidden lg:flex flex-col justify-between w-[360px] flex-shrink-0 p-10 border-r"
        style={{
          background: 'var(--scion-green-700)',
          borderColor: 'var(--scion-green-900)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ background: '#FFFFFF', borderRadius: 'var(--radius-button)' }}
          >
            <ScionMark size={26} />
          </div>
          <div className="leading-tight">
            <span className="text-h3 font-semibold tracking-tight text-white">
              Scion Hospital
            </span>
            <p className="text-meta mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Mwiki Branch</p>
          </div>
        </div>

        <div>
          <p className="text-label mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Clinical Information System
          </p>
          <h1 className="text-h1 text-white leading-snug">
            Turnaround Time &amp;<br />Prescription Audit
          </h1>
        </div>

        <p className="text-meta" style={{ color: 'rgba(255,255,255,0.45)' }}>
          TAT-PAS v1.2.1 · Authorised personnel only
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <ScionMark size={28} />
            <div className="leading-none">
              <span className="text-h3 font-bold" style={{ color: 'var(--text-primary)' }}>
                SCION <span className="font-semibold" style={{ color: 'var(--scion-green-600)' }}>Hospital</span>
              </span>
              <p className="text-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>Mwiki Branch</p>
            </div>
          </div>

          {/* Step 1: choose a role */}
          {!selectedRole && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <h2 className="text-h1" style={{ color: 'var(--text-primary)' }}>Welcome</h2>
                <p className="text-body mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Select your role to continue
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {ROLES.map(role => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => { setSelectedRole(role.id); setError(''); }}
                      className="flex flex-col items-start gap-2 p-3.5 rounded-lg text-left transition-all hover:shadow-sm"
                      style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-default)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--scion-green-600)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                    >
                      <Icon className="w-5 h-5" style={{ color: 'var(--scion-green-600)' }} />
                      <div>
                        <p className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{role.label}</p>
                        <p className="text-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>{role.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: sign in for the chosen role */}
          {selectedRole && (() => {
            const role = ROLES.find(r => r.id === selectedRole)!;
            const RoleIcon = role.icon;
            return (
              <div className="animate-fade-in">
                <button
                  type="button"
                  onClick={() => { setSelectedRole(null); setError(''); setUsername(''); setPassword(''); }}
                  className="inline-flex items-center gap-1.5 text-body-sm font-medium mb-5 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ChevronLeft className="w-4 h-4" /> Change role
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--scion-green-50)', border: '1px solid var(--scion-green-100)' }}
                  >
                    <RoleIcon className="w-5 h-5" style={{ color: 'var(--scion-green-600)' }} />
                  </div>
                  <div>
                    <h2 className="text-h2" style={{ color: 'var(--text-primary)' }}>{role.label} sign in</h2>
                    <p className="text-body-sm" style={{ color: 'var(--text-secondary)' }}>{role.hint}</p>
                  </div>
                </div>

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
                className="w-full px-3.5 py-2.5 text-body-sm border rounded-lg focus:outline-none transition-colors"
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
                  className="w-full px-3.5 py-2.5 pr-11 text-body-sm border rounded-lg focus:outline-none transition-colors"
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
              className="w-full flex items-center justify-center gap-2 py-2.5 text-body-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{
                background: 'var(--scion-green-600)',
                borderRadius: 'var(--radius-card)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--scion-green-700)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--scion-green-600)')}
            >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in
                    </>
                  ) : (
                    `Sign in as ${role.label}`
                  )}
                </button>
              </form>
              </div>
            );
          })()}

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
