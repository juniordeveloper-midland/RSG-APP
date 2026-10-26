# Region Security Guarding - Guard Management Platform

## Stack
- backend/: Node.js + Express + MySQL 8 + Prisma ORM, TypeScript, JWT (access + refresh), bcrypt, zod validation, helmet, express-rate-limit, node-cron, multer
- mobile/: React Native with Expo, TypeScript
- web-portal/: React + Vite + TypeScript (management portal)

## Theme (use everywhere, mobile and web)
- Primary: #eb0505
- Background: #333333
- Surface/cards: #3d3d3d
- Border: #4a4a4a
- Text: #ffffff, muted text: #bdbdbd
- White text on red buttons. Do NOT use #eb0505 for small body text on #333333 (low contrast); use it for buttons, active tabs, icons, highlights.
- Define colors once: mobile/src/theme.ts and web-portal/src/theme.css (CSS variables). Never hardcode hex values elsewhere.
- Dark UI, clean and simple, large touch targets on mobile.

## Domain rules (must follow)
1. Store all times in UTC. Store BOTH device_time and server_time for attendance and patrol scans.
2. Every write endpoint accepts a unique request_id (UNIQUE column) for idempotency; offline retries must never create duplicates.
3. Roles: "employee" and "manager" (managerial access). Check role AND branch scope in middleware on every protected route.
4. Suspended users cannot log in.
5. Attendance: one active shift per employee, geofence check (Haversine) per branch radius, optional early-start restriction, auto-absent cron, auto check-out labelled system_generated=true.
6. QR patrol uses signed tokens. A QR scan only proves a scan event, nothing more.
7. audit_logs table is append-only: no update or delete.
8. Never log passwords or tokens. Validate all input with zod. Use helmet and rate limiting.

## Code style
- TypeScript strict mode, async/await, controller/service/route folder structure.
- Consistent JSON error format: { error: { code, message } }.
- Add a short README section after each feature explaining how to run and test it.
- Small commits-ready changes. Do not install unrelated packages.

## Add Swagger documentation
- Every API route must have an @openapi Swagger comment (tags, request body, responses, bearerAuth for protected routes)