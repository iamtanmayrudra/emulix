import { Text } from "@react-email/components";
import { ActionButton, EmailLayout, emailStyles } from "./layout";

export const SECURITY_ALERT_SUBJECT = "Security alert for your Emulix Optimizer account";

export type SecurityAlertEmailProps = {
  name: string;
  /** One sentence saying what happened, for example "Your password was changed." */
  event: string;
  /** When it happened, already formatted. */
  when: string;
  /** Where to send someone who does not recognize the activity. */
  resetUrl: string;
};

export function SecurityAlertEmail({ name, event, when, resetUrl }: SecurityAlertEmailProps) {
  return (
    <EmailLayout preview="A security-related event occurred on your account.">
      <Text style={emailStyles.text}>{`Hello ${name},`}</Text>
      <Text style={emailStyles.text}>A security-related event occurred on your account:</Text>
      <Text style={{ ...emailStyles.text, fontWeight: 600 }}>
        {`${event} (${when})`}
      </Text>
      <Text style={emailStyles.text}>If you recognize this activity, no action is required.</Text>
      <Text style={emailStyles.text}>If you do not recognize it, please secure your account immediately.</Text>
      <ActionButton href={resetUrl} label="Secure my account" />
    </EmailLayout>
  );
}
