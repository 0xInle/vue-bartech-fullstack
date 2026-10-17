import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Prisma, PrismaClient } from "@bartech/database";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: resolve(fileURLToPath(new URL("../../../.env.local", import.meta.url))) });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

const [action, emailInput, permissionInput] = process.argv.slice(2);
const email = emailInput?.trim();
const normalizedEmail = email?.toLowerCase();
const allowedPermissions = new Set([
  "support_requests",
  "service_access",
  "global_catalog",
  "internal_audit",
  "product_analytics",
]);

async function run(): Promise<void> {
  if (!email || !normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error("Укажите корректный email внутреннего сотрудника");
  }
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60_000);

  if (action === "create") {
    const permissions = permissionInput
      ? permissionInput
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    if (permissions.some((permission) => !allowedPermissions.has(permission))) {
      throw new Error(`Разрешения должны быть из списка: ${[...allowedPermissions].join(", ")}`);
    }
    await prisma.$transaction(async (tx) => {
      const created = await tx.internalUser.create({
        data: {
          email,
          emailNormalized: normalizedEmail,
          permissions,
          setupTokenHash: tokenHash,
          setupTokenExpiresAt: expiresAt,
        },
      });
      await tx.internalAuditEvent.create({
        data: { eventType: "account.created", actorType: "OPERATOR", internalUserId: created.id },
      });
    });
    console.log(`Одноразовый setup-token (действует до ${expiresAt.toISOString()}): ${token}`);
    return;
  }

  if (action === "reset") {
    const user = await prisma.internalUser.findUnique({
      where: { emailNormalized: normalizedEmail },
    });
    if (!user) throw new Error("Внутренний аккаунт не найден");
    if (user.status === "DISABLED") {
      throw new Error("Отключённый аккаунт нельзя сбросить; сброс MFA не включает аккаунт");
    }
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "internal_sessions" WHERE "internalUserId" = ${user.id}::uuid ORDER BY "id" FOR UPDATE`;
      await tx.internalSession.updateMany({
        where: { internalUserId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await endServiceSessions(tx, user.id, "mfa_operator_reset");
      await tx.internalRecoveryCode.deleteMany({ where: { internalUserId: user.id } });
      await tx.internalAuthChallenge.updateMany({
        where: { internalUserId: user.id, consumedAt: null },
        data: { consumedAt: now },
      });
      const reset = await tx.internalUser.updateMany({
        where: { id: user.id, status: { not: "DISABLED" } },
        data: {
          status: "PENDING_ENROLLMENT",
          passwordHash: null,
          totpSecretCiphertext: null,
          totpSecretIv: null,
          totpSecretAuthTag: null,
          lastAcceptedTotpStep: -1n,
          totpFailureCount: 0,
          totpAuthenticatorDisabledAt: null,
          setupTokenHash: tokenHash,
          setupTokenExpiresAt: expiresAt,
        },
      });
      if (reset.count !== 1) {
        throw new Error("Отключённый аккаунт нельзя сбросить; сброс MFA не включает аккаунт");
      }
      await tx.internalAuditEvent.create({
        data: {
          eventType: "mfa.operator_reset",
          actorType: "OPERATOR",
          internalUserId: user.id,
        },
      });
    });
    console.log(`Одноразовый setup-token (действует до ${expiresAt.toISOString()}): ${token}`);
    return;
  }

  if (action === "disable") {
    const user = await prisma.internalUser.findUnique({
      where: { emailNormalized: normalizedEmail },
    });
    if (!user) throw new Error("Внутренний аккаунт не найден");
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "internal_sessions" WHERE "internalUserId" = ${user.id}::uuid ORDER BY "id" FOR UPDATE`;
      await tx.internalSession.updateMany({
        where: { internalUserId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await endServiceSessions(tx, user.id, "internal_user_disabled");
      await tx.internalAuthChallenge.updateMany({
        where: { internalUserId: user.id, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.internalUser.update({
        where: { id: user.id },
        data: { status: "DISABLED", setupTokenHash: null, setupTokenExpiresAt: null },
      });
      await tx.internalAuditEvent.create({
        data: { eventType: "account.disabled", actorType: "OPERATOR", internalUserId: user.id },
      });
    });
    console.log(`Внутренний аккаунт ${email} отключён`);
    return;
  }

  throw new Error(
    "Использование: internal-user create <email> [permissions через запятую] | reset <email> | disable <email>",
  );
}

async function endServiceSessions(
  tx: Prisma.TransactionClient,
  internalUserId: string,
  reason: string,
) {
  const candidateSessions = await tx.serviceSession.findMany({
    where: { internalUserId, endedAt: null },
    select: { grantId: true },
  });
  const grantIds = [...new Set(candidateSessions.map(({ grantId }) => grantId))].sort();
  for (const grantId of grantIds) {
    await tx.$queryRaw`SELECT "id" FROM "support_access_grants" WHERE "id" = ${grantId}::uuid FOR UPDATE`;
  }
  const sessions = await tx.serviceSession.findMany({
    where: { internalUserId, endedAt: null },
    orderBy: { id: "asc" },
    include: { grant: { select: { id: true, companyId: true, venueId: true } } },
  });
  const endedAt = new Date();
  for (const session of sessions) {
    const endReason = session.expiresAt <= endedAt ? "expired" : reason;
    const ended = await tx.serviceSession.updateMany({
      where: { id: session.id, endedAt: null },
      data: { endedAt, endReason },
    });
    if (ended.count !== 1) continue;
    await tx.auditEvent.create({
      data: {
        eventType: "service_access.ended",
        actorType: "SYSTEM",
        serviceSessionId: session.id,
        companyId: session.grant.companyId,
        venueId: session.grant.venueId,
        entityType: "SUPPORT_ACCESS_GRANT",
        entityId: session.grant.id,
        metadata: { reason: endReason },
      },
    });
    await tx.internalAuditEvent.create({
      data: {
        eventType: "service_access.ended",
        actorType: "SYSTEM",
        internalUserId,
        companyId: session.grant.companyId,
        venueId: session.grant.venueId,
        serviceSessionId: session.id,
        metadata: {
          grantId: session.grant.id,
          serviceSessionId: session.id,
          actorId: internalUserId,
          reason: endReason,
        },
      },
    });
  }
}

run()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Не удалось выполнить операторскую операцию",
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
