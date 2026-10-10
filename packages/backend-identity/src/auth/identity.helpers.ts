import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import type { VenueInviteRole } from "@bartech/backend-organizations";

export type TokenSession = { token: string; expiresAt: Date };

export const CODE_TTL_MS = 10 * 60 * 1000;
export const REGISTRATION_TTL_MS = 30 * 60 * 1000;
export const EMAIL_RESEND_DELAY_SECONDS = 60;
export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const SESSION_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
export const LOGIN_BLOCKED_MESSAGE =
  "Слишком много попыток входа. Восстановите пароль или попробуйте снова через 15 минут";
export const INVALID_LOGIN_MESSAGE = "Неверный email или пароль";
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "qwerty123",
  "password",
  "password1",
  "пароль123",
  "qwerty12345",
  "11111111",
  "00000000",
  "admin123",
  "iloveyou",
  "welcome1",
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function roleLabel(role: VenueInviteRole): string {
  return {
    BARTENDER: "Бармен",
    SENIOR_BARTENDER: "Старший бармен",
    BAR_MANAGER: "Бар-менеджер",
  }[role];
}

function invitationRoleLabel(role: VenueInviteRole | null, purpose: string): string {
  return purpose === "JOIN_COMPANY_AS_CHEF" ? "Шеф-бармен" : roleLabel(role!);
}

export function publicInvitation(invitation: {
  purpose: string;
  company: { name: string };
  venue: { name: string } | null;
  role: VenueInviteRole | null;
  email: string;
  expiresAt: Date;
}) {
  return {
    purpose: invitation.purpose,
    companyName: invitation.company.name,
    venueName: invitation.venue?.name ?? null,
    role: invitation.role,
    roleLabel: invitationRoleLabel(invitation.role, invitation.purpose),
    accessDescription:
      invitation.purpose === "JOIN_COMPANY_AS_CHEF"
        ? "Вы получите доступ ко всем заведениям этой компании."
        : null,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
  };
}

export function redisKey(prefix: string, email: string): string {
  const digest = createHash("sha256").update(email).digest("hex");
  return `bartech:identity:${prefix}:${digest}`;
}

export function normalizePassword(password: string, email?: string, name?: string): string {
  if (password.length < 8 || password.length > 256) {
    throw new BadRequestException("Пароль должен содержать от 8 до 256 символов");
  }
  const value = password.trim().toLowerCase();
  if (
    COMMON_PASSWORDS.has(value) ||
    /^(.)\1{7,}$/u.test(value) ||
    /^(?:1234|2345|3456|4567|5678|6789|qwerty|йцукен|password|пароль)/u.test(value) ||
    (email && value.includes(email.split("@")[0].toLowerCase())) ||
    (name && value.includes(name.replace(/\s+/gu, "").toLowerCase()))
  ) {
    throw new BadRequestException("Выберите пароль, который сложнее угадать");
  }
  return password;
}
