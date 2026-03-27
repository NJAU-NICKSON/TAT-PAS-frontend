import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../models/types';

interface AuthViewModel {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
  user: ReturnType<typeof useAuth>['user'];
  isAuthenticated: boolean;
}

export function useAuthViewModel(): AuthViewModel {
  const { login: ctxLogin, logout: ctxLogout, user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await ctxLogin(username, password);
        return true;
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr?.detail || 'Login failed. Please check your credentials.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [ctxLogin]
  );

  const logout = useCallback(() => {
    ctxLogout();
  }, [ctxLogout]);

  return {
    login,
    logout,
    isLoading,
    error,
    user,
    isAuthenticated,
  };
}
