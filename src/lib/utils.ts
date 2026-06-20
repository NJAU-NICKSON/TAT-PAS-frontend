import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function withDoctorTitle(name?: string | null): string {
  if (!name || !name.trim()) return '';
  const n = name.trim();
  return /^dr\.?\s/i.test(n) ? n : `Dr. ${n}`;
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const KENYA_TZ = 'Africa/Nairobi';

// Parse a backend timestamp as UTC even when it lacks a 'Z' suffix.
export function parseUtc(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return isNaN(d.getTime()) ? null : d;
}

// Date + time in Kenya time (EAT, UTC+3).
export function formatDateTimeEAT(value?: string | Date | null): string {
  const d = parseUtc(value);
  if (!d) return 'N/A';
  return d.toLocaleString('en-GB', {
    timeZone: KENYA_TZ,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// Time only in Kenya time (EAT).
export function formatTimeEAT(value?: string | Date | null): string {
  const d = parseUtc(value);
  if (!d) return 'N/A';
  return d.toLocaleTimeString('en-GB', {
    timeZone: KENYA_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// Date only in Kenya time (EAT).
export function formatDateEAT(value?: string | Date | null): string {
  const d = parseUtc(value);
  if (!d) return 'N/A';
  return d.toLocaleDateString('en-GB', {
    timeZone: KENYA_TZ, day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDate(isoString?: string): string {
  return formatDateTimeEAT(isoString);
}