import { Users, DollarSign, Calendar, Stethoscope, Thermometer, FlaskConical, Timer, Activity } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '../models/types';
import { NAV_ICONS } from './icons';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
  badge?: {
    value: number;
    type: 'number' | 'alert';
  };
}

export const NAV_GROUPS = {
  OVERVIEW: 'overview',
  PRESCRIPTIONS: 'prescriptions',
  CLINICAL: 'clinical',
  ADMINISTRATION: 'administration',
  SYSTEM: 'system',
} as const;

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const allNavItems: NavItem[] = [
  { id: 'dashboard',          label: 'Dashboard',          path: '/dashboard',          icon: NAV_ICONS.dashboard,     roles: ['receptionist', 'nurse', 'doctor', 'pharmacist', 'billing', 'auditor', 'admin'] },
  { id: 'patients',           label: 'Patients',           path: '/patients',           icon: NAV_ICONS.patients,      roles: ['receptionist', 'admin', 'doctor', 'nurse'] },
  { id: 'visits',             label: 'Visits',             path: '/visits',             icon: Calendar,                roles: ['receptionist', 'doctor', 'nurse', 'admin', 'billing'] },
  { id: 'triage',             label: 'Triage',             path: '/triage',             icon: Thermometer,             roles: ['nurse', 'admin'] },
  { id: 'rooms',              label: 'Consultation Rooms', path: '/consultation-rooms', icon: NAV_ICONS.rooms,         roles: ['admin', 'nurse', 'receptionist'] },
  { id: 'beds',               label: 'Wards & Beds',       path: '/beds',               icon: NAV_ICONS.beds,          roles: ['admin', 'nurse'] },
  { id: 'consultation',       label: 'Consultation',       path: '/consultation',       icon: Stethoscope,             roles: ['doctor', 'admin'] },
  { id: 'prescriptions-list', label: 'Prescriptions',      path: '/prescriptions',      icon: NAV_ICONS.prescriptions, roles: ['doctor', 'pharmacist', 'nurse', 'auditor', 'admin', 'receptionist'] },
  { id: 'pharmacy',           label: 'Pharmacy Queue',     path: '/pharmacy',           icon: FlaskConical,            roles: ['pharmacist', 'admin'] },
  { id: 'audit',              label: 'Review Queue',       path: '/audits',             icon: NAV_ICONS.audit,         roles: ['auditor', 'admin'] },
  { id: 'analytics',          label: 'Reports',            path: '/analytics',          icon: NAV_ICONS.analytics,     roles: ['auditor', 'admin'] },
  { id: 'billing',            label: 'Billing',            path: '/billing',            icon: DollarSign,              roles: ['billing', 'admin', 'receptionist'] },
  { id: 'users',              label: 'Staff Accounts',     path: '/users',              icon: Users,                   roles: ['admin'] },
  { id: 'sla-config',         label: 'SLA Configuration',  path: '/sla-config',         icon: Timer,                   roles: ['admin'] },
  { id: 'system-status',      label: 'System Status',      path: '/system-status',      icon: Activity,                roles: ['admin'] },
  { id: 'settings',           label: 'Settings',           path: '/settings',           icon: NAV_ICONS.settings,      roles: ['receptionist', 'nurse', 'doctor', 'pharmacist', 'billing', 'auditor', 'admin'] },
];

export const ROLE_NAV_MAP: Record<UserRole, NavItem[]> = {
  receptionist: allNavItems.filter(item => item.roles.includes('receptionist')),
  nurse:        allNavItems.filter(item => item.roles.includes('nurse')),
  doctor:       allNavItems.filter(item => item.roles.includes('doctor')),
  admin:        allNavItems.filter(item => item.roles.includes('admin')),
  pharmacist:   allNavItems.filter(item => item.roles.includes('pharmacist')),
  billing:      allNavItems.filter(item => item.roles.includes('billing')),
  auditor:      allNavItems.filter(item => item.roles.includes('auditor')),
};

export function getNavigationForRole(role: UserRole): NavGroup[] {
  const items = ROLE_NAV_MAP[role] || [];
  const pick = (...ids: string[]) => items.filter(i => ids.includes(i.id));

  const groups: NavGroup[] = [
    { label: 'Overview', items: pick('dashboard') },
  ];

  switch (role) {
    case 'receptionist':
      groups.push(
        { label: 'Patients',   items: pick('patients', 'visits') },
        { label: 'Records',    items: pick('prescriptions-list', 'billing') },
        { label: 'Facility',   items: pick('rooms') },
      );
      break;

    case 'nurse':
      groups.push(
        { label: 'Patients',     items: pick('patients', 'visits', 'triage') },
        { label: 'Facility',     items: pick('rooms', 'beds') },
        { label: 'Medications',  items: pick('prescriptions-list') },
      );
      break;

    case 'doctor':
      groups.push(
        { label: 'Patients',      items: pick('patients', 'visits') },
        { label: 'Consultation',  items: pick('consultation') },
        { label: 'Prescriptions', items: pick('prescriptions-list') },
      );
      break;

    case 'pharmacist':
      groups.push(
        { label: 'Dispensing', items: pick('prescriptions-list', 'pharmacy') },
      );
      break;

    case 'auditor':
      groups.push(
        { label: 'Prescriptions', items: pick('prescriptions-list') },
        { label: 'Compliance',    items: pick('audit', 'analytics') },
      );
      break;

    case 'billing':
      groups.push(
        { label: 'Patients', items: pick('visits') },
        { label: 'Finance',  items: pick('billing') },
      );
      break;

    case 'admin':
      groups.push(
        { label: 'Patients',      items: pick('patients', 'visits', 'triage') },
        { label: 'Clinical',      items: pick('consultation') },
        { label: 'Facility',      items: pick('rooms', 'beds') },
        { label: 'Prescriptions', items: pick('prescriptions-list', 'pharmacy') },
        { label: 'Compliance',    items: pick('audit', 'analytics') },
        { label: 'Finance',       items: pick('billing') },
        { label: 'Admin',         items: pick('users', 'sla-config', 'system-status', 'settings') },
      );
      break;
  }

  if (role !== 'admin') {
    groups.push({ label: 'Administration', items: pick('settings') });
  }

  return groups.filter(g => g.items.length > 0);
}
