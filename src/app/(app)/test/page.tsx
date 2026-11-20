import WebsiteTestPage from "./website-test-page";

// The page itself is a client component, so the setting that applies to the page lives in this server file.
// Signed-in only: the layout reads the session and may redirect, so this page cannot be validated as instant. See the layout.
export const instant = false;

export default function TestRoute() {
  return <WebsiteTestPage />;
}
