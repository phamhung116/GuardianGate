-- CreateEnum
CREATE TYPE "consultation_status" AS ENUM ('active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "access_request_kind" AS ENUM ('ordinary', 'external_share', 'emergency');

-- CreateEnum
CREATE TYPE "access_request_status" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "record_group" AS ENUM ('summary', 'encounter', 'diagnostic', 'sensitive');

-- CreateEnum
CREATE TYPE "approval_decision" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "policy_change_type" AS ENUM ('access_duration', 'emergency_window', 'data_scope', 'governance_rule');

-- CreateEnum
CREATE TYPE "policy_proposal_status" AS ENUM ('proposed', 'approved', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "audit_event_type" AS ENUM ('request_created', 'approval_recorded', 'access_granted', 'access_denied', 'record_accessed', 'request_expired', 'request_revoked', 'external_share_released', 'emergency_activated', 'emergency_review_required', 'policy_proposed', 'policy_approved', 'policy_rejected', 'policy_activated');

-- CreateTable
CREATE TABLE "app_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tide_subject" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "demo_identifier" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "child_id" UUID NOT NULL,
    "guardian_user_id" UUID NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "child_id" UUID NOT NULL,
    "allergies" TEXT NOT NULL,
    "current_medications" TEXT NOT NULL,
    "emergency_notes" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "child_id" UUID NOT NULL,
    "consultation_id" UUID,
    "diagnosis" TEXT NOT NULL,
    "clinician_note" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "encounter_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "child_id" UUID NOT NULL,
    "consultation_id" UUID,
    "result_type" TEXT NOT NULL,
    "result_summary" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "diagnostic_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "child_id" UUID NOT NULL,
    "classification" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sensitive_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "child_id" UUID NOT NULL,
    "status" "consultation_status" NOT NULL DEFAULT 'active',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_clinicians" (
    "consultation_id" UUID NOT NULL,
    "clinician_user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_clinicians_pkey" PRIMARY KEY ("consultation_id","clinician_user_id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_kind" "access_request_kind" NOT NULL,
    "child_id" UUID NOT NULL,
    "requester_user_id" UUID NOT NULL,
    "consultation_id" UUID,
    "purpose" TEXT NOT NULL,
    "recipient_name" TEXT,
    "emergency_reason" TEXT,
    "status" "access_request_status" NOT NULL DEFAULT 'pending',
    "requested_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "approved_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_request_scopes" (
    "access_request_id" UUID NOT NULL,
    "record_group" "record_group" NOT NULL,

    CONSTRAINT "access_request_scopes_pkey" PRIMARY KEY ("access_request_id","record_group")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "access_request_id" UUID NOT NULL,
    "approver_user_id" UUID NOT NULL,
    "decision" "approval_decision" NOT NULL,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proposed_by_user_id" UUID NOT NULL,
    "change_type" "policy_change_type" NOT NULL,
    "proposed_value" JSONB NOT NULL,
    "status" "policy_proposal_status" NOT NULL DEFAULT 'proposed',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_at" TIMESTAMPTZ(6),

    CONSTRAINT "policy_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_proposal_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_proposal_id" UUID NOT NULL,
    "approver_user_id" UUID NOT NULL,
    "decision" "approval_decision" NOT NULL,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_proposal_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" "audit_event_type" NOT NULL,
    "actor_user_id" UUID,
    "child_id" UUID,
    "access_request_id" UUID,
    "policy_proposal_id" UUID,
    "record_groups" "record_group"[] DEFAULT ARRAY[]::"record_group"[],
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_users_tide_subject_key" ON "app_users"("tide_subject");

-- CreateIndex
CREATE UNIQUE INDEX "children_demo_identifier_key" ON "children"("demo_identifier");

-- CreateIndex
CREATE INDEX "guardian_links_guardian_user_id_child_id_idx" ON "guardian_links"("guardian_user_id", "child_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_links_child_id_guardian_user_id_key" ON "guardian_links"("child_id", "guardian_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_summaries_child_id_key" ON "clinical_summaries"("child_id");

-- CreateIndex
CREATE INDEX "encounter_records_child_id_recorded_at_idx" ON "encounter_records"("child_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "diagnostic_results_child_id_recorded_at_idx" ON "diagnostic_results"("child_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "sensitive_records_child_id_recorded_at_idx" ON "sensitive_records"("child_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "consultations_child_id_status_starts_at_idx" ON "consultations"("child_id", "status", "starts_at" DESC);

-- CreateIndex
CREATE INDEX "consultation_clinicians_clinician_user_id_consultation_id_idx" ON "consultation_clinicians"("clinician_user_id", "consultation_id");

-- CreateIndex
CREATE INDEX "access_requests_child_id_status_created_at_idx" ON "access_requests"("child_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "access_requests_requester_user_id_created_at_idx" ON "access_requests"("requester_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "approval_decisions_approver_user_id_decided_at_idx" ON "approval_decisions"("approver_user_id", "decided_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "approval_decisions_access_request_id_approver_user_id_key" ON "approval_decisions"("access_request_id", "approver_user_id");

-- CreateIndex
CREATE INDEX "policy_proposal_approvals_approver_user_id_decided_at_idx" ON "policy_proposal_approvals"("approver_user_id", "decided_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "policy_proposal_approvals_policy_proposal_id_approver_user__key" ON "policy_proposal_approvals"("policy_proposal_id", "approver_user_id");

-- CreateIndex
CREATE INDEX "audit_events_child_id_occurred_at_idx" ON "audit_events"("child_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_access_request_id_occurred_at_idx" ON "audit_events"("access_request_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_policy_proposal_id_occurred_at_idx" ON "audit_events"("policy_proposal_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_guardian_user_id_fkey" FOREIGN KEY ("guardian_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_summaries" ADD CONSTRAINT "clinical_summaries_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_records" ADD CONSTRAINT "encounter_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_records" ADD CONSTRAINT "encounter_records_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_records" ADD CONSTRAINT "sensitive_records_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_clinicians" ADD CONSTRAINT "consultation_clinicians_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_clinicians" ADD CONSTRAINT "consultation_clinicians_clinician_user_id_fkey" FOREIGN KEY ("clinician_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_request_scopes" ADD CONSTRAINT "access_request_scopes_access_request_id_fkey" FOREIGN KEY ("access_request_id") REFERENCES "access_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_access_request_id_fkey" FOREIGN KEY ("access_request_id") REFERENCES "access_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_proposals" ADD CONSTRAINT "policy_proposals_proposed_by_user_id_fkey" FOREIGN KEY ("proposed_by_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_proposal_approvals" ADD CONSTRAINT "policy_proposal_approvals_policy_proposal_id_fkey" FOREIGN KEY ("policy_proposal_id") REFERENCES "policy_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_proposal_approvals" ADD CONSTRAINT "policy_proposal_approvals_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_access_request_id_fkey" FOREIGN KEY ("access_request_id") REFERENCES "access_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_policy_proposal_id_fkey" FOREIGN KEY ("policy_proposal_id") REFERENCES "policy_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database checks required by docs/database/database.md and not expressible in Prisma 6.
ALTER TABLE "app_users"
    ADD CONSTRAINT "app_users_tide_subject_nonblank" CHECK (btrim("tide_subject") <> ''),
    ADD CONSTRAINT "app_users_display_name_nonblank" CHECK (btrim("display_name") <> '');

ALTER TABLE "children"
    ADD CONSTRAINT "children_demo_identifier_nonblank" CHECK (btrim("demo_identifier") <> ''),
    ADD CONSTRAINT "children_display_name_nonblank" CHECK (btrim("display_name") <> '');

ALTER TABLE "diagnostic_results"
    ADD CONSTRAINT "diagnostic_results_result_type_nonblank" CHECK (btrim("result_type") <> '');

ALTER TABLE "sensitive_records"
    ADD CONSTRAINT "sensitive_records_classification_nonblank" CHECK (btrim("classification") <> '');

ALTER TABLE "consultations"
    ADD CONSTRAINT "consultations_valid_time_range" CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at");

ALTER TABLE "access_requests"
    ADD CONSTRAINT "access_requests_future_expiry" CHECK ("requested_expires_at" > "created_at"),
    ADD CONSTRAINT "access_requests_valid_approval_time" CHECK ("approved_at" IS NULL OR "approved_at" >= "created_at"),
    ADD CONSTRAINT "access_requests_valid_revocation_time" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "created_at");

ALTER TABLE "policy_proposals"
    ADD CONSTRAINT "policy_proposals_value_object" CHECK (jsonb_typeof("proposed_value") = 'object'),
    ADD CONSTRAINT "policy_proposals_valid_effective_time" CHECK ("effective_at" IS NULL OR "effective_at" >= "created_at");

ALTER TABLE "audit_events"
    ALTER COLUMN "record_groups" SET NOT NULL,
    ADD CONSTRAINT "audit_events_detail_object" CHECK (jsonb_typeof("detail") = 'object');

-- Partial queue indexes required by approval inbox access patterns.
CREATE INDEX "access_requests_pending_created_at_idx"
    ON "access_requests"("status", "created_at") WHERE "status" = 'pending';

CREATE INDEX "policy_proposals_proposed_created_at_idx"
    ON "policy_proposals"("status", "created_at") WHERE "status" = 'proposed';
