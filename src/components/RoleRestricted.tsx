import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../models/types';

interface RoleRestrictedProps {
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RoleRestricted({
  roles,
  children,
  fallback = null,
}: RoleRestrictedProps) {
  const { hasRole } = useAuth();

  if (!hasRole(...roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
