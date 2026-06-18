import {
  FileText,
  Send,
  AlertTriangle,
  CheckCircle,
  Package,
  Syringe,
  Archive,
  Zap,
  AlertCircle,
  Clock,
  LogOut,
  Heart,
  ShieldCheck,
  PackageCheck,
  Flag,
  CheckSquare,
  ArrowUpCircle,
  LayoutDashboard,
  Pill,
  ClipboardList,
  BarChart2,
  Users,
  Settings,
  HelpCircle,
  Bell,
  Ban,
  Copy,
  DollarSign,
  BedDouble,
  Calendar,
  DoorOpen,
} from 'lucide-react';

export const STATUS_ICONS = {
  draft: FileText,
  submitted: Send,
  flagged: AlertTriangle,
  verified: CheckCircle,
  dispensed: Package,
  administered: Syringe,
  archived: Archive,
} as const;

export const PRIORITY_ICONS = {
  stat: Zap,
  urgent: AlertCircle,
  routine: Clock,
  discharge: LogOut,
  nicu: Heart,
} as const;

export const ACTION_ICONS = {
  verify: ShieldCheck,
  dispense: PackageCheck,
  administer: Syringe,
  flag: Flag,
  resolve: CheckSquare,
  escalate: ArrowUpCircle,
} as const;

export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  prescriptions: Pill,
  audit: ClipboardList,
  analytics: BarChart2,
  patients: Users,
  settings: Settings,
  notifications: Bell,
  help: HelpCircle,
  billing: DollarSign,
  beds: BedDouble,
  visits: Calendar,
  rooms: DoorOpen,
} as const;

export const FLAG_ICONS = {
  high_dose: AlertCircle,
  extended_duration: Clock,
  allergy_match: AlertTriangle,
  drug_interaction: Pill,
  controlled_sub: Ban,
  sla_breach: Zap,
  duplicate_rx: Copy,
} as const;
