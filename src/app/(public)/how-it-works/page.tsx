import Link from "next/link";
import { DocPage } from "@/components/doc-page";

export const metadata = { title: "How it works · Emulix" };

export default function HowItWorksPage() {
  return (
    <DocPage
      title="How Emulix works"
      intro="Open your site on real browsers and devices, and audit it for speed, accessibility and SEO."
      sections={[
        {
          title: "Test your site on a device",
          body: (
            <>
              <p>
                Pick a device (an iPhone, iPad, Android phone or tablet, a laptop, or a Mac with Safari 15 to 26), enter a public address and start a
                test. A real browser opens your page inside the device frame, and you can click, scroll, type and use back, forward and reload.
              </p>
              <p>
                Most devices run Chromium. Mac Safari versions run the matching WebKit build, so you can check how older Safari versions render your page.
              </p>
            </>
          ),
        },
        {
          title: "Audit a page",
          body: (
            <>
              <p>
                The <Link href="/optimize" className="font-medium text-accent">Optimization studio</Link> runs Lighthouse on any public page. You get scores for
                performance, accessibility, best practices and SEO, the Core Web Vitals, and a ranked list of findings. Each finding says where it was found,
                how to fix it, with a code example and a link to the full guide. No account is needed.
              </p>
            </>
          ),
        },
        {
          title: "What we will and will not open",
          body: (
            <ul>
              <li>Only public http and https addresses on the standard web ports.</li>
              <li>Local and private addresses are refused, including when a page redirects to one.</li>
              <li>Downloads and service workers are blocked in test browsers.</li>
            </ul>
          ),
        },
        {
          title: "Limits",
          body: (
            <ul>
              <li>A live browser closes after 3 minutes without input, and after 15 minutes in total.</li>
              <li>Free accounts run 1 live browser at a time. Pro runs up to 5.</li>
              <li>Audits: 5 an hour without an account and 20 an hour when signed in, one at a time per person.</li>
            </ul>
          ),
        },
        {
          title: "Plans",
          body: (
            <p>
              Free covers a few devices and the audits above. Pro unlocks the full device library, higher limits and more. See{" "}
              <Link href="/pricing" className="font-medium text-accent">plans and pricing</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
