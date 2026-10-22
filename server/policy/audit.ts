import type { TideActor } from "@/server/auth/tide";
import { getState, now, type AuditEvent, type AuditEventType, type RecordGroup } from "@/server/policy/store";

export interface AuditInput {
  eventType: AuditEventType;
  actor: TideActor | null;
  childId?: string | null;
  accessRequestId?: string | null;
  policyProposalId?: string | null;
  recordGroups?: RecordGroup[];
  detail?: Record<string, unknown>;
}

/** Optional mirrors (e.g. a Prisma writer for `audit_events`). Failures never block the demo. */
export type AuditSink = (event: Readonly<AuditEvent>) => Promise<void> | void;
const sinks: AuditSink[] = [];

export function registerAuditSink(sink: AuditSink): void {
  sinks.push(sink);
}

/** The only write path for audit. There is deliberately no update or delete function. */
export function appendAudit(input: AuditInput): Readonly<AuditEvent> {
  const state = getState();
  const event: AuditEvent = Object.freeze({
    id: crypto.randomUUID(),
    sequence: state.audit.length + 1,
    eventType: input.eventType,
    actorSubject: input.actor?.subject ?? null,
    actorRoles: Object.freeze([...(input.actor?.roles ?? [])]) as string[],
    childId: input.childId ?? null,
    accessRequestId: input.accessRequestId ?? null,
    policyProposalId: input.policyProposalId ?? null,
    recordGroups: Object.freeze([...(input.recordGroups ?? [])]) as RecordGroup[],
    occurredAt: now().toISOString(),
    detail: Object.freeze({ ...(input.detail ?? {}) }),
  });
  state.audit.push(event);

  for (const sink of sinks) {
    try {
      void Promise.resolve(sink(event)).catch(() => undefined);
    } catch {
      // Mirrors are best-effort; the in-memory log stays authoritative for the demo.
    }
  }
  return event;
}

export function auditEvents(): readonly Readonly<AuditEvent>[] {
  return getState().audit;
}
