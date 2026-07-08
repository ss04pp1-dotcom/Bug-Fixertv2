# Secret Rotation Policy — SOL TV API

## Problem: Rotating JWT Secrets Invalidates ALL Sessions

When `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` is rotated, every active session
instantly breaks — users are logged out with no warning. This is the expected outcome
from a security standpoint (a leaked secret means all sessions are compromised), but
operationally it creates support burden.

## Current State

Single-secret HMAC-SHA256 signing (`HS256`). No `kid` (key ID) header in tokens.
Rotation is a hard cutover — zero grace period.

## Recommended Approach: kid-based Key Rotation

### Short term (implement now)

1. **Dual-secret window**: Keep the old and new secret both valid for 24h during rotation.
   - Add `JWT_ACCESS_SECRET_OLD` / `JWT_REFRESH_SECRET_OLD` env vars.
   - In `jwt.strategy.ts`, validate against the new secret first, then fall back to
     the old secret if that fails. After 24h, remove the `_OLD` vars.
   - This gives all active sessions time to refresh naturally.

2. **Emergency revocation**: The `Session` table already has `isActive` and `expiresAt`.
   Run `UPDATE sessions SET is_active = false WHERE created_at < NOW()` to mass-revoke
   all sessions without needing to rotate the secret.

### Long term (next major version)

Migrate to RS256 (asymmetric signing) or use `kid`-tagged symmetric keys:

```typescript
// In JwtService.sign():
const kid = 'v2'; // bump on each rotation
const token = jwt.sign(payload, currentSecret, { algorithm: 'HS256', header: { kid } });

// In JwtStrategy.validate():
const decoded = jwt.decode(token, { complete: true });
const secret = decoded?.header?.kid === 'v2' ? secrets.v2 : secrets.v1;
jwt.verify(token, secret);
```

This allows zero-downtime rotation: new tokens use `kid=v2`, old tokens with `kid=v1`
are still valid until their natural expiry.

## Rotation Runbook

```bash
# 1. Generate new secrets
NEW_ACCESS=$(openssl rand -hex 32)
NEW_REFRESH=$(openssl rand -hex 32)

# 2. Set OLD vars to current values (dual-secret window)
# In Render: Env → add JWT_ACCESS_SECRET_OLD = current JWT_ACCESS_SECRET
# In Render: Env → add JWT_REFRESH_SECRET_OLD = current JWT_REFRESH_SECRET

# 3. Update primary secrets to new values
# In Render: Env → update JWT_ACCESS_SECRET = $NEW_ACCESS
# In Render: Env → update JWT_REFRESH_SECRET = $NEW_REFRESH

# 4. Deploy (both old and new secrets valid for 24h)

# 5. After 24h: remove _OLD env vars and redeploy
```

## Related

- Session cleanup cron: `analytics-retention.service.ts` → `purgeExpiredSessions()`
- Session table: `prisma/schema.prisma` → `model Session`
