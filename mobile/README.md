# RSG Guard Terminal Mobile App (`/mobile`)

React Native + Expo mobile application designed for frontline security officers. Strictly complies with [AGENTS.md](../AGENTS.md) theme tokens and security architecture.

---

## Features

- **Theme Compliance**:
  - Primary `#eb0505`, Background `#333333`, Surface `#3d3d3d`, Border `#4a4a4a`, Text `#ffffff`, Muted `#bdbdbd`.
  - Defined once in `src/theme.ts`.
  - Large touch targets (min 48px, 72px giant clock button).

- **Biometric Security & Authentication (`expo-local-authentication`, `expo-secure-store`)**:
  - Face ID, Touch ID, and hardware biometric unlock.
  - Secure credential & JWT token persistence with auto-refresh.
  - Clear error states for suspended accounts (403), invalid credentials (401), and network drops.

- **Geofenced Attendance Engine (`expo-location`)**:
  - High-accuracy GPS snapshot collection.
  - Haversine distance geofence verification per branch radius.
  - Big red **CLOCK IN / CLOCK OUT** button with live on-duty timer (`HH:MM:SS`).
  - Clear error states: outside geofence, weak GPS (>150m), permission denied, services disabled.

- **Offline Sync Queue (`expo-sqlite`)**:
  - All check-in, check-out, and patrol scans save to local SQLite queue when offline.
  - Differentiated **Pending Sync (Offline)** vs **Synced with Server** status.
  - Never displays unsynced data as verified.
  - Automatic background synchronization with exponential backoff and manual "Sync Queue Now" option.

- **QR Patrol Scanner (`expo-camera`)**:
  - Camera viewfinder with targeting reticle for scanning signed HMAC QR tokens.
  - Instant anomaly feedback (rapid duplicate scan detection, out-of-perimeter GPS).
  - Manual token entry fallback for testing without camera hardware.

- **Digital Employee ID Badge Card**:
  - Official officer credential badge with verified security hologram styling.
  - Officer photo placeholder, SIA/NI licence ID number, role, and branch allocation.

- **Assigned Rota Schedule (`GET /me/rota`)**:
  - Upcoming shifts, time windows, validation methods, and lunch break deductions.
  - Offline caching of rota schedule.

---

## How to Run & Test

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Start Expo Development Server
```bash
npm start
```

### 3. Running on Target Environments
- **Physical Device**: Scan the terminal QR code using **Expo Go** (Android) or Camera app (iOS).
- **Android Emulator**: Press `a` in the terminal. (Default API URL: `http://10.0.2.2:4000`).
- **iOS Simulator**: Press `i` in the terminal. (Default API URL: `http://localhost:4000`).
- **Web Browser Preview**: Press `w` in the terminal.

---

## Test Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Guard 1 (Standard)** | `guard1@region.com` | `Guard123!` |
| **Guard 2 (Standard)** | `guard2@region.com` | `Guard123!` |
| **Operations Manager** | `manager@region.com` | `Manager123!` |
| **Suspended Account** | `suspended@region.com` | `Guard123!` |

*(Tap the quick demo fill pills on the Login screen to auto-fill credentials without typing).*
