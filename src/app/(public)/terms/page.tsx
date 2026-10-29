import Link from "next/link";
import { DocPage } from "@/components/doc-page";

export const metadata = { title: "Terms · Emulix" };

export default function TermsPage() {
  return (
    <DocPage
      title="Terms of use"
      intro="The rules for using Emulix, in plain language."
      notice="Draft for the preview. These terms have not had a legal review and will be replaced before launch."
      sections={[
        {
          title: "Using the service",
          body: (
            <p>
              You may use Emulix to test and audit websites and apps that you own or have permission to test. You are responsible for what you
              enter, and for any account you create.
            </p>
          ),
        },
        {
          title: "What you must not do",
          body: (
            <ul>
              <li>Test or scan sites without the owner&rsquo;s permission.</li>
              <li>Try to reach private networks or internal addresses through the service.</li>
              <li>Overload the service, or work around its limits, rate limits or plan checks.</li>
              <li>Use the service to break the law or to harm others.</li>
            </ul>
          ),
        },
        {
          title: "Your account",
          body: <p>Keep your password private. Tell us if you think someone else has used your account. We may suspend accounts that break these terms.</p>,
        },
        {
          title: "Plans and changes",
          body: (
            <p>
              Plans, limits and features are described on the <Link href="/pricing" className="font-medium text-accent">pricing page</Link> and may
              change. While the product is in preview, billing is simulated and no payment is taken.
            </p>
          ),
        },
        {
          title: "No warranty",
          body: <p>The service is provided as it is during the preview. Results come from automated tools and can differ from what real visitors see, so check important changes yourself.</p>,
        },
        {
          title: "Privacy",
          body: (
            <p>
              How we handle your data is described in the <Link href="/privacy" className="font-medium text-accent">privacy notice</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
