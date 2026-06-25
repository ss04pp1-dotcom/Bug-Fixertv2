---
name: Notification user endpoints
description: NotificationRead table and user-facing notification API endpoints
---

The `Notification` model is admin-only broadcast. A `NotificationRead` join table was added for per-user read receipts.

User endpoints (no Roles guard, only JwtAuthGuard):
- GET  /api/v1/notifications/user          — filtered by targetAll/targetUsers/targetRoles
- PATCH /api/v1/notifications/user/:id/read — upsert into notification_reads
- POST  /api/v1/notifications/user/read-all
- GET  /api/v1/notifications/user/unread-count

Admin endpoints retain `@Roles('super_admin', 'admin', 'moderator')` at method level (not class level).

**Why:** Mobile app called these endpoints but they didn't exist; all notifications routes were admin-only.
**How to apply:** Any future user-facing notification feature goes on /notifications/user/* prefix.
