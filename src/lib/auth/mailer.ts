import { ResendMailer, createResendClient, readEmailConfig } from "../email/resend";
import type { Mailer, OutgoingEmail, SendResult } from "../email/types";

export { EmailDeliveryError } from "../email/types";
export type { Mailer, OutgoingEmail, SendResult } from "../email/types";

/**
 * Development mailer: keeps messages in memory and logs them to the server console.
 * Links in these logs are live credentials for development accounts only.
 * Used when no Resend key is configured outside production.
 */
export class DevelopmentMailer implements Mailer {
  readonly outbox: OutgoingEmail[] = [];

  constructor(private readonly options: { log: boolean } = { log: true }) {}

  async send(email: OutgoingEmail): Promise<SendResult> {
    this.outbox.push(email);
    if (this.options.log) {
      console.info(`[dev mail] to=${email.to} subject="${email.subject}"\n${email.text}`);
    }
    return { id: `dev-${this.outbox.length}` };
  }
}

/** Production without a provider. Sending fails loudly instead of silently dropping verification and reset emails. */
export class UnconfiguredMailer implements Mailer {
  async send(): Promise<never> {
    throw new Error("No mail provider is configured for this environment. Set RESEND_API_KEY and EMAIL_FROM.");
  }
}

const globalForMailer = globalThis as typeof globalThis & { __emulixMailer?: Mailer };

/**
 * Resend when RESEND_API_KEY and EMAIL_FROM are both set, in any environment, so the real path can be tried locally.
 * Without them: the console mailer in development, and a mailer that refuses to send in production.
 */
export function getMailer(): Mailer {
  if (!globalForMailer.__emulixMailer) {
    const config = readEmailConfig();
    globalForMailer.__emulixMailer = config
      ? new ResendMailer(createResendClient(config.apiKey), config.from)
      : process.env.NODE_ENV === "production"
        ? new UnconfiguredMailer()
        : new DevelopmentMailer();
  }
  return globalForMailer.__emulixMailer;
}
