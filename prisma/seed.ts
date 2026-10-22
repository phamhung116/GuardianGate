import {
  AccessRequestKind,
  AccessRequestStatus,
  PrismaClient,
  RecordGroup,
} from "@prisma/client";

const prisma = new PrismaClient();

const ids = {
  doctorA: "10000000-0000-4000-8000-000000000001",
  doctorB: "10000000-0000-4000-8000-000000000002",
  doctorUnassigned: "10000000-0000-4000-8000-000000000003",
  guardianA: "20000000-0000-4000-8000-000000000001",
  guardianB: "20000000-0000-4000-8000-000000000002",
  admin: "30000000-0000-4000-8000-000000000001",
  privacy: "30000000-0000-4000-8000-000000000002",
  compliance: "30000000-0000-4000-8000-000000000003",
  child: "40000000-0000-4000-8000-000000000001",
  consultation: "50000000-0000-4000-8000-000000000001",
  ordinaryRequest: "60000000-0000-4000-8000-000000000001",
};

async function main() {
  await prisma.$transaction(async (tx) => {
    const users = [
      [ids.doctorA, "demo-doctor-a", "BS. An Nguyễn"],
      [ids.doctorB, "demo-doctor-b", "BS. Bình Trần"],
      [ids.doctorUnassigned, "demo-doctor-unassigned", "BS. Chưa phân công"],
      [ids.guardianA, "demo-guardian-a", "Giám hộ An"],
      [ids.guardianB, "demo-guardian-b", "Giám hộ Bình"],
      [ids.admin, "demo-admin", "Quản trị viên"],
      [ids.privacy, "demo-privacy", "Privacy Officer"],
      [ids.compliance, "demo-compliance", "Compliance Approver"],
    ] as const;

    for (const [id, tideSubject, displayName] of users) {
      await tx.appUser.upsert({
        where: { id },
        update: { tideSubject, displayName },
        create: { id, tideSubject, displayName },
      });
    }

    await tx.child.upsert({
      where: { id: ids.child },
      update: {},
      create: {
        id: ids.child,
        demoIdentifier: "GG-CHILD-001",
        displayName: "Minh Anh (dữ liệu giả)",
        dateOfBirth: new Date("2016-04-12T00:00:00.000Z"),
      },
    });

    for (const guardianUserId of [ids.guardianA, ids.guardianB]) {
      await tx.guardianLink.upsert({
        where: { childId_guardianUserId: { childId: ids.child, guardianUserId } },
        update: { verified: true },
        create: { childId: ids.child, guardianUserId, verified: true },
      });
    }

    await tx.consultation.upsert({
      where: { id: ids.consultation },
      update: { status: "active" },
      create: {
        id: ids.consultation,
        childId: ids.child,
        status: "active",
        startsAt: new Date("2026-10-22T01:00:00.000Z"),
      },
    });

    for (const clinicianUserId of [ids.doctorA, ids.doctorB]) {
      await tx.consultationClinician.upsert({
        where: {
          consultationId_clinicianUserId: {
            consultationId: ids.consultation,
            clinicianUserId,
          },
        },
        update: {},
        create: { consultationId: ids.consultation, clinicianUserId },
      });
    }

    await tx.clinicalSummary.upsert({
      where: { childId: ids.child },
      update: {},
      create: {
        childId: ids.child,
        allergies: "Dị ứng penicillin (dữ liệu giả)",
        currentMedications: "Không có thuốc thường xuyên (dữ liệu giả)",
        emergencyNotes: "Liên hệ giám hộ; nhóm máu O+ (dữ liệu giả)",
      },
    });

    if ((await tx.encounterRecord.count({ where: { childId: ids.child } })) === 0) {
      await tx.encounterRecord.create({
        data: {
          childId: ids.child,
          consultationId: ids.consultation,
          diagnosis: "Viêm họng nhẹ (dữ liệu giả)",
          clinicianNote: "Theo dõi và tái khám nếu sốt kéo dài (dữ liệu giả)",
          recordedAt: new Date("2026-10-22T02:00:00.000Z"),
        },
      });
    }

    if ((await tx.diagnosticResult.count({ where: { childId: ids.child } })) === 0) {
      await tx.diagnosticResult.create({
        data: {
          childId: ids.child,
          consultationId: ids.consultation,
          resultType: "Xét nghiệm máu giả lập",
          resultSummary: "Các chỉ số trong giới hạn demo",
          recordedAt: new Date("2026-10-22T02:30:00.000Z"),
        },
      });
    }

    if ((await tx.sensitiveRecord.count({ where: { childId: ids.child } })) === 0) {
      await tx.sensitiveRecord.create({
        data: {
          childId: ids.child,
          classification: "behavioral-health-demo",
          content: "Nội dung nhạy cảm hoàn toàn giả lập",
          recordedAt: new Date("2026-10-22T02:45:00.000Z"),
        },
      });
    }

    await tx.accessRequest.upsert({
      where: { id: ids.ordinaryRequest },
      update: {},
      create: {
        id: ids.ordinaryRequest,
        requestKind: AccessRequestKind.ordinary,
        childId: ids.child,
        requesterUserId: ids.doctorA,
        consultationId: ids.consultation,
        purpose: "Khám và điều trị trong ca đang hoạt động",
        status: AccessRequestStatus.pending,
        requestedExpiresAt: new Date("2026-10-23T02:00:00.000Z"),
        scopes: { create: [{ recordGroup: RecordGroup.summary }] },
      },
    });
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
