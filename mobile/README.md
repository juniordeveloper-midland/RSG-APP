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
- **Android Emulator**: Press `a` in the terminal.
- **iOS Simulator**: Press `i` in the terminal.
- **Web Browser Preview**: Press `w` in the terminal.

### 4. API Base URL Resolution

`mobile/src/config.ts` resolves the backend base URL in this priority order (port `4000` is a single constant, `API_PORT`):

1. **Custom URL** — if `EXPO_PUBLIC_API_URL` is set and non-empty (in `mobile/.env`), it is used verbatim. Use this for a remote/staging backend or to override auto-detection.
2. **Real phone (dev build)** — otherwise, if a dev server is connected, the app derives the PC LAN IP from `Constants.expoConfig.hostUri` (e.g. `192.168.1.5:8081`) and uses `http://<that-ip>:4000`. The backend must be reachable from the phone (same Wi-Fi, firewall open).
3. **Android emulator** — otherwise `http://10.0.2.2:4000` (the emulator alias for the host's localhost). **iOS Simulator / web** fall back to `http://127.0.0.1:4000`.

The resolved URL is printed to the console at startup and shown on the Login screen in `__DEV__`. Use the **Test connection** button on the Login screen to probe `GET <baseURL>/health` (5 s timeout) — it shows "Server reachable" or "Cannot reach <URL>".

You can also retarget the backend at runtime from the Login / More screen "Backend" setting (stored in SecureStore); it overrides the resolved URL for subsequent requests. See `mobile/.env.example` for all three cases.

#### Prerequisites for a real phone
- The phone and the PC running the backend are on the **same Wi-Fi/LAN**.
- The backend is started (`cd backend && npm run dev`) and listening on `0.0.0.0:4000` (or the LAN IP).
- **Windows firewall** allows inbound TCP on port 4000. Run once in an elevated PowerShell:
  ```powershell
  netsh advfirewall firewall add rule name="RSG Backend 4000" dir=in action=allow protocol=TCP localport=4000
  ```
  Remove it later with `netsh advfirewall firewall delete rule name="RSG Backend 4000"`.

#### Android cleartext HTTP
Expo Go and debug / dev-client builds already allow cleartext `http://` traffic **in development**, so reaching the LAN IP requires no extra config and **no rebuild**. Production / release builds block cleartext by default; prefer HTTPS, or (not recommended) enable cleartext via the `expo-build-properties` plugin (`android.usesCleartextTraffic: true`), which requires a prebuild / EAS rebuild to take effect.

---

## Test Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Guard 1 (Standard)** | `guard1@region.com` | `Guard123!` |
| **Guard 2 (Standard)** | `guard2@region.com` | `Guard123!` |
| **Operations Manager** | `manager@region.com` | `Manager123!` |
| **Suspended Account** | `suspended@region.com` | `Guard123!` |

*(Tap the quick demo fill pills on the Login screen to auto-fill credentials without typing).*
