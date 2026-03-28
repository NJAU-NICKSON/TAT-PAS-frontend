import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export interface WSEvent {
  event_type: string;
  entity_id: string;
  entity_type: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
  triggered_by_role: string;
}

interface WebSocketContextValue {
  connected: boolean;
  subscribe: (eventType: string, handler: (event: WSEvent) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  connected: false,
  subscribe: () => () => {},
});

export const useWebSocket = (): WebSocketContextValue => useContext(WebSocketContext);

type HandlerMap = Map<string, Set<(event: WSEvent) => void>>;

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<HandlerMap>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const mountedRef = useRef(true);

  const dispatch = useCallback((event: WSEvent) => {
    const handlers = handlersRef.current.get(event.event_type);
    if (handlers) {
      handlers.forEach(h => h(event));
    }
    // Also dispatch to wildcard subscribers
    const wildcards = handlersRef.current.get('*');
    if (wildcards) {
      wildcards.forEach(h => h(event));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const token = localStorage.getItem('access_token');
    if (!token || !isAuthenticated) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    // Connect WITHOUT token in URL  -  token is sent in the first message after open
    const url = `${WS_BASE}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      // Send authentication frame as the first message
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (evt: MessageEvent) => {
      try {
        const parsed = JSON.parse(evt.data as string);
        // auth_ok is a control frame, not a domain event
        if (parsed.type === 'auth_ok') {
          if (mountedRef.current) {
            setConnected(true);
            reconnectDelayRef.current = 1000;
          }
          return;
        }
        dispatch(parsed as WSEvent);
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      wsRef.current = null;

      // Exponential backoff reconnect (max 30s)
      const delay = Math.min(reconnectDelayRef.current, 30000);
      reconnectDelayRef.current = Math.min(delay * 2, 30000);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current && isAuthenticated) {
          connect();
        }
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [isAuthenticated, dispatch]);

  useEffect(() => {
    mountedRef.current = true;

    if (isAuthenticated) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [isAuthenticated, connect]);

  const subscribe = useCallback(
    (eventType: string, handler: (event: WSEvent) => void): (() => void) => {
      if (!handlersRef.current.has(eventType)) {
        handlersRef.current.set(eventType, new Set());
      }
      handlersRef.current.get(eventType)!.add(handler);

      return () => {
        const set = handlersRef.current.get(eventType);
        if (set) {
          set.delete(handler);
          if (set.size === 0) {
            handlersRef.current.delete(eventType);
          }
        }
      };
    },
    []
  );

  return (
    <WebSocketContext.Provider value={{ connected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};
