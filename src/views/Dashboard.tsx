import { useAuth } from '../context/AuthContext';
import {
  AdminDashboard,
  AuditorDashboard,
  BillingClerkDashboard,
  DoctorDashboard,
  PharmacistDashboard,
  WardNurseDashboard,
} from './dashboards';

const roleDashboardMap: Record<string, React.ComponentType> = {
  admin: AdminDashboard,
  auditor: AuditorDashboard,
  billing_clerk: BillingClerkDashboard,
  doctor: DoctorDashboard,
  pharmacist: PharmacistDashboard,
  nurse: WardNurseDashboard,
  ward_nurse: WardNurseDashboard,
  head_nurse: WardNurseDashboard,
  triage_nurse: WardNurseDashboard,
  midwife: WardNurseDashboard,
  paediatric_nurse: WardNurseDashboard,
};

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;

  const DashboardComponent = roleDashboardMap[user.role] || (() => (
    <div className="p-8 text-center">
      <h2 className="text-xl font-semibold">No dashboard available for your role</h2>
    </div>
  ));

  return <DashboardComponent />;
}
