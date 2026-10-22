import { beforeEach, describe, expect, it } from "vitest";

import type { TideActor } from "@/server/auth/tide";
import { auditEvents } from "@/server/policy/audit";
import {
  createEmergencyRequest,
  createExternalShare,
  createPolicyProposal,
  decidePolicyProposal,
  decideRequest,
  getExternalShare,
  listAudit,
  readChildRecord,
  revokeRequest,
} from "@/server/policy/service";
import { advanceClock, DEMO_IDS, getState, resetState } from "@/server/policy/store";

function actor(username: string): TideActor {
  const roles: Record<string, string[]> = {
    "demo-doctor-a": ["doctor"],
    "demo-doctor-b": ["doctor"],
    "demo-doctor-unassigned": ["doctor"],
    "demo-guardian-a": ["guardian"],
    "demo-guardian-b": ["guardian"],
    "demo-privacy": ["privacy_officer"],
    "demo-compliance": ["compliance_approver"],
    "demo-admin": ["admin"],
  };
  if (!roles[username]) throw new Error(`Missing demo actor: ${username}`);
  return { subject: username, username, roles: roles[username], claims: { tide_simulated: true } };
}

function expectDeniedWithoutRecord(
  result: ReturnType<typeof readChildRecord>,
  reason: string,
): asserts result is Extract<typeof result, { ok: false }> {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected a denied policy result");
  expect(result.reason).toBe(reason);
  expect(result).not.toHaveProperty("data");
  expect(JSON.stringify(result)).not.toContain("Dị ứng penicillin");
  expect(JSON.stringify(result)).not.toContain("Viêm họng nhẹ");
}

describe("GuardianGate minimum demo acceptance suite", () => {
  beforeEach(() => {
    process.env.GUARDIANGATE_DEMO_AUTH = "true";
    resetState();
  });

  it("1 · policy bypass: denies a doctor outside the active consultation without record contents", () => {
    const denied = readChildRecord(actor("demo-doctor-unassigned"), DEMO_IDS.child);

    expectDeniedWithoutRecord(denied, "not_assigned");
    expect(auditEvents().at(-1)).toMatchObject({
      eventType: "access_denied",
      actorSubject: "demo-doctor-unassigned",
      childId: DEMO_IDS.child,
      detail: { action: "read_record", reason: "not_assigned" },
    });
  });

  it("2 · policy bypass: keeps record data locked while ordinary approval is pending", () => {
    const denied = readChildRecord(actor("demo-doctor-a"), DEMO_IDS.child);

    expectDeniedWithoutRecord(denied, "approval_pending");
    expect(denied.details).toMatchObject({
      latestRequestId: DEMO_IDS.ordinaryRequest,
      latestStatus: "pending",
      missingApprovals: ["guardian_approval"],
    });
  });

  it("3 · scope leak: one verified guardian unlocks only the approved ordinary group", () => {
    const approved = decideRequest(actor("demo-guardian-a"), DEMO_IDS.ordinaryRequest, {
      decision: "approved",
      note: "Phê duyệt cho ca khám hiện tại",
    });
    expect(approved).toMatchObject({ ok: true, data: { status: "approved", recordGroups: ["summary"] } });

    const access = readChildRecord(actor("demo-doctor-a"), DEMO_IDS.child);
    expect(access.ok).toBe(true);
    if (!access.ok) throw new Error("Expected approved record access");
    expect(access.data.grantedGroups).toEqual(["summary"]);
    expect(Object.keys(access.data.data)).toEqual(["summary"]);
    expect(access.data.data).not.toHaveProperty("encounter");
    expect(access.data.data).not.toHaveProperty("diagnostic");
    expect(access.data.data).not.toHaveProperty("sensitive");
    expect(auditEvents().some((event) => event.eventType === "record_accessed")).toBe(true);
  });

  it("4 · policy bypass/scope leak: external share needs both verified guardians and keeps exact bounds", () => {
    const guardianA = actor("demo-guardian-a");
    const created = createExternalShare(guardianA, {
      childId: DEMO_IDS.child,
      recipientName: "Bệnh viện Đối tác (demo)",
      purpose: "Tham vấn chuyên khoa",
      recordGroups: ["diagnostic"],
      durationMinutes: 45,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("Expected an external-share request");

    const firstApproval = decideRequest(guardianA, created.data.id, { decision: "approved" });
    expect(firstApproval).toMatchObject({
      ok: true,
      data: { status: "pending", missingApprovals: ["guardian_approval:demo-guardian-b"] },
    });
    const stillLocked = getExternalShare(guardianA, created.data.id);
    expect(stillLocked).toMatchObject({ ok: true, data: { released: null } });

    const secondApproval = decideRequest(actor("demo-guardian-b"), created.data.id, {
      decision: "approved",
    });
    expect(secondApproval).toMatchObject({
      ok: true,
      data: {
        status: "approved",
        recipientName: "Bệnh viện Đối tác (demo)",
        purpose: "Tham vấn chuyên khoa",
        recordGroups: ["diagnostic"],
      },
    });

    const released = getExternalShare(guardianA, created.data.id);
    expect(released.ok).toBe(true);
    if (!released.ok) throw new Error("Expected released external share");
    expect(Object.keys(released.data.released ?? {})).toEqual(["diagnostic"]);
    expect(auditEvents().at(-1)?.eventType).not.toBe("access_denied");
    expect(auditEvents().some((event) => event.eventType === "external_share_released")).toBe(true);
  });

  it("5 · policy bypass/scope leak: emergency requires a distinct doctor and releases summary only", () => {
    const doctorA = actor("demo-doctor-a");
    const created = createEmergencyRequest(doctorA, {
      childId: DEMO_IDS.child,
      reason: "Phản ứng dị ứng cấp (demo)",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("Expected an emergency request");

    const beforeQuorum = readChildRecord(doctorA, DEMO_IDS.child);
    expectDeniedWithoutRecord(beforeQuorum, "approval_pending");
    expect(decideRequest(doctorA, created.data.id, { decision: "approved" })).toMatchObject({
      ok: false,
      reason: "same_doctor",
    });

    const confirmed = decideRequest(actor("demo-doctor-b"), created.data.id, {
      decision: "approved",
      note: "Xác nhận độc lập",
    });
    expect(confirmed).toMatchObject({
      ok: true,
      data: { status: "approved", recordGroups: ["summary"], reviewRequired: true },
    });

    const access = readChildRecord(doctorA, DEMO_IDS.child, { groups: ["summary"] });
    expect(access.ok).toBe(true);
    if (!access.ok) throw new Error("Expected emergency summary access");
    expect(Object.keys(access.data.data)).toEqual(["summary"]);
    expect(
      auditEvents().filter((event) =>
        ["emergency_activated", "emergency_review_required"].includes(event.eventType),
      ),
    ).toHaveLength(2);
  });

  it("6 · policy bypass: admin proposal changes nothing until Privacy + Compliance approve", () => {
    const admin = actor("demo-admin");
    const invalid = createPolicyProposal(admin, {
      changeType: "governance_rule",
      proposedValue: { adminOverrideAllRecords: true, principal: "demo-admin" },
      rationale: "Negative demo: attempt a self-grant",
    });
    expect(invalid).toMatchObject({
      ok: true,
      data: { status: "proposed", invariantViolations: expect.arrayContaining(["admin_no_override", "no_self_grant"]) },
    });
    expectDeniedWithoutRecord(readChildRecord(admin, DEMO_IDS.child), "admin_no_override");

    const valid = createPolicyProposal(admin, {
      changeType: "access_duration",
      proposedValue: { ordinaryMaxMinutes: 180 },
      rationale: "Giảm thời hạn grant thường",
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) throw new Error("Expected a valid proposal");
    expect(getState().policy).toMatchObject({ version: 1, ordinaryMaxMinutes: 240 });

    const privacy = decidePolicyProposal(actor("demo-privacy"), valid.data.id, { decision: "approved" });
    expect(privacy).toMatchObject({
      ok: true,
      data: { status: "proposed", missingApprovals: ["compliance_approver"] },
    });
    expect(getState().policy).toMatchObject({ version: 1, ordinaryMaxMinutes: 240 });

    const compliance = decidePolicyProposal(actor("demo-compliance"), valid.data.id, {
      decision: "approved",
    });
    expect(compliance).toMatchObject({ ok: true, data: { status: "approved" } });
    expect(getState().policy).toMatchObject({ version: 2, ordinaryMaxMinutes: 180 });
    expectDeniedWithoutRecord(readChildRecord(admin, DEMO_IDS.child), "admin_no_override");
  });

  it("7 · state/expiry defect: denies later access after expiration and revocation", () => {
    const doctor = actor("demo-doctor-a");
    const guardian = actor("demo-guardian-a");
    expect(decideRequest(guardian, DEMO_IDS.ordinaryRequest, { decision: "approved" }).ok).toBe(true);

    advanceClock(61);
    expectDeniedWithoutRecord(readChildRecord(doctor, DEMO_IDS.child), "expired");
    expect(auditEvents().some((event) => event.eventType === "request_expired")).toBe(true);

    resetState();
    expect(decideRequest(guardian, DEMO_IDS.ordinaryRequest, { decision: "approved" }).ok).toBe(true);
    expect(revokeRequest(guardian, DEMO_IDS.ordinaryRequest, { note: "Giám hộ thu hồi" }).ok).toBe(true);
    expectDeniedWithoutRecord(readChildRecord(doctor, DEMO_IDS.child), "revoked");
    expect(auditEvents().some((event) => event.eventType === "request_revoked")).toBe(true);
  });

  it("8 · audit defect: leaves immutable events and enforces viewer-specific audit scope", () => {
    readChildRecord(actor("demo-doctor-unassigned"), DEMO_IDS.child);
    decideRequest(actor("demo-guardian-a"), DEMO_IDS.ordinaryRequest, { decision: "approved" });
    readChildRecord(actor("demo-doctor-a"), DEMO_IDS.child);

    const events = auditEvents();
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events.every((event) => Object.isFrozen(event) && Object.isFrozen(event.detail))).toBe(true);
    expect(events.every((event) => event.actorSubject !== undefined && event.occurredAt && event.eventType)).toBe(true);

    const doctorLog = listAudit(actor("demo-doctor-a"));
    const guardianLog = listAudit(actor("demo-guardian-a"));
    const privacyLog = listAudit(actor("demo-privacy"));
    const adminLog = listAudit(actor("demo-admin"));

    expect(doctorLog).toMatchObject({ ok: true, data: { scope: "doctor_own" } });
    expect(guardianLog).toMatchObject({ ok: true, data: { scope: "guardian_children" } });
    expect(privacyLog).toMatchObject({ ok: true, data: { scope: "privacy_full" } });
    expect(adminLog).toMatchObject({ ok: true, data: { scope: "admin_technical" } });
    if (adminLog.ok) {
      expect(adminLog.data.events.every((event) => event.childId === null)).toBe(true);
      expect(JSON.stringify(adminLog.data.events)).not.toContain("Dị ứng penicillin");
      expect(JSON.stringify(adminLog.data.events)).not.toContain("Khám và điều trị trong ca đang hoạt động");
    }
  });
});
