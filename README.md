# Region Security Guarding - Guard Management Platform

Enterprise guard management platform adhering strictly to [AGENTS.md](./AGENTS.md).

## Subsystems

1. [Backend API (`/backend`)](./backend/README.md)
   - Node.js, Express, TypeScript, MySQL 8, Prisma ORM
   - JWT authentication with token rotation & refresh
   - Haversine geofenced attendance engine with 5-minute clock rounding
   - HMAC-signed QR patrol monitoring with anomaly detection
   - Automated background cron jobs (`node-cron`) for missed patrols and auto-absent shifts
   - Comprehensive test suite (73 tests passing)

2. [Management Web Portal (`/web-portal`)](./web-portal/README.md)
   - React, Vite, TypeScript, TanStack Query, Leaflet
   - Strict adherence to RSG Theme: Primary `#eb0505`, Background `#333333`, Surface `#3d3d3d`, Border `#4a4a4a`, Text `#ffffff`, Muted `#bdbdbd`
   - Reusable theme components: `Button`, `Input`, `Card`, `Modal`, `Table`
   - Responsive sidebar layout with red active-item highlight
   - Complete operational pages: Login, Dashboard, Branches, Employees, Shifts & Rota, Attendance Grid, Patrol QRs & Logs, Alerts Queue, Live Map

3. [Guard Mobile Terminal (`/mobile`)](./mobile/README.md)
   - React Native, Expo, TypeScript
   - Bottom Tabs: Home, My Rota, Patrol, More (Digital ID & Offline Queue)
   - Biometric unlock with `expo-local-authentication` & `expo-secure-store`
   - Geofenced attendance with live on-duty timer & large red CLOCK IN / CLOCK OUT button
   - Offline queue with `expo-sqlite` and exponential backoff retry
   - Signed QR patrol scanning with `expo-camera`
   - Digital Employee ID badge with SIA license verification

## Quick Start

### 1. Start Backend API
```bash
cd backend
npm install
npm run dev
```

### 2. Start Management Web Portal
```bash
cd web-portal
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. Log in with `manager@region.com` / `Manager123!`.

### 3. Start Guard Mobile Terminal
```bash
cd mobile
npm install
npm start
```
Scan the QR code with Expo Go or press `a` for Android Emulator / `i` for iOS Simulator.
