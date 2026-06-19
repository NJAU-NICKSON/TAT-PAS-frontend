import { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const PATH_LABELS: Record<string, string> = {
  dashboard:            'Dashboard',
  prescriptions:        'Prescriptions',
  audits:               'Review Queue',
  analytics:            'Reports',
  patients:             'Patients',
  users:                'Staff Accounts',
  billing:              'Billing',
  beds:                 'Wards & Beds',
  'consultation-rooms': 'Consultation Rooms',
  visits:               'Visits',
  triage:               'Triage',
  pharmacy:             'Pharmacy Queue',
  settings:             'Settings',
  new:                  'New',
  journey:              'Patient Journey',
  consultation:         'Consultation',
};

const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((seg, idx) => {
    let label = PATH_LABELS[seg];
    if (!label) {
      label = OBJECT_ID_RE.test(seg) ? 'Details' : seg.charAt(0).toUpperCase() + seg.slice(1);
    }
    return {
      label,
      path: idx < segments.length - 1 ? `/${segments.slice(0, idx + 1).join('/')}` : undefined,
    };
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const breadcrumbs = getBreadcrumbs(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 lg:ml-[248px]">
        <TopBar breadcrumbs={breadcrumbs} onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
