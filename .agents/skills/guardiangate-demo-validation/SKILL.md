---
name: guardiangate-demo-validation
description: Validate GuardianGate's policy-enforcement prototype against its required demo scenarios and evidence. Use when preparing demos, tests, QA checks, or release-readiness reviews for GuardianGate.
---

# GuardianGate demo validation

Read `docs/product/product.md` before validation. Use fake data only; do not introduce real patient data while testing.

## Evidence required for each scenario

Capture the actor identities, inputs, visible policy result, accessible data groups (if any), expiry/approval state, and associated audit event. A green UI state alone is insufficient evidence.

## Minimum acceptance suite

1. A doctor outside the active consultation is denied and receives no record contents.
2. A doctor in the consultation remains blocked while ordinary access is pending.
3. After one legal guardian approves ordinary access, the doctor sees only the approved data group until expiry.
4. One approval cannot release an external share when two verified guardians are present; two approvals release only the approved recipient/scope/purpose/duration.
5. One doctor cannot activate emergency access alone; two distinct doctors release only the emergency summary temporarily and create a post-review audit event.
6. An admin's unquorate policy proposal, including self-granting access, changes nothing; Privacy plus Compliance approval is required before an allowed proposal is effective.
7. Expired or revoked access is denied on a later attempt.
8. Every scenario leaves an audit trail appropriate to the viewer's role.

Classify a failure as `policy bypass`, `scope leak`, `state/expiry defect`, `audit defect`, or `presentation-only defect`. A policy bypass or scope leak blocks a demo-ready claim until fixed and rechecked.
