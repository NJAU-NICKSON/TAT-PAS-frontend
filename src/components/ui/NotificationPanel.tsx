import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Zap, AlertTriangle, CheckCircle, Package, Bell } from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { Notification, NotifType } from './useNotifications';

function getNotifMeta(type: NotifType): { icon: typeof Zap; color: string; bg: string } {
  switch (type) {
    case 'sla_breach':   return { icon: Zap,           color: '#DC2626', bg: '#FEF2F2' };
    case 'flag_created': return { icon: AlertTriangle,  color: '#7C3AED', bg: '#FAF5FF' };
    case 'rx_verified':  return { icon: CheckCircle,    color: '#178A3D', bg: '#F0FDF4' };
    case 'rx_dispensed': return { icon: Package,        color: '#D97706', bg: '#FFFBEB' };
  }
}

type TabKey = 'all' | 'unread' | 'sla' | 'flags';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',    label: 'All'      },
  { key: 'unread', label: 'Unread'   },
  { key: 'sla',    label: 'SLA'      },
  { key: 'flags',  label: 'Flags'    },
];

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
}

export function NotificationPanel({
  isOpen, onClose, notifications, unreadCount, markAllRead, markRead,
}: NotificationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const groups = useMemo(() => {
    const filtered = notifications.filter(n => {
      if (activeTab === 'unread') return !n.read;
      if (activeTab === 'sla')    return n.type === 'sla_breach';
      if (activeTab === 'flags')  return n.type === 'flag_created';
      return true;
    });

    const now = Date.now();
    return [
      { label: 'Today',     items: filtered.filter(n => now - n.timestamp.getTime() < 24 * 3600_000) },
      { label: 'Yesterday', items: filtered.filter(n => now - n.timestamp.getTime() >= 24 * 3600_000 && now - n.timestamp.getTime() < 48 * 3600_000) },
      { label: 'Older',     items: filtered.filter(n => now - n.timestamp.getTime() >= 48 * 3600_000) },
    ].filter(g => g.items.length > 0);
  }, [notifications, activeTab]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-96 flex flex-col animate-slide-up"
        style={{ background: 'var(--surface-0)', boxShadow: 'var(--shadow-modal)', zIndex: 51, borderLeft: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <h2 className="text-h3" style={{ color: 'var(--text-primary)' }}>Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: '#F0FDF4', color: '#178A3D', border: '1px solid #BBF7D0' }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                style={{ color: 'var(--clinical-600)' }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex" style={{ borderBottom: '1px solid var(--border-default)' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 px-3 py-2.5 text-caption font-semibold border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-[var(--clinical-600)] text-[var(--clinical-600)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-4" style={{ background: '#F0FDF4' }}>
                <CheckCircle className="w-7 h-7" style={{ color: '#178A3D' }} />
              </div>
              <h3 className="text-body font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>All caught up</h3>
              <p className="text-caption" style={{ color: 'var(--text-muted)' }}>No notifications to show</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label}>
                <div className="px-5 py-2" style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-default)' }}>
                  <span className="text-caption font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {group.label}
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                  {group.items.map(n => {
                    const { icon: Icon, color, bg } = getNotifMeta(n.type);
                    return (
                      <button
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className="w-full px-5 py-3.5 flex items-start gap-3 text-left transition-colors hover:bg-[var(--bg-row-hover)]"
                        style={{ background: n.read ? 'transparent' : 'rgba(23,138,61,0.04)' }}
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span className="text-body-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                              {n.title}
                            </span>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: '#178A3D' }} />
                            )}
                          </div>
                          <p className="text-caption leading-tight mb-1" style={{ color: 'var(--text-secondary)' }}>
                            {n.subtitle}
                          </p>
                          <span className="text-meta" style={{ color: 'var(--text-muted)' }}>
                            {formatRelativeTime(n.timestamp)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
