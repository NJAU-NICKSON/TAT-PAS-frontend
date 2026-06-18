import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole } from '../models/types';
import { authApi } from '../api/auth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, redirectTo?: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const logout = useCallback(async () => {
    clearRefreshTimer();
    try {
      await authApi.logout();
    } catch {} finally {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
      setUser(null);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const scheduleRefresh = useCallback(
    (accessToken: string) => {
      clearRefreshTimer();
      const expiry = getTokenExpiry(accessToken);
      if (!expiry) return;

      const msUntilRefresh = expiry - Date.now() - 60_000;
      if (msUntilRefresh <= 0) return;

      refreshTimerRef.current = setTimeout(async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) return logout();

        try {
          const resp = await authApi.refresh(refreshToken);
          const { access_token, refresh_token: newRefresh } = resp.data;
          localStorage.setItem('access_token', access_token);
          if (newRefresh) localStorage.setItem('refresh_token', newRefresh);
          scheduleRefresh(access_token);
        } catch {
          logout();
        }
      }, msUntilRefresh);
    },
    [logout]
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      const token = localStorage.getItem('access_token');
      if (stored && token) {
        setUser(JSON.parse(stored) as User);
        scheduleRefresh(token);
      }
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
    return clearRefreshTimer;
  }, [logout, scheduleRefresh]);

  const login = useCallback(
    async (username: string, password: string, redirectTo = '/dashboard') => {
      const response = await authApi.login(username, password);
      const { access_token, refresh_token, user: userData } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      scheduleRefresh(access_token);
      navigate(redirectTo, { replace: true });
    },
    [navigate, scheduleRefresh]
  );

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
