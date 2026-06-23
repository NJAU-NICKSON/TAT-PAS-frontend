import { useState, useEffect, useCallback } from 'react';
import { useWebSocket, WSEvent } from '../../context/WebSocketContext';
import { activityApi } from '../../api/activity';

export type NotifType =
  | 'sla_breach'
  | 'flag_created'
  | 'patient_assigned'
  | 'rx_created'
  | 'rx_verified'
  | 'rx_dispensed'
  | 'rx_administered'
  | 'rx_returned';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  subtitle: string;
  timestamp: Date;
  read: boolean;
}

const RX_STATUS_NOTIF: Record<string, { type: NotifType; title: string; tail: string }> = {
  verified:          { type: 'rx_verified',     title: 'Approved by Auditor',  tail: 'Being processed by pharmacy' },
  dispensed:         { type: 'rx_dispensed',    title: 'Ready for Pickup',     tail: 'Dispensed by pharmacy - collect for administration' },
  administered:      { type: 'rx_administered', title: 'Medication Administered', tail: 'Given to the patient' },
  pending_amendment: { type: 'rx_returned',     title: 'Returned to Doctor',   tail: 'Amendment required' },
  flagged:           { type: 'flag_created',    title: 'Prescription Flagged', tail: 'Held for review' },
};

const STORAGE_KEY = 'tatpas_notifications';

// Load saved notifications, reviving timestamps to Date objects.
function loadStored(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Notification[]).map(n => ({ ...n, timestamp: new Date(n.timestamp) }));
  } catch {
    return [];
  }
}

export function useNotifications() {
  const { subscribe } = useWebSocket();
  const [notifications, setNotifications] = useState<Notification[]>(loadStored);

  // Persist so history survives refresh and re-login.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // ignore quota errors
    }
  }, [notifications]);

  const addNotif = useCallback((n: Notification) => {
    setNotifications(prev => {
      if (prev.some(p => p.id === n.id)) return prev;
      return [n, ...prev].slice(0, 100);
    });
  }, []);

  // On mount, fetch notifications derived from current data so events missed
  // while offline (assignments, returns, queue items) still appear.
  useEffect(() => {
    activityApi.myNotifications()
      .then(res => {
        setNotifications(prev => {
          const seen = new Set(prev.map(p => p.id));
          const fetched: Notification[] = res.data
            .filter(s => !seen.has(s.id))
            .map(s => ({
              id: s.id,
              type: s.type as NotifType,
              title: s.title,
              subtitle: s.subtitle,
              timestamp: new Date(s.timestamp),
              read: false,
            }));
          return [...fetched, ...prev]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 100);
        });
      })
      .catch(() => {});
  }, []);

  const rxLine = (d: { rx_number?: string; patient_name?: string }, extra?: string) =>
    [d.rx_number && `Rx ${d.rx_number}`, d.patient_name, extra].filter(Boolean).join(' - ');

  useEffect(() => {
    const unsubs = [
      subscribe('sla.breached', (ev: WSEvent) => {
        const d = ev.data as { rx_number?: string; patient_name?: string; elapsed_min?: number };
        addNotif({
          id: `sla-${ev.entity_id ?? Date.now()}`,
          type: 'sla_breach',
          title: 'SLA Breach',
          subtitle: rxLine(d, d.elapsed_min != null ? `${Math.round(d.elapsed_min)}m over` : undefined)
            || 'Prescription exceeded SLA threshold',
          timestamp: new Date(),
          read: false,
        });
      }),

      subscribe('audit.flag_created', (ev: WSEvent) => {
        const d = ev.data as { rx_number?: string; reason?: string; patient_name?: string };
        addNotif({
          id: `flag-${ev.entity_id ?? Date.now()}`,
          type: 'flag_created',
          title: 'Prescription Flagged',
          subtitle: rxLine(d, d.reason) || 'A prescription was flagged for audit',
          timestamp: new Date(),
          read: false,
        });
      }),

      subscribe('patient.assigned', (ev: WSEvent) => {
        const d = ev.data as { patient_name?: string; consultation_room?: string; visit_number?: string };
        addNotif({
          id: `assign-${ev.entity_id ?? Date.now()}-${Date.now()}`,
          type: 'patient_assigned',
          title: 'Patient Assigned to You',
          subtitle: [d.patient_name, d.consultation_room, d.visit_number]
            .filter(Boolean).join(' - ') || 'A patient was assigned to you',
          timestamp: new Date(),
          read: false,
        });
      }),

      subscribe('prescription.created', (ev: WSEvent) => {
        const d = ev.data as { rx_number?: string; patient_name?: string; priority?: string };
        addNotif({
          id: `rxnew-${ev.entity_id ?? Date.now()}`,
          type: 'rx_created',
          title: 'New Prescription to Review',
          subtitle: rxLine(d, d.priority ? `${d.priority} priority` : undefined)
            || 'A new prescription needs auditor review',
          timestamp: new Date(),
          read: false,
        });
      }),

      subscribe('prescription.status_changed', (ev: WSEvent) => {
        const d = ev.data as { new_status?: string; rx_number?: string; patient_name?: string };
        const cfg = d.new_status ? RX_STATUS_NOTIF[d.new_status] : undefined;
        if (!cfg) return;
        addNotif({
          id: `rx-${d.new_status}-${ev.entity_id ?? Date.now()}`,
          type: cfg.type,
          title: cfg.title,
          subtitle: rxLine(d, cfg.tail),
          timestamp: new Date(),
          read: false,
        });
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
