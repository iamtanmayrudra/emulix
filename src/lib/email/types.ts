/** The kinds of email the app sends for accounts (docs/EMAIL_SERVICE.md). Stored on each EmailLog row. */
export type EmailType = "VERIFICATION" | "PASSWORD_RESET" | "WELCOME" | "SECURITY_ALERT";

/** QUEUED when the attempt starts, SENT once the provider accepted it, FAILED when it did not. DELIVERED is set from provider webhooks, which are not built yet. */
export type EmailStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED";

/**
 * One row per send attempt. It holds who, what kind, and the provider's message id, so "I never got the email" can be
 * traced. It never holds the message body, because the body contains single-use links.
 */
export type EmailLogRecord = {
  id: string;
  userId: string | null;
  type: EmailType;
  recipient: string;
  providerMessageId: string | null;
  status: EmailStatus;
  error: string | null;
  sentAt: Date | null;
  createdAt: Date;
};

export type OutgoingEmail = {
  to: string;
  subject: string;
  /** Plain-text version. Always present, so clients that do not show HTML still get the link. */
  text: string;
  html?: string;
};

/** What a provider returns for an accepted message. */
export type SendResult = { id?: string };

export interface Mailer {
  send(email: OutgoingEmail): Promise<SendResult | void>;
}

/** The provider refused the message or could not be reached. The message is safe to log and never contains secrets. */
export class EmailDeliveryError extends Error {
  constructor(message = "Unable to send email.") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

/**
 * The public base URL for links in emails, no trailing slash. A function is read only when an email is built, so a
 * missing setting can fail that one email without taking sign-in down with it.
 */
export type BaseUrl = string | (() => string);

export function resolveBaseUrl(source: BaseUrl): string {
  return typeof source === "function" ? source() : source;
}
