# RSG Backend API

Backend foundation for **Region Security Guarding - Guard Management Platform** built in accordance with [AGENTS.md](../AGENTS.md).

## Tech Stack
- **Runtime**: Node.js v24+
- **Framework**: Express + TypeScript
- **ORM**: Prisma ORM v6 with MySQL 8
- **Security**: Helmet, CORS, express-rate-limit, Zod validation, bcrypt

---

## Directory Structure
```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema (Phase 1 tables, indexes, constraints)
│   ├── seed.ts                # Database seed script
│   └── migrations/            # Version-controlled SQL migrations
├── src/
│   ├── config/
│   │   ├── env.ts             # Zod-validated environment config
│   │   └── prisma.ts          # Singleton Prisma client
│   ├── middleware/
│   │   ├── errorHandler.ts    # Standard error handler ({ error: { code, message } })
│   │   └── rateLimiter.ts     # Express rate limiting
│   ├── modules/
│   │   └── health/            # Health check module
│   │       ├── health.controller.ts
│   │       └── health.routes.ts
│   ├── utils/
│   │   └── response.ts        # Consistent API response helpers
│   ├── app.ts                 # Express application setup
│   └── server.ts              # Server startup & graceful shutdown
├── .env                       # Local environment variables
├── .env.example               # Example template
├── package.json
└── tsconfig.json
```

---

## Getting Started

### 1. Environment Setup
Copy `.env.example` to `.env` and configure your MySQL connection:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="mysql://root:password@localhost:3306/rsg_db"
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Run Migrations & Seed Data
Generate Prisma Client and apply migrations to MySQL:
```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

### 4. Run the Server
- **Development mode** (with live reload via `tsx`):
  ```bash
  npm run dev
  ```
- **Production build**:
  ```bash
  npm run build
  npm start
  ```

---

## Testing the Health Endpoint

### Request
```bash
curl http://localhost:4000/health
```

### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "rsg-backend",
    "timestamp_utc": "2026-10-22T09:48:31.152Z",
    "uptime_seconds": 11,
    "database": "connected"
  }
}
```

### Standard Error Format (`404 / 400 / 500`)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Endpoint not found"
  }
}
```

---

## Seed Accounts

| Role | Email | Password | Details | Status |
|---|---|---|---|---|
| **Manager** | `manager@region.com` | `Manager123!` | Managerial access, Central HQ (`branch-hq-001`) | Active |
| **Employee** | `guard1@region.com` | `Guard123!` | Guard, Day Shift, Geofence (`branch-hq-001`) | Active |
| **Employee** | `guard2@region.com` | `Guard123!` | Guard, Night Shift, QR Patrol (`branch-hq-001`) | Active |
| **Employee** | `suspended@region.com` | `Guard123!` | Suspended Guard Account | Suspended |

---

## Authentication & Authorization Feature

### Endpoints
- `POST /auth/login` - Authenticate with email & password (rate-limited, returns 15m access token & 7d refresh token)
- `POST /auth/refresh` - Refresh access token with automatic token rotation
- `POST /auth/logout` - Invalidate refresh token session and log audit record
- `POST /auth/forgot-password` - Request 30-minute password reset token (sent via Nodemailer)
- `POST /auth/reset-password` - Reset password using 30-minute token and revoke old sessions
- `GET /auth/me` - Authenticated user profile (`authenticate` middleware)
- `GET /management/dashboard` - Manager operations overview (`authenticate` + `requireRole('manager')` + `branchScope()`)
- `GET /management/branches/:branchId` - Branch-specific manager access (`branchScope()` check)

### Security & Compliance
- **JWT**: 15-minute access token (`JWT_ACCESS_SECRET`) and 7-day refresh token (`JWT_REFRESH_SECRET`).
- **Suspended Users**: Automatically blocked with `403 ACCOUNT_SUSPENDED`.
- **Audit Logging**: Append-only log written on every login attempt (success and failures), logout, password reset request, and password reset completion. Passwords and tokens are strictly excluded.
- **Rate Limiting**: `express-rate-limit` enforces a maximum of 10 requests per 15 minutes on auth endpoints.
- **Branch Scope**: Enforces branch isolation ensuring guards and managers can only access their assigned branch resources.

### Running Tests
Execute the comprehensive Jest + Supertest test suite:
```bash
npm test
```
This tests:
1. Valid login and token generation
2. Wrong password rejection (`401 INVALID_CREDENTIALS`)
3. Suspended user rejection (`403 ACCOUNT_SUSPENDED`)
4. Employee forbidden from manager routes (`403 FORBIDDEN`)
5. Manager permitted to access managerial routes
6. Branch scope validation (`403 BRANCH_ACCESS_DENIED`)
7. Refresh token rotation & reuse prevention
8. Logout session invalidation
9. 30-minute password reset flow and audit log verification

---

## Manager APIs: Branches & Employees

All routes require authentication with a manager account (`role: manager` or `managerial_access: true`). All modifications write audit logs to `audit_logs`.

### 1. Branches API

#### Create Branch (`POST /branches`)
```bash
curl -X POST http://localhost:4000/branches \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manchester North Hub",
    "address": "45 Deansgate, Manchester",
    "lat": 53.483959,
    "lng": -2.244644,
    "radius_m": 150,
    "is_active": true
  }'
```

#### List Branches with Pagination & Search (`GET /branches`)
```bash
curl -X GET "http://localhost:4000/branches?page=1&limit=10&search=Manchester&is_active=true" \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### Get Branch Details (`GET /branches/:id`)
```bash
curl -X GET http://localhost:4000/branches/branch-hq-001 \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### Update Branch Pin, Address & Geofence Radius (`PUT /branches/:id`)
```bash
curl -X PUT http://localhost:4000/branches/branch-hq-001 \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "100 Security Way, City Centre",
    "lat": 51.5074,
    "lng": -0.1278,
    "radius_m": 200
  }'
```

#### Disable Branch (`PATCH /branches/:id/disable`)
```bash
curl -X PATCH http://localhost:4000/branches/branch-hq-001/disable \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### Re-enable Branch (`PATCH /branches/:id/enable`)
```bash
curl -X PATCH http://localhost:4000/branches/branch-hq-001/enable \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

---

### 2. Employees API

#### Create Employee (`POST /employees`)
**Required**: `name` (min 4), `phone`, `email`, `password` (min 8), `monthly_hours`, `hourly_rate`, `id_number` (SIA/NI/other).  
**Optional**: `branch_id`, `username`, `address`, `managerial_access`, `role`, `status`.
```bash
curl -X POST http://localhost:4000/employees \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marcus Rashford Guard",
    "email": "marcus.guard@region.com",
    "phone": "+447700900222",
    "password": "GuardSecurePassword1!",
    "monthly_hours": 160,
    "hourly_rate": 16.50,
    "id_number": "SIA-88997711",
    "branch_id": "branch-hq-001",
    "username": "mrashford",
    "address": "7 Guard Lane, Manchester",
    "managerial_access": false
  }'
```

#### List Employees with Filters & Search (`GET /employees`)
Filter by `branch_id`, `status` (`active`/`suspended`), `role` (`employee`/`manager`), and search:
```bash
curl -X GET "http://localhost:4000/employees?page=1&limit=10&branch_id=branch-hq-001&status=active&search=Marcus" \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### Get Employee Profile (`GET /employees/:id`)
```bash
curl -X GET http://localhost:4000/employees/user-guard-001 \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### Update Employee Profile (`PUT /employees/:id`)
```bash
curl -X PUT http://localhost:4000/employees/user-guard-001 \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "hourly_rate": 17.25,
    "monthly_hours": 170,
    "address": "45 Updated Guard Way, London"
  }'
```

#### Suspend Employee (`PATCH /employees/:id/status`)
Suspends employee and immediately revokes all active refresh tokens:
```bash
curl -X PATCH http://localhost:4000/employees/user-guard-001/status \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "suspended"
  }'
```

#### Activate Employee (`PATCH /employees/:id/status`)
```bash
curl -X PATCH http://localhost:4000/employees/user-guard-001/status \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active"
  }'
```

#### Set Managerial Access (`PATCH /employees/:id/managerial-access`)
Grant or revoke managerial privileges:
```bash
curl -X PATCH http://localhost:4000/employees/user-guard-001/managerial-access \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "managerial_access": true
  }'
```

#### Upload Employee Profile Photo (`POST /employees/:id/photo`)
Uploads photo using `multipart/form-data` (Multer), updates `photo_url`, and writes to `audit_logs`:
```bash
curl -X POST http://localhost:4000/employees/user-guard-001/photo \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -F "photo=@/path/to/guard-profile.jpg"
```

---

## Shifts Management & Employee Rota

### 1. Shift CRUD (Manager Only)

#### Create Shift (`POST /shifts`)
```bash
curl -X POST http://localhost:4000/shifts \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "branch-hq-001",
    "name": "Day Guard Shift",
    "start_time": "08:00",
    "end_time": "16:00",
    "check_type": "gps",
    "overtime_enabled": true,
    "overtime_limit_hours": 4,
    "lunch_deduction_minutes": 30,
    "is_active": true
  }'
```

#### List Shifts (`GET /shifts`)
Filter by `branch_id`, active status (`true`/`false`/`all`), and search:
```bash
curl -X GET "http://localhost:4000/shifts?branch_id=branch-hq-001&is_active=true&search=Day" \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### Get Shift Details (`GET /shifts/:id`)
```bash
curl -X GET http://localhost:4000/shifts/shift-day-001 \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### Update Shift (`PUT /shifts/:id`)
```bash
curl -X PUT http://localhost:4000/shifts/shift-day-001 \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Day Shift",
    "start_time": "07:30",
    "end_time": "15:30",
    "lunch_deduction_minutes": 45
  }'
```

#### Disable / Re-enable Shift (`PATCH /shifts/:id/disable` & `PATCH /shifts/:id/enable`)
```bash
# Disable shift
curl -X PATCH http://localhost:4000/shifts/shift-day-001/disable \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"

# Re-enable shift
curl -X PATCH http://localhost:4000/shifts/shift-day-001/enable \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

---

### 2. Shift Assignment & Overlap Detection

Assign a shift to an individual guard or all active guards in the branch. Automatically creates a `Notification` record and prevents overlapping schedules (`409 OVERLAPPING_SHIFT`).

#### Assign to Single Employee (`POST /shifts/:id/assign`)
```bash
curl -X POST http://localhost:4000/shifts/shift-day-001/assign \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-guard-001",
    "start_date": "2026-11-01",
    "end_date": "2026-11-30",
    "excluded_dates": ["2026-11-10", "2026-11-15"]
  }'
```

#### Assign to All Branch Employees (`POST /shifts/:id/assign`)
```bash
curl -X POST http://localhost:4000/shifts/shift-day-001/assign \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "assign_all_branch": true,
    "start_date": "2026-11-01",
    "end_date": "2026-11-30"
  }'
```

---

### 3. Excel (.xlsx) Import & Template

#### Download Demo Excel Template (`GET /shifts/template`)
Downloads an `.xlsx` workbook formatted with valid column headers and demo rows:
```bash
curl -X GET http://localhost:4000/shifts/template \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -o shifts-template.xlsx
```

#### Bulk Import Shifts from Excel (`POST /shifts/import`)
Uploads `.xlsx` file, validates every row, and returns an error report per failed row:
```bash
curl -X POST http://localhost:4000/shifts/import \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -F "file=@/path/to/shifts.xlsx"
```
Response:
```json
{
  "success": true,
  "data": {
    "totalRows": 10,
    "importedCount": 8,
    "failedCount": 2,
    "errors": [
      {
        "row": 4,
        "name": "Night Shift",
        "errors": ["Branch 'North Pier' not found"]
      }
    ]
  }
}
```

---

### 4. Employee Rota (`GET /me/rota`)

Allows authenticated guards/employees to view their upcoming schedule with shift time windows and branch geofencing coordinates:
```bash
curl -X GET http://localhost:4000/me/rota \
  -H "Authorization: Bearer <EMPLOYEE_ACCESS_TOKEN>"
```
Response:
```json
{
  "success": true,
  "data": {
    "rota": [
      {
        "assignment_id": "assignment-001",
        "start_date": "2026-11-01T00:00:00.000Z",
        "end_date": "2026-11-30T00:00:00.000Z",
        "excluded_dates": ["2026-11-10"],
        "shift": {
          "id": "shift-day-001",
          "name": "Day Guard Shift",
          "start_time": "08:00",
          "end_time": "16:00",
          "check_type": "gps",
          "overtime_enabled": true,
          "overtime_limit_hours": 4,
          "lunch_deduction_minutes": 30,
          "branch": {
            "id": "branch-hq-001",
            "name": "RSG Central Headquarters",
            "address": "100 Security Way, City Centre",
            "lat": 51.5073509,
            "lng": -0.1277583,
            "radius_m": 150
          }
        }
      }
    ]
  }
}
```

---

## Attendance & Geofencing Engine

The core attendance engine implements strict domain rules mandated in [AGENTS.md](file:///c:/Users/DELL/Desktop/RSG%20APP/AGENTS.md):
1. **Idempotency**: Every write request (`check-in`, `check-out`, `manual entry`) accepts a unique `request_id` (`UNIQUE` column in MySQL). Repeated requests or offline retries return the original result without duplicate record creation.
2. **Shift Verification & Overnight Shifts**: Checks if the shift is assigned to the employee for today. Supports shifts crossing midnight (e.g. 22:00 - 06:00) cleanly.
3. **Haversine Geofencing & GPS Accuracy**: Validates guard location against branch latitude/longitude pin and `radius_m`. Rejects weak GPS accuracy (`> MAX_GPS_ACCURACY_METERS`, default 150m) with `400 POOR_GPS_ACCURACY`.
4. **Early Start Restriction**: If employee has `restrict_early_start = true`, rejects check-ins attempted prior to the scheduled shift start minus allowable buffer (`EARLY_START_ALLOWED_MINUTES`, default 15m) with `403 EARLY_START_RESTRICTED`.
5. **Single Active Shift**: Enforces strictly one active checked-in shift per employee at any given time. Rejects concurrent check-ins with `409 ACTIVE_SHIFT_EXISTS`.
6. **UTC Storage**: Stores both `device_time` and `server_time` in UTC.
7. **5-Minute Clock Rounding**: Automatically rounds check-in and check-out timestamps to the nearest 5-minute interval (`ATTENDANCE_ROUNDING_MINUTES`).
8. **Payroll Calculation**: On check-out, computes gross duration, deducts scheduled lunch (`lunch_deduction_minutes`), and credits overtime if enabled (`overtime_enabled`) up to `overtime_limit_hours`.
9. **Manager Oversight**: Manual record creation, active checked-in roster monitoring, manager forced check-out, and record deletion—all fully audited in `audit_logs`.
10. **Automated Background Cron**:
    - **Auto-Absent Job**: Runs every 15 minutes. Automatically flags unstarted assigned shifts as `absent` after `AUTO_ABSENT_GRACE_MINUTES` (30m) and generates an alert for managers.
    - **Auto Check-Out Job**: Runs every 15 minutes. Clocks out guards with `auto_checkout = true` once shift end time has passed (`system_generated = true`).

---

### Attendance Endpoints

#### 1. Guard Check-In (`POST /attendance/check-in`)
```bash
curl -X POST http://localhost:4000/attendance/check-in \
  -H "Authorization: Bearer <EMPLOYEE_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "shift_id": "shift-day-001",
    "lat": 51.5073509,
    "lng": -0.1277583,
    "accuracy_m": 12.0,
    "device_time": "2026-11-01T07:58:00.000Z",
    "method": "gps",
    "request_id": "req-checkin-uuid-101"
  }'
```
Response:
```json
{
  "success": true,
  "data": {
    "id": "att-001",
    "user_id": "user-guard-001",
    "shift_id": "shift-day-001",
    "status": "checked_in",
    "method": "gps",
    "check_in_at": "2026-11-01T08:00:00.000Z",
    "device_time": "2026-11-01T07:58:00.000Z",
    "server_time": "2026-11-01T07:58:02.120Z",
    "system_generated": false,
    "sync_status": "synced",
    "request_id": "req-checkin-uuid-101"
  }
}
```

#### 2. Guard Check-Out (`POST /attendance/check-out`)
```bash
curl -X POST http://localhost:4000/attendance/check-out \
  -H "Authorization: Bearer <EMPLOYEE_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "shift_id": "shift-day-001",
    "lat": 51.5073509,
    "lng": -0.1277583,
    "accuracy_m": 10.0,
    "device_time": "2026-11-01T17:31:00.000Z",
    "method": "gps",
    "request_id": "req-checkout-uuid-102"
  }'
```
Response:
```json
{
  "success": true,
  "data": {
    "id": "att-001",
    "status": "present",
    "check_in_at": "2026-11-01T08:00:00.000Z",
    "check_out_at": "2026-11-01T17:30:00.000Z",
    "hours_worked": "9.00",
    "overtime_hours": "1.00",
    "lunch_deduction": 30,
    "request_id": "req-checkin-uuid-101",
    "checkout_request_id": "req-checkout-uuid-102"
  }
}
```

#### 3. Manager Active On-Duty List (`GET /attendance/active`)
```bash
curl -X GET "http://localhost:4000/attendance/active?branch_id=branch-hq-001" \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### 4. Manager Manual Attendance Entry (`POST /attendance/manual`)
```bash
curl -X POST http://localhost:4000/attendance/manual \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-guard-001",
    "shift_id": "shift-day-001",
    "check_in_at": "2026-11-01T08:00:00.000Z",
    "check_out_at": "2026-11-01T16:00:00.000Z",
    "status": "present",
    "notes": "Manual entry approved by manager for card issue",
    "request_id": "req-manual-entry-103"
  }'
```

#### 5. Manager Force Check-Out (`POST /attendance/:id/force-checkout`)
```bash
curl -X POST http://localhost:4000/attendance/att-001/force-checkout \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### 6. Manager Delete Attendance Record (`DELETE /attendance/:id`)
```bash
curl -X DELETE http://localhost:4000/attendance/att-001 \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

---

### Running Attendance Tests

Execute the comprehensive attendance suite:
```bash
npm test -- src/__tests__/attendance.test.ts
```
Covers:
- Standard check-in within geofence with 5-min clock rounding
- Check-in idempotency (duplicate `request_id`)
- Second active shift rejection (`409 ACTIVE_SHIFT_EXISTS`)
- Geofence boundary violation (`403 OUTSIDE_GEOFENCE`)
- Weak GPS accuracy rejection (`400 POOR_GPS_ACCURACY`)
- Restricted early start rejection (`403 EARLY_START_RESTRICTED`)
- Check-out with lunch deduction and overtime calculations
- Check-out idempotency (duplicate `checkout_request_id`)
- Overnight shift handling crossing midnight
- Manager manual entry with audit logging
- Manager active roster listing & force check-out
- Manager record deletion with audit logging
- Auto-absent and auto check-out cron job triggers

---

## QR Patrol Checkpoint Engine

The QR Patrol system provides tamper-proof checkpoint verification and patrol monitoring according to [AGENTS.md](file:///c:/Users/DELL/Desktop/RSG%20APP/AGENTS.md):
- **Signed Tokens (Rule 6)**: Checkpoints use HMAC-SHA256 cryptographically signed tokens containing checkpoint ID, branch ID, name, date ranges, and timestamp.
- **Physical QR Generation**: Managers can download high-resolution printable PNG QR images (`GET /patrol/qrs/:id/image`) or access base64 PNG data URLs for embedding in mobile or web applications.
- **Idempotency (Rule 2)**: Every scan write accepts a unique `request_id` (`UNIQUE` column in MySQL). Repeated requests or offline retries return the original record.
- **Verification & Branch Scope (Rule 3)**: Validates HMAC signature, branch scope, and active dates. Rejects expired or inactive checkpoints with `400 QR_EXPIRED` or `400 INVALID_TOKEN`.
- **Anomaly Detection**:
  - **Duplicate Rapid Scans**: Scans of the same checkpoint within 5 minutes are flagged with `is_anomaly = true` and reason `DUPLICATE_SCAN`.
  - **Suspicious GPS**: Scans submitted from coordinates outside the branch perimeter or with weak GPS accuracy are flagged with `is_anomaly = true` and reason `SUSPICIOUS_GPS`.
- **UTC Timestamp Storage (Rule 1)**: Stores both `device_time` and `server_time` in UTC.
- **Audit Logs (Rule 7 & 8)**: Append-only audit records for QR creation and scan events without logging raw tokens or passwords.
- **Missed Patrol Alerts**: Automated background cron monitors active checkpoints and creates an `Alert` (`type: missed_patrol`) when an expected scan interval is exceeded.
- **Reporting & Excel Export**: Filterable patrol history with one-click `.xlsx` spreadsheet download.

---

### Patrol API Endpoints

#### 1. Manager Create Patrol QR Checkpoint (`POST /patrol/qrs`)
```bash
curl -X POST http://localhost:4000/patrol/qrs \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "branch-hq-001",
    "name": "Perimeter Gate 3 Checkpoint",
    "description": "Mounted on North perimeter gate post",
    "interval_minutes": 60,
    "start_date": "2026-11-01T00:00:00.000Z",
    "end_date": "2027-11-01T00:00:00.000Z"
  }'
```
Response:
```json
{
  "success": true,
  "data": {
    "id": "qr-checkpoint-001",
    "name": "Perimeter Gate 3 Checkpoint",
    "signed_token": "eyJxcl9pZCI6...<signature>",
    "interval_minutes": 60,
    "qr_data_url": "data:image/png;base64,iVBORw0KGgo...",
    "is_active": true
  }
}
```

#### 2. Download Printable QR PNG Image (`GET /patrol/qrs/:id/image`)
```bash
curl -X GET http://localhost:4000/patrol/qrs/qr-checkpoint-001/image \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -o checkpoint-qr.png
```

#### 3. Guard Patrol Checkpoint Scan (`POST /patrol/scan`)
```bash
curl -X POST http://localhost:4000/patrol/scan \
  -H "Authorization: Bearer <EMPLOYEE_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJxcl9pZCI6...<signature>",
    "lat": 51.5073509,
    "lng": -0.1277583,
    "accuracy_m": 10.0,
    "device_time": "2026-11-01T23:15:00.000Z",
    "request_id": "req-patrol-scan-991"
  }'
```
Response:
```json
{
  "success": true,
  "data": {
    "id": "scan-001",
    "qr_id": "qr-checkpoint-001",
    "user_id": "user-guard-001",
    "device_time": "2026-11-01T23:15:00.000Z",
    "server_time": "2026-11-01T23:15:01.450Z",
    "lat": 51.5073509,
    "lng": -0.1277583,
    "is_anomaly": false,
    "anomaly_reason": null,
    "request_id": "req-patrol-scan-991"
  }
}
```

#### 4. Manager Query Patrol Logs (`GET /patrol/logs`)
```bash
curl -X GET "http://localhost:4000/patrol/logs?branch_id=branch-hq-001&is_anomaly=true&page=1&limit=20" \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>"
```

#### 5. Manager Export Patrol Logs to Excel (`GET /patrol/logs/export`)
```bash
curl -X GET "http://localhost:4000/patrol/logs/export?branch_id=branch-hq-001" \
  -H "Authorization: Bearer <MANAGER_ACCESS_TOKEN>" \
  -o patrol-logs-2026-11-01.xlsx
```

---

### Running Patrol Tests

Execute the comprehensive QR patrol test suite:
```bash
npm test -- src/__tests__/patrol.test.ts
```
Covers:
- Patrol QR creation with HMAC signature and base64 PNG data URL
- Downloadable high-resolution PNG QR image endpoint (`GET /patrol/qrs/:id/image`)
- RBAC authorization (guards blocked from creating checkpoints)
- Valid patrol scan storing UTC `device_time` and `server_time`
- Scan idempotency via `request_id`
- Rapid duplicate scan anomaly detection within 5-minute threshold
- Suspicious GPS anomaly detection outside branch geofence perimeter
- Rejection of tampered HMAC signatures (`400 INVALID_TOKEN`)
- Rejection of malformed tokens (`400 INVALID_TOKEN`)
- Rejection of expired checkpoints (`400 QR_EXPIRED`)
- Filtered patrol scan query and pagination
- Formatted Excel spreadsheet (.xlsx) export
- Automated missed patrol detection cron triggering `Alert` (`type: 'missed_patrol'`)

