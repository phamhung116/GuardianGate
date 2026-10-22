---
name: guardiangate-enforcement
description: Build or modify GuardianGate backend and integration behavior so record access and policy decisions are enforced server-side, not merely represented in the UI. Use only for GuardianGate implementation work.
---

# GuardianGate policy enforcement

Read `docs/product/product.md` and the `guardiangate-policy` skill before changing any protected-data flow.

## Required implementation outcome

Every protected-data route or service must decide from authenticated identity and authoritative policy state before fetching or returning content. The client may display status, but must not be the enforcement point.

## Implementation checks

- Derive identity and role from the authentication integration; do not trust a client-supplied role, approver, scope, expiry, or consultation relationship.
- Evaluate the ordinary, external-share, emergency, and policy-change flows separately. Do not reuse an ordinary grant for external sharing or emergency access.
- Fail closed for missing/invalid identity, relationship, scope, purpose, approval, expiration, revocation, or approver independence.
- Return only the approved data group, never a full record as a convenience fallback.
- Make expiration and revocation observable at the next protected access attempt.
- Record a role-appropriate audit event for requests, approvals, denials, grants, accesses, expiry/revocation, and policy proposals/activation.

## Change boundary

If a requested feature would alter the approval threshold, introduce a broad administrator grant, omit audit, or put a required check exclusively in the frontend, stop and request a product-policy decision. Do not silently reinterpret the product specification.
