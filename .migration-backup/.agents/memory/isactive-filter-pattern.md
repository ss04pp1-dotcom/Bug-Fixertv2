---
name: isActive filter pattern for movies and series
description: How isActive filtering works across public vs admin contexts for MoviesService and SeriesService
---

## Rule
`findAll()` supports three modes via `?isActive=` query param:
- `true` (default when omitted) — public/mobile: only active records
- `false` — admin: only inactive records
- `all` — admin: no filter, all records regardless of isActive

`findOne()` always enforces `isActive: true` (public-facing lookup, used by mobile).

`update()` and `remove()` call the private `findOneAdmin()` which omits the `isActive` filter, so admins can edit and soft-delete inactive records without getting a 404.

**Why:** Deactivated content was leaking to public users because `findAll`/`findOne` only checked `deletedAt: null`. Admin needed to retain write access to inactive records without bypassing the public gate.

**How to apply:**
- Any new public content service (banners, episodes, etc.) should follow this same split: `findOne` (isActive:true) vs `findOneAdmin` (no isActive).
- Admin pages that list all content must pass `?isActive=all` to the API.
- Mobile/public callers must NOT pass isActive param (defaults to `true`) or must explicitly pass `isActive=true`.
