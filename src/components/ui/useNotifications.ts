import { useState, useEffect, useCallback } from 'react';
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
