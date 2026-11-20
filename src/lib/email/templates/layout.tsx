import { Body, Button, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

const BRAND = "#5b5bf0";

const styles = {
  body: { margin: 0, backgroundColor: "#f4f5fb", fontFamily: "Segoe UI, Helvetica, Arial, sans-serif", color: "#1a1b2e" },
  container: { maxWidth: "520px", margin: "32px auto", backgroundColor: "#ffffff", borderRadius: "14px", padding: "32px", border: "1px solid #e4e6f2" },
  brand: { margin: "0 0 24px", fontSize: "18px", fontWeight: 700, color: BRAND },
  text: { margin: "0 0 16px", fontSize: "15px", lineHeight: "24px" },
  button: { backgroundColor: BRAND, color: "#ffffff", borderRadius: "10px", padding: "12px 22px", fontSize: "15px", fontWeight: 600, textDecoration: "none", display: "inline-block" },
  small: { margin: "0 0 12px", fontSize: "13px", lineHeight: "20px", color: "#5d6078" },
  link: { color: BRAND, wordBreak: "break-all" },
  hr: { borderColor: "#e4e6f2", margin: "24px 0 16px" },
} satisfies Record<string, CSSProperties>;

export const emailStyles = styles;

/** Shared frame: brand line, body, and the sign-off from the plan. */
export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>Emulix Optimizer</Text>
          {children}
          <Hr style={styles.hr} />
          <Text style={styles.small}>Regards,</Text>
          <Text style={{ ...styles.small, margin: 0 }}>Emulix Optimizer Team</Text>
        </Container>
      </Body>
    </Html>
  );
}

/** A button plus the raw link below it, for clients that block buttons and so the plain-text version carries the URL. */
export function ActionButton({ href, label }: { href: string; label: string }) {
  return (
    <>
      <Section style={{ margin: "8px 0 20px" }}>
        <Button href={href} style={styles.button}>
          {label}
        </Button>
      </Section>
      <Text style={styles.small}>
        Or paste this link into your browser:{" "}
        <Link href={href} style={styles.link}>
          {href}
        </Link>
      </Text>
    </>
  );
}
