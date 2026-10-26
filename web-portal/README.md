# Region Security Guarding - Management Web Portal

The RSG Management Web Portal is built with **React**, **Vite**, **TypeScript**, and **TanStack Query**, strictly following the UI/UX and domain requirements in [AGENTS.md](../AGENTS.md).

---

## Theme & Design System

The application strictly enforces the mandated RSG color palette defined in [src/theme.css](./src/theme.css):

| Token | Hex / Value | Description |
|---|---|---|
| **Primary** | `#eb0505` | Active items, highlights, icons, submit buttons |
| **Background** | `#333333` | Global dark application background |
| **Surface / Cards** | `#3d3d3d` | Content cards, table surfaces, modals |
| **Border** | `#4a4a4a` | Structural borders, dividers, inputs |
| **Text** | `#ffffff` | Primary text and white text on red buttons |
| **Muted Text** | `#bdbdbd` | Subtitles, helper text, inactive labels |

> **Contrast Rule**: `#eb0505` is never used for small body text on `#333333`. It is reserved for buttons, active tabs, highlights, and icons.

---

## Reusable Component Set

All components reside in `src/components/common/` and reference theme CSS variables exclusively:

- **`Button`**: Supports `primary` (red with white text), `secondary` (dark surface), `outline`, `danger`, and `ghost` variants. Includes loading spinner and icon support.
- **`Input`**: Text, email, password, number, date, select, and textarea inputs with focus glow, validation errors, and helper text.
- **`Card`**: Surface card container with header title, action buttons slot, body, and footer.
- **`Modal`**: Accessible dialog with background blur backdrop, ESC key closing, header, body, and footer action buttons.
- **`Table`**: Generic typed table with sorting, hover row highlights, empty states, and pagination controls.

---

## Features & Pages

### 1. Authentication & Session Management (`/login`)
- Connected to backend `POST /auth/login` and `POST /auth/refresh`.
- **Automatic JWT Refresh**: Custom interceptor queues pending 401 requests, refreshes tokens seamlessly in the background, and retries the original request.
- Demo credentials provided: `manager@region.com` / `Manager123!`.

### 2. Operational Command Centre (`/dashboard`)
- **5 Core Metrics**:
  - **On Duty Now**: Currently verified clocked-in guards.
  - **Late Today**: Shifts started after scheduled time.
  - **Absent Guards**: Flagged by automated background cron.
  - **Missed Patrols**: Checkpoints overdue for scanning.
  - **Open Alerts**: Pending operational triage.
- **Live On-Duty Roster**: Real-time table of active guards with branch and shift information.
- **Urgent Alerts Feed**: Instant acknowledgement and triage.

### 3. Branches Hub (`/branches`)
- Create, list, edit, disable, and re-enable operational branches.
- Configure physical addresses, latitude/longitude pins, and Haversine geofence radiuses in meters.

### 4. Workforce & Personnel (`/employees`)
- Enrol security officers with SIA/NI license numbers, hourly rates, monthly hours, and branch scoping.
- Filter by branch and active/suspended status.
- Actions: Edit profile, Suspend/Activate account, Grant/Revoke Managerial Access.

### 5. Shifts & Rota Scheduling (`/shifts`)
- Shift CRUD: Schedule windows (start/end), check-in types (GPS/QR), overtime rules (1-50h), and lunch deduction minutes.
- Shift assignment to single officer or all branch officers.
- Real-time overlapping shift detection.
- Excel (.xlsx) bulk import with downloadable demo template and row-by-row error reporting.

### 6. Attendance & Payroll Grid (`/attendance`)
- Filter by date range, branch, officer, and status (`present`, `late`, `absent`, `half_day`, `checked_in`).
- 5-minute clock rounding and automated overtime/lunch calculation display.
- **Manual Attendance Entry**: Audited manual record creation by supervisors.
- **Force Check-Out**: Clock out active guards directly from the roster.
- **Delete Record**: Audited record deletion.
- **Spreadsheet Export**: One-click download of attendance data.

### 7. QR Patrol & Perimeter Checkpoints (`/patrol`)
- **Checkpoints Tab**:
  - Generate cryptographically signed HMAC-SHA256 checkpoint tokens.
  - Printable preview and high-resolution PNG QR image downloads.
  - Expected patrol intervals (in minutes) for missed patrol monitoring.
- **Scan Logs Tab**:
  - Filter by branch and anomalies.
  - Anomaly badges for rapid duplicate scans (< 5 min) and suspicious GPS locations outside branch perimeter.
  - Export logs to Excel (.xlsx).

### 8. Safety & Incident Alerts Queue (`/alerts`)
- Queue filter tabs: `Open`, `Acknowledged`, `Resolved`, and `All`.
- Severity badges: `critical`, `high`, `medium`, `low`.
- Triage actions: Acknowledge and Resolve.

### 9. Live Tactical Operations Map (`/live-map`)
- Interactive Leaflet map with dark-mode styling.
- Circular geofence boundary rings for each branch matching `radius_m`.
- Live markers for currently clocked-in guards and patrol checkpoints.
- Filter by branch site.

---

## Running the Web Portal

### Development Server
```bash
cd web-portal
npm install
npm run dev
```
The portal starts on `http://localhost:5173` with automatic API proxying to backend on `http://localhost:4000`.

### Production Build
```bash
cd web-portal
npm run build
npm run preview
```
Ensures strict TypeScript compilation (`tsc -b`) and minified production bundles.
