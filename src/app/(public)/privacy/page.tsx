import Link from "next/link";
import { DocPage } from "@/components/doc-page";

export const metadata = { title: "Privacy · Emulix" };

export default function PrivacyPage() {
  return (
    <DocPage
      title="Privacy notice"
      intro="What Emulix collects, why, and how long it is kept."
      notice="Draft for the preview. It describes how the preview works today, has not had a legal review, and will be replaced before launch."
      sections={[
        {
          title: "What we collect",
          body: (
            <ul>
              <li>
                <strong>Account details:</strong> your name and email, and your password stored only as a salted hash.
              </li>
              <li>
                <strong>Sign-in sessions:</strong> a session cookie, stored as a hash on our side. It expires after 14 days without use.
              </li>
              <li>
                <strong>What you test:</strong> the addresses you enter and the device you choose, so we can run the test and apply limits.
              </li>
              <li>
                <strong>Usage counts:</strong> how many tests and audits you run, to enforce rate limits and plan limits.
              </li>
            </ul>
          ),
        },
        {
          title: "How pages you test are handled",
          body: (
            <p>
              A browser on our server loads the page you enter and streams its picture to you. Audit results are kept in server memory for your
              results screen and are cleared when the server restarts. We do not sell what you test, and we share it only when you choose an AI
              feature, as described next.
            </p>
          ),
        },
        {
          title: "AI features",
          body: (
            <>
              <p>
                Some tools can draft a bug report or explain a console message or network request. They run only when you click them. Then we send
                the evidence for that one request to our AI provider (Anthropic) so it can write the answer: the errors and requests from your
                test, the device name, and, for a bug draft, the screenshot.
              </p>
              <p>
                Before sending, we shorten addresses (the query string and any credentials are removed) and mask passwords, tokens and email
                addresses in text. We cannot mask what appears inside a screenshot, so do not draft a bug while a page shows private details.
                We do not store the evidence or the answer on our side beyond a short-lived cache in server memory, and the answer is only
                shown to you. AI answers can be wrong, so check them against the evidence.
              </p>
            </>
          ),
        },
        {
          title: "Payments",
          body: (
            <p>
              Checkout is simulated in the preview. Card checks run in your browser and card details are never sent to our servers.
            </p>
          ),
        },
        {
          title: "Email",
          body: <p>We send an email to verify your address and to reset a forgotten password. We do not send marketing email.</p>,
        },
        {
          title: "Cookies",
          body: <p>We use one cookie, to keep you signed in. We do not use advertising or tracking cookies.</p>,
        },
        {
          title: "Your choices and contact",
          body: (
            <p>
              You can stop using the service at any time. Contact and data-request details will be added here before launch. Read the{" "}
              <Link href="/terms" className="font-medium text-accent">terms of use</Link> too.
            </p>
          ),
        },
      ]}
    />
  );
}
