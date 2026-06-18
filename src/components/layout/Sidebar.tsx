import { Link, useLocation } from 'react-router-dom';
import { ScionMark } from '../ScionLogo';
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

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col"
      style={{ width: '248px', zIndex: 30, background: '#FAFAF9', borderRight: '1px solid #EBEBE8' }}
    >
      <div className="flex items-center gap-2.5 px-4 flex-shrink-0"
        style={{ height: '60px', borderBottom: '1px solid #EBEBE8' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#FFFFFF', border: '1px solid #EBEBE8' }}>
          <ScionMark size={26} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm tracking-tight leading-none" style={{ color: '#1A1A18' }}>
            Scion Hospital
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px]" style={{ color: '#8A8A82' }}>Mwiki Branch</span>
            <span className="w-1 h-1 rounded-full" style={{ background: '#D6D6D1' }} />
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: connected ? '#1FA64A' : '#B0B0A8' }} />
            <span className="text-[11px]"
              style={{ color: connected ? '#5C8A6B' : '#8A8A82' }}>
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
            <p className="text-[11px] font-semibold uppercase tracking-wide px-3 mb-1.5"
              style={{ color: '#A3A39B' }}>
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
                    className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm relative"
                    style={{
                      background: active ? '#EFEFEC' : 'transparent',
                      color: active ? '#1A1A18' : '#52524C',
                      fontWeight: active ? 600 : 500,
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = '#F0F0ED';
                        (e.currentTarget as HTMLElement).style.color = '#1A1A18';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = '#52524C';
                      }
                    }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0"
                      style={{ color: active ? '#178A3D' : '#9A9A92' }} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && item.badge.value > 0 && (
                      <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-micro font-bold tabular-nums"
                        style={{
                          background: item.badge.type === 'alert' ? '#E2231A' : '#178A3D',
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
        style={{ borderTop: '1px solid #EBEBE8', background: '#F4F4F2' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
          style={{ background: '#178A3D' }}>
          {initials(user.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight" style={{ color: '#1A1A18' }}>{user.full_name}</p>
          <p className="text-[11px] mt-0.5 truncate"
            style={{ color: '#8A8A82' }}>
            {ROLE_LABEL[user.role] ?? user.role}
          </p>
        </div>
      </div>
    </aside>
  );
}
