import { Resend } from "resend";
import { EmailDeliveryError, type Mailer, type OutgoingEmail, type SendResult } from "./types";

/**
 * Resend setup. This file is server-only: the API key comes from RESEND_API_KEY, which must never be given a
 * NEXT_PUBLIC_ name, and the browser never calls Resend. Only routes and services under src/lib import it.
 */

/** The one call we make on the SDK, so tests can stand in for it. */
export type ResendClient = {
  emails: {
    send(payload: { from: string; to: string; subject: string; text: string; html?: string }): Promise<{
      data: { id: string } | null;
      error: { name: string; message: string } | null;
    }>;
  };
};

export type EmailConfig = { apiKey: string; from: string };

/**
 * Reads RESEND_API_KEY and EMAIL_FROM. Returns null unless both are set, so a half-configured environment never
 * pretends to send. A key without a sender is reported, because that is the usual mistake.
 */
export function readEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (apiKey && from) return { apiKey, from };
  if (apiKey && !from) {
    console.warn("[email] RESEND_API_KEY is set but EMAIL_FROM is not, so no email will be sent through Resend.");
  }
  return null;
}

export function createResendClient(apiKey: string): ResendClient {
  const resend = new Resend(apiKey);
  return {
    emails: {
      async send(payload) {
        const { data, error } = await resend.emails.send(payload);
        return {
          data: data ? { id: data.id } : null,
          error: error ? { name: error.name, message: error.message } : null,
        };
      },
    },
  };
}

/** Sends through Resend. Any refusal or network failure becomes an EmailDeliveryError, so callers handle one thing. */
export class ResendMailer implements Mailer {
  constructor(
    private readonly client: ResendClient,
    private readonly from: string,
  ) {}

  async send(email: OutgoingEmail): Promise<SendResult> {
    let result: Awaited<ReturnType<ResendClient["emails"]["send"]>>;
    try {
      result = await this.client.emails.send({
        from: this.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (cause) {
      throw new EmailDeliveryError(`Resend could not be reached: ${cause instanceof Error ? cause.message : "unknown error"}`);
    }
    if (result.error || !result.data) {
      throw new EmailDeliveryError(`Resend refused the email: ${result.error?.name ?? "no id returned"}: ${result.error?.message ?? ""}`.trim());
    }
    return { id: result.data.id };
  }
}
