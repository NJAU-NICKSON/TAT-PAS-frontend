# TAT-PAS Frontend

React single-page application for the TAT-PAS hospital system.

Built with React 18, TypeScript, Vite, and Tailwind CSS.

## What it covers

The UI has a separate dashboard for each of the 7 staff roles. Beyond the dashboards it includes:

- Patient registration and visit management
- Triage form with vitals input
- Doctor workspace - clinical notes and prescription writing
- Pharmacy queue - verify and dispense prescriptions
- Audit queue - review flagged prescriptions, countersign
- Patient journey timeline - visual TAT breakdown per stage
- Analytics - TAT charts, SLA compliance gauges, bottleneck view
- Billing - create bills, record payments, print receipts
- Bed and ward management
- Live notifications via WebSocket (SLA breaches, prescription events, payments)

## Setup

You need Node 18+ and the backend running on port 8000.

```bash
npm install
cp .env.example .env
npm run dev
```

App runs at http://localhost:5173.

## Environment variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |

## Folder structure

```
src/
├── api/            One Axios module per backend resource
├── components/
│   ├── layout/     AppShell, Sidebar, TopBar
│   └── ui/         Shared domain components (KanbanBoard, TATTimer, etc.)
├── context/        AuthContext, WebSocketContext
├── lib/            Nav config, icon map, utility functions
├── models/         TypeScript interfaces (types.ts)
├── viewModels/     Custom hooks - data fetching and derived state
└── views/
    ├── dashboards/ One dashboard component per role
    ├── ConsultationRoom.tsx
    ├── PatientJourneyPage.tsx
    ├── AuditQueue.tsx
    ├── AnalyticsDashboard.tsx
    └── ...
```

## Role dashboards

| Role | Component | Main actions |
|---|---|---|
| `admin` | AdminDashboard | Users, system health, analytics |
| `receptionist` | ReceptionistDashboard | Register patients, open visits |
| `nurse` | WardNurseDashboard | Triage, beds, administer meds |
| `doctor` | DoctorDashboard | Consultation queue, prescriptions |
| `pharmacist` | PharmacistDashboard | Prescription queue, dispense |
| `billing` | BillingClerkDashboard | Bills, payments, receipts |
| `auditor` | AuditorDashboard | Audit flags, countersign, SLA |

## Authentication

Login at `/login` → receives access + refresh tokens stored in localStorage. The Axios client attaches the token to every request. On a 401 it silently refreshes and retries. On refresh failure the session is cleared and the user is sent back to `/login`.

## WebSocket

`WebSocketContext` holds a single persistent connection. Token is sent as the first message (not in the URL). It auto-reconnects on disconnect.

```tsx
import { useWebSocket } from '../context/WebSocketContext';

const { subscribe } = useWebSocket();

useEffect(() => {
  return subscribe('sla_breach', (event) => {
    console.log(event.message);
  });
}, [subscribe]);
```

## Dependencies

| Package | Purpose |
|---|---|
| React 18 | UI |
| TypeScript 5 | Type safety |
| Vite 5 | Build and dev server |
| Tailwind CSS 3 | Styling |
| React Router 7 | Routing |
| Axios | HTTP client |
| Recharts | Charts |
| Lucide React | Icons |
| Sonner | Toast notifications |
| Framer Motion | Animations |
| @dnd-kit | Drag and drop (Kanban) |
