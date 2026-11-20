import { randomUUID } from "node:crypto";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { PasswordResetEmail, PASSWORD_RESET_SUBJECT } from "./templates/password-reset";
import { SecurityAlertEmail, SECURITY_ALERT_SUBJECT } from "./templates/security-alert";
import { VerificationEmail, VERIFICATION_SUBJECT } from "./templates/verification";
import { WelcomeEmail, WELCOME_SUBJECT } from "./templates/welcome";
import { EmailDeliveryError, type EmailLogRecord, type EmailType, type Mailer } from "./types";

/** The part of the store the service writes to. The auth store implements it. */
export interface EmailLogStore {
  insertEmailLog(record: EmailLogRecord): Promise<void>;
  updateEmailLog(id: string, patch: Partial<EmailLogRecord>): Promise<void>;
}

export type EmailServiceDeps = {
  mailer: Mailer;
  log: EmailLogStore;
  /** Public base URL, no trailing slash. Links in emails are built from it. */
  appUrl: string;
  now?: () => Date;
};

type Recipient = { userId: string | null; email: string; name: string };

/** "30 minutes", "1 hour". Used in the "this link expires in" line. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/** Provider errors are kept short in the log. They carry a provider name and reason, never the key or the message body. */
function logMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : "Unknown error";
  return text.length > 300 ? `${text.slice(0, 297)}...` : text;
}

/**
 * Builds each account email, sends it through the mailer, and records the attempt. Auth code calls this and never the
 * provider, so the provider can be replaced without touching the sign-in flows.
 *
 * Every send throws EmailDeliveryError when it fails, after writing a FAILED log row.
 */
export function createEmailService(deps: EmailServiceDeps) {
  const { mailer, log, appUrl } = deps;
  const now = deps.now ?? (() => new Date());

  /** A failing log write must never block or hide the email itself. */
  async function safely(task: () => Promise<void>) {
    try {
      await task();
    } catch (error) {
      console.error("[email] could not write the email log", error);
    }
  }

  async function deliver(type: EmailType, to: Recipient, subject: string, element: ReactElement) {
    const record: EmailLogRecord = {
      id: randomUUID(),
      userId: to.userId,
      type,
      recipient: to.email,
      providerMessageId: null,
      status: "QUEUED",
      error: null,
      sentAt: null,
      createdAt: now(),
    };
    await safely(() => log.insertEmailLog(record));

    try {
      const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
      const result = await mailer.send({ to: to.email, subject, html, text });
      await safely(() => log.updateEmailLog(record.id, { status: "SENT", providerMessageId: result?.id ?? null, sentAt: now() }));
    } catch (error) {
      await safely(() => log.updateEmailLog(record.id, { status: "FAILED", error: logMessage(error) }));
      console.error(`[email] ${type} to ${to.email} failed: ${logMessage(error)}`);
      throw error instanceof EmailDeliveryError ? error : new EmailDeliveryError();
    }
  }

  return {
    sendVerificationEmail(to: Recipient, token: string, ttlMs: number) {
      const url = `${appUrl}/verify-email?token=${token}`;
      return deliver("VERIFICATION", to, VERIFICATION_SUBJECT, VerificationEmail({ name: to.name, url, expiresIn: formatDuration(ttlMs) }));
    },

    sendPasswordResetEmail(to: Recipient, token: string, ttlMs: number) {
      const url = `${appUrl}/reset-password?token=${token}`;
      return deliver("PASSWORD_RESET", to, PASSWORD_RESET_SUBJECT, PasswordResetEmail({ name: to.name, url, expiresIn: formatDuration(ttlMs) }));
    },

    sendWelcomeEmail(to: Recipient) {
      return deliver("WELCOME", to, WELCOME_SUBJECT, WelcomeEmail({ name: to.name, dashboardUrl: `${appUrl}/dashboard` }));
    },

    sendSecurityAlertEmail(to: Recipient, event: string) {
      const when = `${now().toISOString().slice(0, 16).replace("T", " ")} UTC`;
      return deliver("SECURITY_ALERT", to, SECURITY_ALERT_SUBJECT, SecurityAlertEmail({ name: to.name, event, when, resetUrl: `${appUrl}/forgot-password` }));
    },
  };
}

export type EmailService = ReturnType<typeof createEmailService>;
