import { Text } from "@react-email/components";
import { ActionButton, EmailLayout, emailStyles } from "./layout";

export const PASSWORD_RESET_SUBJECT = "Reset your Emulix Optimizer password";

export type PasswordResetEmailProps = { name: string; url: string; expiresIn: string };

export function PasswordResetEmail({ name, url, expiresIn }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Use this link to choose a new password.">
      <Text style={emailStyles.text}>{`Hello ${name},`}</Text>
      <Text style={emailStyles.text}>We received a request to reset your password.</Text>
      <ActionButton href={url} label="Reset Password" />
      <Text style={emailStyles.small}>{`This link expires in ${expiresIn} and works once.`}</Text>
      <Text style={emailStyles.small}>If you did not request a password reset, no action is required.</Text>
    </EmailLayout>
  );
}
