import { Link, useLocation } from 'react-router-dom';
import { Cross } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { getNavigationForRole } from '../../lib/nav';

const ROLE_LABEL: Record<string, string> = {
  admin:       'Administrator',
  pharmacist:  'Pharmacist',
  auditor:     'Auditor',
  doctor:      'Doctor',
  nurse:       'Nurse',
  receptionist:'Receptionist',
  billing:     'Billing Officer',
};

const ROLE_COLOR: Record<string, string> = {
  admin:       '#6366F1',
  pharmacist:  '#0EA5E9',
  auditor:     '#8B5CF6',
  doctor:      '#10B981',
  nurse:       '#F59E0B',
  receptionist:'#64748B',
  billing:     '#64748B',
};

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function Sidebar() {
  const { user } = useAuth();
  const { connected } = useWebSocket();
  const location = useLocation();

  if (!user) return null;

  const navGroups = getNavigationForRole(user.role);
  const isActive = (path: string) =>
    location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(`${path}/`));

  const roleColor = ROLE_COLOR[user.role] ?? '#64748B';

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col"
      style={{ width: '248px', zIndex: 30, background: '#111827', borderRight: '1px solid #1F2937' }}
    >
      <div className="flex items-center gap-3 px-5 flex-shrink-0"
        style={{ height: '60px', borderBottom: '1px solid #1F2937' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#1D4ED8' }}>
          <Cross className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-white tracking-tight leading-none">TAT-PAS</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: connected ? '#34D399' : '#6B7280' }} />
            <span className="text-[10px] font-medium"
              style={{ color: connected ? '#6EE7B7' : '#6B7280' }}>
              {connected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" style={{ scrollbarColor: '#374151 #1F2937' }}>
        {navGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
            <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5"
              style={{ color: '#4B5563' }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium relative"
                    style={{
                      background: active ? '#1E3A5F' : 'transparent',
                      color: active ? '#F0F9FF' : '#9CA3AF',
                      borderLeft: active ? '3px solid #3B82F6' : '3px solid transparent',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = '#1F2937';
                        (e.currentTarget as HTMLElement).style.color = '#E5E7EB';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
                      }
                    }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0"
                      style={{ color: active ? '#60A5FA' : '#6B7280' }} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && item.badge.value > 0 && (
                      <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums"
                        style={{
                          background: item.badge.type === 'alert' ? '#DC2626' : '#1D4ED8',
                          color: '#fff',
                        }}>
                        {item.badge.value > 99 ? '99+' : item.badge.value}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>


      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid #1F2937', background: '#0D1117' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
          style={{ background: roleColor }}>
          {initials(user.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate leading-tight">{user.full_name}</p>
          <p className="text-[10px] mt-0.5 truncate font-medium"
            style={{ color: roleColor }}>
            {ROLE_LABEL[user.role] ?? user.role}
          </p>
        </div>
      </div>
    </aside>
  );
}
