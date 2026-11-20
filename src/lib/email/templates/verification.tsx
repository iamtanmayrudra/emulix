import { Text } from "@react-email/components";
import { ActionButton, EmailLayout, emailStyles } from "./layout";

export const VERIFICATION_SUBJECT = "Verify your Emulix Optimizer account";

export type VerificationEmailProps = { name: string; url: string; expiresIn: string };

export function VerificationEmail({ name, url, expiresIn }: VerificationEmailProps) {
  return (
    <EmailLayout preview="Verify your email address to activate your account.">
      <Text style={emailStyles.text}>{`Hello ${name},`}</Text>
      <Text style={emailStyles.text}>Thanks for creating your Emulix Optimizer account.</Text>
      <Text style={emailStyles.text}>Please verify your email address to activate your account.</Text>
      <ActionButton href={url} label="Verify Email" />
      <Text style={emailStyles.small}>{`This link expires in ${expiresIn} and works once.`}</Text>
      <Text style={emailStyles.small}>If you did not create this account, you can safely ignore this email.</Text>
    </EmailLayout>
  );
}
