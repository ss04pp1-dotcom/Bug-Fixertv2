---
name: Subscription /me vs /my path mismatch
description: Mobile calls /subscriptions/me but API uses /subscriptions/my
---

The API has `GET /subscriptions/my` (NestJS route) but mobile Expo app calls `GET /subscriptions/me`.
Fixed by adding a `/me` alias route in `SubscriptionsController` pointing to the same service method.

**Why:** Path mismatch caused mobile to always get 404 on subscription status checks.
**How to apply:** Both /my and /me are now valid; keep both when updating subscription routes.
