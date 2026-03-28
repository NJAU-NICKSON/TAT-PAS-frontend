import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Zap, AlertTriangle, CheckCircle, Package, Bell } from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { useWebSocket, WSEvent } from '../../context/WebSocketContext';

export type NotifType = 'sla_breach' | 'flag_created' | 'rx_verified' | 'rx_dispensed';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  subtitle: string;
  timestamp: Date;
  read: boolean;
}

function getNotifMeta(type: NotifType): { icon: typeof Zap; color: string; bg: string } {
  switch (type) {
    case 'sla_breach':   return { icon: Zap,           color: '#DC2626', bg: '#FEF2F2' };
    case 'flag_created': return { icon: AlertTriangle,  color: '#7C3AED', bg: '#FAF5FF' };
    case 'rx_verified':  return { icon: CheckCircle,    color: '#059669', bg: '#F0FDF4' };
    case 'rx_dispensed': return { icon: Package,        color: '#D97706', bg: '#FFFBEB' };
  }
}

export function useNotifications() {
  const { subscribe } = useWebSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotif = useCallback((n: Notification) => {
    setNotifications(prev => [n, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribe('sla.breached', (ev: WSEvent) => {
        const d = ev.data as { prescription_id?: string; rx_number?: string; patient_name?: string; elapsed_min?: number };
        addNotif({
          id: ev.entity_id ? `sla-${ev.entity_id}` : `sla-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'sla_breach',
          title: 'SLA Breach',
          subtitle: [
            d.rx_number && `Rx ${d.rx_number}`,
            d.patient_name,
            d.elapsed_min != null && `${Math.round(d.elapsed_min)}m over threshold`,
          ].filter(Boolean).join('  ') || 'Prescription exceeded SLA threshold',
          timestamp: new Date(),
          read: false,
        });
      }),

      subscribe('audit.flag_created', (ev: WSEvent) => {
        const d = ev.data as { rx_number?: string; reason?: string; patient_name?: string };
        addNotif({
          id: ev.entity_id ? `flag-${ev.entity_id}` : `flag-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'flag_created',
          title: 'Prescription Flagged',
          subtitle: [
            d.rx_number && `Rx ${d.rx_number}`,
            d.patient_name,
            d.reason,
          ].filter(Boolean).join('  ') || 'A prescription was flagged for audit',
          timestamp: new Date(),
          read: false,
        });
      }),

      subscribe('prescription.status_changed', (ev: WSEvent) => {
        const d = ev.data as { status?: string; rx_number?: string; patient_name?: string };
        if (d.status === 'verified') {
          addNotif({
            id: ev.entity_id ? `ver-${ev.entity_id}` : `ver-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'rx_verified',
            title: 'Prescription Verified',
            subtitle: [d.rx_number && `Rx ${d.rx_number}`, d.patient_name, 'Ready for dispensing'].filter(Boolean).join('  '),
            timestamp: new Date(),
            read: false,
          });
        } else if (d.status === 'dispensed') {
          addNotif({
            id: ev.entity_id ? `dis-${ev.entity_id}` : `dis-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'rx_dispensed',
            title: 'Prescription Dispensed',
            subtitle: [d.rx_number && `Rx ${d.rx_number}`, d.patient_name].filter(Boolean).join('  '),
            timestamp: new Date(),
            read: false,
          });
        }
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [subscribe, addNotif]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  return { notifications, unreadCount, markAllRead, markRead };
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

  // Close on Escape
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
              <span className="text-caption font-bold px-2 py-0.5 rounded-full" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
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
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#F0FDF4' }}>
                <CheckCircle className="w-7 h-7" style={{ color: '#059669' }} />
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
                        style={{ background: n.read ? 'transparent' : 'rgba(37,99,235,0.04)' }}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span className="text-body-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                              {n.title}
                            </span>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: '#2563EB' }} />
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
