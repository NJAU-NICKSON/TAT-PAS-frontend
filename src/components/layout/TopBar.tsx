import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, User, LogOut, Bell, AlertTriangle, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { NotificationPanel } from '../ui/NotificationPanel';
import { useNotifications } from '../ui/useNotifications';

interface Breadcrumb {
  label: string;
  path?: string;
}

interface TopBarProps {
  breadcrumbs: Breadcrumb[];
  onMenuClick?: () => void;
}

export function TopBar({ breadcrumbs, onMenuClick }: TopBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs]     = useState(false);
  const [breachCount, setBreachCount]   = useState(0);

  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  useEffect(() => {
    const unsub  = subscribe('sla.breached',        () => setBreachCount(c => c + 1));
    const unsub2 = subscribe('sla.breach_resolved', () => setBreachCount(c => Math.max(0, c - 1)));
    return () => { unsub(); unsub2(); };
  }, [subscribe]);

  const avatarInitials = user?.full_name
    ?.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <>
      <header className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 flex-shrink-0"
        style={{
          height: '60px',
          background: '#fff',
          borderBottom: '1px solid #E5E7EB',
          zIndex: 20,
        }}>

        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-lg transition-colors hover:bg-gray-100 flex-shrink-0"
          style={{ color: '#6B7280' }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="flex items-center gap-1 text-sm flex-shrink-0 min-w-0">
          {breadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-1 min-w-0">
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />}
              {crumb.path ? (
                <Link to={crumb.path}
                  className="text-gray-400 hover:text-gray-700 transition-colors truncate">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-semibold text-gray-900 truncate">{crumb.label}</span>
              )}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">

          {breachCount > 0 && (
            <Link to="/prescriptions"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {breachCount} overdue prescription{breachCount > 1 ? 's' : ''}
            </Link>
          )}

          <button onClick={() => setShowNotifs(v => !v)}
            className="relative p-2 rounded-lg transition-colors hover:bg-gray-100"
            title="Notifications"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            style={{ color: '#6B7280' }}>
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center bg-red-600 text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <div className="w-px h-5 bg-gray-200" />

          <div className="relative">
            <button onClick={() => setShowUserMenu(v => !v)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                style={{ background: '#178A3D' }}>
                {avatarInitials}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-gray-900 leading-tight">{user?.full_name}</p>
                <p className="text-micro text-gray-400 capitalize leading-tight">{user?.role}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-gray-200 overflow-hidden shadow-lg bg-white"
                  style={{ zIndex: 50 }}>
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{user?.full_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <User className="w-4 h-4 text-gray-400" />
                      My Profile
                    </button>
                    <div className="mx-3 my-1 border-t border-gray-100" />
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <NotificationPanel
        isOpen={showNotifs}
        onClose={() => setShowNotifs(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        markAllRead={markAllRead}
        markRead={markRead}
      />
    </>
  );
}
