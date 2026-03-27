import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface PageContainerProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Array<{ label: string; path?: string }> = [{ label: 'Dashboard', path: '/dashboard' }];

  const pathMap: Record<string, string> = {
    'prescriptions/new': 'New Prescription',
    'prescriptions': 'Prescriptions',
    patients: 'Patients',
    audits: 'Audit Queue',
    analytics: 'Analytics',
    users: 'Users',
    beds: 'Beds',
    departments: 'Departments',
    visits: 'Visits',
  };

  segments.forEach((segment, idx) => {
    const label = pathMap[segments.slice(-2).join('/') || segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const path = `/${segments.slice(0, idx + 1).join('/')}`;
    breadcrumbs.push({ label, path });
  });

  return breadcrumbs.slice(1);
}

export function PageContainer({
  title,
  subtitle,
  action,
  children,
}: PageContainerProps) {
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  return (
    <div className="space-y-6 p-6 xl:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">{title}</h1>
          {subtitle && <p className="text-body-sm text-text-secondary">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      
      <nav className="flex items-center gap-2 text-sm text-text-muted" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {idx > 0 && <ChevronRight className="h-4 w-4" />}
            {crumb.path ? (
              <a
                href={crumb.path}
                className="hover:text-text-primary transition-colors font-medium"
              >
                {crumb.label}
              </a>
            ) : (
              <span className="font-semibold text-text-primary">{crumb.label}</span>
            )}
          </div>
        ))}
      </nav>

      <div>
        {children}
      </div>
    </div>
  );
}

