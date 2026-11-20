import { Text } from "@react-email/components";
import { ActionButton, EmailLayout, emailStyles } from "./layout";

export const WELCOME_SUBJECT = "Welcome to Emulix Optimizer";

export type WelcomeEmailProps = { name: string; dashboardUrl: string };

export function WelcomeEmail({ name, dashboardUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Your account is ready.">
      <Text style={emailStyles.text}>{`Hello ${name},`}</Text>
      <Text style={emailStyles.text}>Welcome to Emulix Optimizer.</Text>
      <Text style={emailStyles.text}>Your account is now ready.</Text>
      <ActionButton href={dashboardUrl} label="Open Dashboard" />
      <Text style={emailStyles.small}>Start testing your websites across devices and reviewing optimization reports.</Text>
    </EmailLayout>
  );
}
