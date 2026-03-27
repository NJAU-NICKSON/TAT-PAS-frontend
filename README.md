# TAT-PAS Frontend

**Turnaround Time – Patient Administration System**
React 18 · TypeScript · Vite · Tailwind CSS · Recharts

---

## Overview

The frontend is a single-page React application providing role-specific dashboards and workflows for every staff role in the TAT-PAS hospital system.

Key features:
- **Role-based dashboards** – Each of the 7 roles lands on a tailored dashboard
- **Real-time updates** – WebSocket-powered live notifications (SLA breaches, payments, prescription events)
- **Billing & receipts** – Create bills, record payments (M-Pesa, NHIF, card, cash), print formatted receipts
- **Prescription pipeline** – Full Rx lifecycle: order → submit → verify → dispense → administer
- **Audit system** – Flag review, countersign workflow, security event log
- **Analytics** – TAT charts, SLA compliance gauges, bottleneck spotlight
- **Patient journey** – Visual timeline tracking the patient through every department stage

---

## Project Structure

```
frontend/
├── src/
│   ├── api/             # Axios-based API clients (one file per domain)
│   ├── components/      # Shared UI components
│   │   ├── layout/      # AppShell, Sidebar, TopBar
│   │   └── ui/          # Domain-specific components (TATTimer, KanbanBoard, …)
│   ├── context/         # React contexts (AuthContext, WebSocketContext)
│   ├── lib/             # Design tokens, icons, nav config, utils
│   ├── models/          # TypeScript type definitions (types.ts)
│   ├── viewModels/      # Custom hooks (data-fetching + derived state)
│   ├── views/           # Page-level components
│   │   └── dashboards/  # Role dashboards (Admin, Doctor, Pharmacist, …)
│   ├── App.tsx          # Router + role-gated route definitions
│   └── main.tsx         # App entry point
├── vite.config.ts
├── tailwind.config.js
└── .env                 # (not committed) — see Environment Variables
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env    # then edit with your API URL

# 3. Start the development server
npm run dev
```

App runs at [http://localhost:5173](http://localhost:5173)

The backend must be running at `http://localhost:8000` (or update `VITE_API_URL`).

---

## Environment Variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000/api/v1` | Backend REST API base URL |
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket base URL |

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript strict type check |

---

## Role Dashboards

| Role | Dashboard | Key Actions |
|---|---|---|
| `admin` | AdminDashboard | User management, system health, analytics |
| `receptionist` | ReceptionistDashboard | Register patients, open visits |
| `nurse` | WardNurseDashboard | Triage, bed management, administer meds |
| `doctor` | DoctorDashboard | Consultations, write prescriptions |
| `pharmacist` | PharmacistDashboard | Prescription queue, verify & dispense |
| `billing` | BillingClerkDashboard | Create bills, record payments, print receipts |
| `auditor` | AuditorDashboard | Audit queue, countersign, SLA review |

---

## WebSocket (Real-time)

The `WebSocketProvider` in `src/context/WebSocketContext.tsx` manages a single persistent connection per session. Authentication is sent as the first message (token never appears in the URL).

**Subscribe to events in any component:**

```tsx
import { useWebSocket } from '../context/WebSocketContext';

const { connected, subscribe } = useWebSocket();

useEffect(() => {
  const unsub = subscribe('payment_recorded', (event) => {
    console.log(event.message, event.data);
  });
  return unsub; // auto-unsubscribes on unmount
}, [subscribe]);
```

**Common event types:**

| Event | Triggered when |
|---|---|
| `payment_recorded` | A payment is added to a bill |
| `bill_created` | A new bill is opened |
| `prescription_status_changed` | Rx moves to a new status |
| `sla_breach` | Prescription exceeds SLA threshold |
| `flag_created` | Automated or manual flag raised |

The connection auto-reconnects with exponential backoff (1 s → 30 s max).

---

## Billing

The billing flow supports:

1. **Create bill** from a visit (billing or admin role)
2. **Add charges** by category: `consultation`, `lab`, `radiology`, `pharmacy`, `ward`, `procedure`, `other`
3. **Record payments** – `cash`, `card`, `mpesa`, `nhif`, `insurance`, `mobile_money`
4. **Print receipt** – Opens a formatted print-ready receipt in a new window

Bill statuses: `open` → `partially_paid` → `paid` (or `finalized` / `waived`)

---

## Authentication Flow

1. User logs in at `/login` → receives `access_token` + `refresh_token`
2. Tokens stored in `localStorage`
3. `apiClient.ts` intercepts every request to attach `Authorization: Bearer <token>`
4. On `401` response, the interceptor silently refreshes the token and retries
5. On refresh failure, session is cleared and user is redirected to `/login`

---

## Technology Stack

| Library | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool / dev server |
| Tailwind CSS | 3 | Utility-first styling |
| React Router | 7 | Client-side routing |
| Axios | 1 | HTTP client with interceptors |
| Recharts | 3 | Analytics charts |
| Lucide React | 0.344 | Icon set |
| Sonner | 2 | Toast notifications |
| Framer Motion | 12 | Animations |
| @dnd-kit | 6/10 | Drag-and-drop (Kanban board) |

---

## Production Build

```bash
npm run build
# Outputs to dist/ — serve with any static file server or Nginx
```

Example Nginx config:

```nginx
server {
    listen 80;
    root /var/www/tatpas/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
    }

    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
