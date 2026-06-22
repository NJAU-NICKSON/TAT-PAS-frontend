import { useState } from 'react';
import { User, Lock, Bell, Shield, Info, Check, X, Eye, EyeOff, Loader2, Activity, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { adminApi, SystemHealth } from '../api/admin';
import { formatTimeEAT } from '../lib/utils';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
        <span className="text-[#1e3a5f]">{icon}</span>
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  const [notifications, setNotifications] = useState({
    sla_breach: true,
    audit_flags: true,
    prescription_updates: true,
  });

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const isAdmin = user?.role === 'admin';

  const runHealthCheck = async () => {
    setChecking(true);
    try {
      const res = await adminApi.health();
      setHealth(res.data);
      setLastChecked(new Date());
    } catch {
      setHealth(null);
      setLastChecked(new Date());
    } finally {
      setChecking(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    if (!user) return;

    setPwLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      const detail =
        typeof err === 'object' &&
        err !== null &&
        'detail' in err &&
        typeof (err as { detail?: unknown }).detail === 'string'
          ? (err as { detail: string }).detail
          : 'Password change failed.';
      setPwError(detail);
    } finally {
      setPwLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account preferences</p>
      </div>

      <Section title="Account" icon={<User className="w-4 h-4" />}>
        <Field label="Full Name" value={user.full_name} />
        <Field label="Username" value={user.username} />
        <Field label="Email" value={user.email || ' - '} />
        <Field label="Role" value={user.role.replace(/_/g, ' ')} />
      </Section>

      <Section title="Change Password" icon={<Lock className="w-4 h-4" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f]"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f]"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="flex gap-1.5 mt-2">
                {[
                  newPassword.length >= 8,
                  /[A-Z]/.test(newPassword),
                  /[0-9]/.test(newPassword),
                ].map((met, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${met ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {['8+ chars', 'Uppercase', 'Number'][i]}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f] ${
                confirmPassword && confirmPassword !== newPassword ? 'border-red-400' : 'border-gray-300'
              }`}
              placeholder="Re-enter new password"
            />
          </div>

          {pwError && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <X className="w-4 h-4 flex-shrink-0" />
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              Password changed successfully.
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={pwLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {pwLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </div>
      </Section>

      <Section title="Notifications" icon={<Bell className="w-4 h-4" />}>
        <div className="space-y-4">
          {[
            { key: 'sla_breach' as const, label: 'SLA Breach Alerts', desc: 'Get notified when a prescription exceeds the time threshold', locked: false },
            { key: 'audit_flags' as const, label: 'Audit Flag Updates', desc: 'Notifications for new and resolved audit flags', locked: false },
            { key: 'prescription_updates' as const, label: 'Prescription Status Changes', desc: 'Real-time updates on prescription workflow progress. Always on so no step is missed.', locked: true },
          ].map(({ key, label, desc, locked }) => {
            const on = locked ? true : notifications[key];
            return (
              <div key={key} className="flex items-start gap-4">
                <div className="relative mt-0.5">
                  <div
                    className={`w-10 h-5 rounded-full transition-colors ${on ? 'bg-[#1e3a5f]' : 'bg-gray-200'} ${locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => { if (!locked) setNotifications(prev => ({ ...prev, [key]: !prev[key] })); }}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 mx-0.5 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    {locked && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Always on</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Security" icon={<Shield className="w-4 h-4" />}>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-800">Two-Factor Authentication</p>
              <p className="text-xs text-gray-500 mt-0.5">Add an extra layer of security to your account</p>
            </div>
            <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">Not available</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-800">Active Sessions</p>
              <p className="text-xs text-gray-500 mt-0.5">Current browser session active</p>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">1 Active</span>
          </div>
        </div>
      </Section>

      {isAdmin && (
        <Section title="System Health" icon={<Activity className="w-4 h-4" />}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                {checking ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                ) : health?.status === 'ok' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : health ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <Activity className="w-5 h-5 text-gray-300" />
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {checking
                      ? 'Checking…'
                      : health?.status === 'ok'
                        ? 'All systems operational'
                        : health
                          ? 'System degraded'
                          : 'Not checked yet'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {lastChecked ? `Last checked ${formatTimeEAT(lastChecked)}` : 'Run a check to see live system health'}
                  </p>
                </div>
              </div>
              <button
                onClick={runHealthCheck}
                disabled={checking}
                className="flex items-center gap-2 px-4 py-2 bg-[#178A3D] hover:opacity-90 text-white text-sm font-semibold rounded-lg transition-opacity disabled:opacity-60"
              >
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {checking ? 'Checking…' : 'Run check'}
              </button>
            </div>

            {health && !checking && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xs text-gray-500">Database</span>
                  <span className={`text-xs font-semibold ${health.database === 'ok' ? 'text-green-700' : 'text-amber-700'}`}>
                    {health.database === 'ok' ? 'Connected' : 'Error'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xs text-gray-500">Background jobs</span>
                  <span className={`text-xs font-semibold ${health.scheduler === 'ok' ? 'text-green-700' : 'text-amber-700'}`}>
                    {health.scheduler === 'ok' ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {isAdmin && (
        <Section title="About" icon={<Info className="w-4 h-4" />}>
          <Field label="System" value="TAT-PAS" />
          <Field label="Version" value="1.0.0" />
          <Field label="Description" value="Turnaround Time Pharmacy Automation System" />
          <Field label="Stack" value="FastAPI + React + MongoDB" />
        </Section>
      )}
    </div>
  );
}
