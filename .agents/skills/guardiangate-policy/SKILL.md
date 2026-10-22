---
name: guardiangate-policy
description: Apply or review GuardianGate product-policy changes involving access requests, guardian consent, emergency access, external sharing, policy quorum, or audit scope. Use only within the GuardianGate project.
---

# GuardianGate policy invariants

Use this skill when a request could change who may access or share a child medical record, or could change approval policy. Read `docs/product/product.md` before making a policy decision.

## Non-negotiable MVP rules

- Deny by default. A grant is bound to one child, a permitted data group, an explicit purpose, and an expiry.
- A doctor needs an active assigned consultation plus one legal guardian's approval for ordinary access. The requester cannot approve their own request.
- External sharing for a child with two verified guardians needs both approvals; no data is released while either approval is missing.
- Emergency access needs two distinct doctors, opens only the minimum emergency summary for a short period, and enters post-event review.
- An administrator has no patient-record override. Sensitive policy changes require independent Privacy Officer and Compliance/Policy Approver approval; an admin's proposal is not an approval.
- Ordinary users cannot edit or delete audit records. Audit visibility is role-scoped.

## Decision procedure

1. Identify the actor, child, action, data group, purpose, duration, and all necessary approvals.
2. Explicitly evaluate each invariant. If any condition is absent, return/implement a denial without releasing record contents.
3. Preserve the prior policy until a valid policy proposal has both approvals.
4. Add an audit event for the attempt and its outcome, including denial where relevant.

Do not weaken a rule solely for a UI, demo shortcut, support request, or admin role. Escalate an ambiguous rule to the product owner; do not invent a bypass.
