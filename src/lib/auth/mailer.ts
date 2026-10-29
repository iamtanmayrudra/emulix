export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
};

export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}

/**
 * Development mailer: keeps messages in memory and logs them to the server console.
 * Links in these logs are live credentials for development accounts only.
 * Production must configure a real provider (not yet chosen); until then sending fails loudly
 * instead of silently dropping verification and reset emails.
 */
export class DevelopmentMailer implements Mailer {
  readonly outbox: OutgoingEmail[] = [];

  constructor(private readonly options: { log: boolean } = { log: true }) {}

  async send(email: OutgoingEmail) {
    this.outbox.push(email);
    if (this.options.log) {
      console.info(`[dev mail] to=${email.to} subject="${email.subject}"\n${email.text}`);
    }
  }
}

export class UnconfiguredMailer implements Mailer {
  async send(): Promise<void> {
    throw new Error("No mail provider is configured for this environment.");
  }
}

const globalForMailer = globalThis as typeof globalThis & { __emulixMailer?: Mailer };

export function getMailer(): Mailer {
  if (!globalForMailer.__emulixMailer) {
    globalForMailer.__emulixMailer =
      process.env.NODE_ENV === "production" ? new UnconfiguredMailer() : new DevelopmentMailer();
  }
  return globalForMailer.__emulixMailer;
}
