/**
 * Fixes for the Lighthouse audits people hit most. Lighthouse says what is wrong; this says what to change.
 * Anything not listed here falls back to the guidance for its category, and every finding links to the
 * Lighthouse guide for that audit.
 */

export type Solution = {
  /** One sentence on what the fix achieves. */
  summary: string;
  steps: string[];
  example?: { language: string; code: string };
};

const HTML_MAIN = `<body>
  <header>…</header>
  <main id="content">
    <!-- the page's primary content, once per page -->
  </main>
  <footer>…</footer>
</body>`;

const CATALOG: Record<string, Solution> = {
  // Accessibility
  "landmark-one-main": {
    summary: "Give screen reader users one place to jump straight to the page's content.",
    steps: [
      "Wrap the primary content of every page in a single <main> element.",
      "Keep the header, navigation and footer outside <main>.",
      "Use only one <main> per page.",
    ],
    example: { language: "html", code: HTML_MAIN },
  },
  "color-contrast": {
    summary: "Make text readable for people with low vision and in bright light.",
    steps: [
      "Raise the contrast between text and its background to at least 4.5:1 (3:1 for text 24px or larger, or 19px bold).",
      "Check the exact ratio in Chrome DevTools: select the element and open its colour picker.",
      "Avoid lightening text with opacity. Pick a darker colour instead.",
    ],
    example: { language: "css", code: ".caption {\n  color: #595959; /* 7:1 on white */\n}" },
  },
  "image-alt": {
    summary: "Describe images so people who cannot see them still get the point.",
    steps: [
      "Add an alt attribute to every <img> that says what the image shows or does.",
      "Use an empty alt (alt=\"\") for purely decorative images so they are skipped.",
      "For a linked image, describe where the link goes.",
    ],
    example: { language: "html", code: '<img src="team.jpg" alt="The support team at their desks">\n<img src="divider.svg" alt="">' },
  },
  "button-name": {
    summary: "Make every button announce what it does.",
    steps: ["Give each button visible text, or an aria-label when it only shows an icon."],
    example: { language: "html", code: '<button aria-label="Close dialog">\n  <svg aria-hidden="true">…</svg>\n</button>' },
  },
  "link-name": {
    summary: "Make every link announce where it goes.",
    steps: ["Give each link visible text, or an aria-label for an icon-only link.", "Avoid empty links, such as a link wrapping only a decorative image."],
    example: { language: "html", code: '<a href="/cart" aria-label="Shopping cart, 3 items">\n  <svg aria-hidden="true">…</svg>\n</a>' },
  },
  label: {
    summary: "Tie each form field to a label so it is announced and easier to tap.",
    steps: ["Add a <label> for every input and connect it with for and id, or wrap the input in the label.", "Do not use placeholder text as the only label."],
    example: { language: "html", code: '<label for="email">Email address</label>\n<input id="email" type="email" autocomplete="email">' },
  },
  "html-has-lang": {
    summary: "Tell browsers and screen readers which language the page is in.",
    steps: ["Add a lang attribute to the <html> element, such as lang=\"en\"."],
    example: { language: "html", code: '<html lang="en">' },
  },
  "heading-order": {
    summary: "Keep headings in a logical outline so people can scan the page.",
    steps: ["Start with one <h1>, then use <h2> for sections and <h3> inside them.", "Do not skip levels to get a font size. Style headings with CSS instead."],
  },
  bypass: {
    summary: "Let keyboard users skip repeated navigation.",
    steps: ["Add a \"Skip to content\" link as the first focusable element that jumps to <main>.", "Or use landmark elements (<nav>, <main>) so assistive technology can jump between them."],
    example: { language: "html", code: '<a class="skip-link" href="#content">Skip to content</a>' },
  },
  tabindex: {
    summary: "Keep keyboard focus in the order people expect.",
    steps: ["Remove tabindex values above 0.", "Use tabindex=\"0\" only to make a custom control focusable, and fix the page's DOM order instead of forcing a focus order."],
  },
  "target-size": {
    summary: "Make touch targets big enough to tap without mistakes.",
    steps: ["Make buttons and links at least 24 by 24 CSS pixels, ideally 44 by 44.", "Leave space between neighbouring targets."],
    example: { language: "css", code: "a.button {\n  display: inline-block;\n  min-width: 44px;\n  min-height: 44px;\n}" },
  },
  "frame-title": {
    summary: "Name each embedded frame.",
    steps: ["Add a short title attribute to every <iframe> that says what it contains."],
    example: { language: "html", code: '<iframe src="https://www.youtube.com/embed/…" title="Product demo video"></iframe>' },
  },

  // SEO
  "meta-description": {
    summary: "Control the snippet search engines show under your title.",
    steps: ["Add a unique <meta name=\"description\"> to the <head> of every page.", "Write 120 to 160 characters that say what the page offers."],
    example: { language: "html", code: '<meta name="description" content="Test your website on real iPhones, Androids and Macs, and fix what is slow or broken.">' },
  },
  "document-title": {
    summary: "Give every page a clear, unique title.",
    steps: ["Add a <title> to the <head> of each page.", "Keep it under about 60 characters, with the page's topic first and your brand last."],
    example: { language: "html", code: "<title>Optimization studio · Emulix</title>" },
  },
  "link-text": {
    summary: "Use link text that makes sense on its own, for people and for search engines.",
    steps: ["Replace \"click here\", \"read more\" and \"learn more\" with text that describes the destination.", "Check the links listed below first."],
    example: { language: "html", code: '<!-- Before -->\n<a href="/pricing">Click here</a>\n<!-- After -->\n<a href="/pricing">See pricing plans</a>' },
  },
  "is-crawlable": {
    summary: "Let search engines index this page.",
    steps: [
      "Remove any <meta name=\"robots\" content=\"noindex\"> from pages you want in search results.",
      "Check that the server is not sending an X-Robots-Tag: noindex header.",
      "Make sure robots.txt does not block the page.",
    ],
  },
  "robots-txt": {
    summary: "Serve a valid robots.txt so crawlers read your rules correctly.",
    steps: ["Make https://your-site/robots.txt return 200 with plain text, or remove the file.", "Fix any lines the audit reports as invalid."],
    example: { language: "text", code: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml" },
  },
  canonical: {
    summary: "Point search engines at the one preferred URL for the page.",
    steps: ["Add a single <link rel=\"canonical\"> with an absolute URL to the <head>.", "Point it at the page itself unless a different URL is the original."],
    example: { language: "html", code: '<link rel="canonical" href="https://example.com/pricing">' },
  },
  "crawlable-anchors": {
    summary: "Make links that search engines can follow.",
    steps: ["Use real <a href=\"…\"> elements for navigation.", "Avoid links that only run JavaScript on click, or have href=\"#\" or javascript:."],
  },
  "http-status-code": {
    summary: "Return a success code for pages you want indexed.",
    steps: ["Make the page respond with status 200.", "Fix server errors and redirect or remove pages that return 404 or 5xx."],
  },
  "meta-viewport": {
    summary: "Make the page scale correctly on phones.",
    steps: ["Add a viewport meta tag to the <head>.", "Do not set user-scalable=no or a tiny maximum-scale, which blocks zooming."],
    example: { language: "html", code: '<meta name="viewport" content="width=device-width, initial-scale=1">' },
  },
  viewport: {
    summary: "Make the page scale correctly on phones.",
    steps: ["Add a viewport meta tag to the <head>.", "Do not block zooming with user-scalable=no."],
    example: { language: "html", code: '<meta name="viewport" content="width=device-width, initial-scale=1">' },
  },

  // Best practices
  "is-on-https": {
    summary: "Protect visitors and unlock modern browser features.",
    steps: [
      "Serve every page and resource over HTTPS.",
      "Redirect all HTTP requests to HTTPS.",
      "Fix mixed content: change any http:// links to scripts, images or styles into https://.",
      "Add the Strict-Transport-Security header once everything works.",
    ],
    example: { language: "text", code: "Strict-Transport-Security: max-age=31536000; includeSubDomains" },
  },
  "errors-in-console": {
    summary: "Remove errors that can break features for visitors.",
    steps: [
      "Open the page, then Chrome DevTools > Console, and read each red error.",
      "Fix failing requests (404 or blocked files), uncaught exceptions and missing resources.",
      "Reload and repeat until the console is clean.",
    ],
  },
  deprecations: {
    summary: "Replace browser features that are being removed.",
    steps: ["Read each deprecation message the audit lists.", "Switch to the replacement named in the message or the linked guide."],
  },
  "csp-xss": {
    summary: "Limit what scripts can run on your pages to blunt cross-site scripting.",
    steps: ["Send a Content-Security-Policy header that lists the sources you trust.", "Start in report-only mode, fix what it flags, then enforce."],
    example: { language: "text", code: "Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'" },
  },
  charset: {
    summary: "Stop text from being misread as the wrong encoding.",
    steps: ["Declare UTF-8 in the first 1024 bytes of the document, before any text.", "Or send a Content-Type header with charset=utf-8."],
    example: { language: "html", code: '<head>\n  <meta charset="utf-8">\n  …\n</head>' },
  },
  doctype: {
    summary: "Keep browsers out of quirks mode.",
    steps: ["Start every HTML document with <!doctype html>, before anything else."],
    example: { language: "html", code: "<!doctype html>\n<html lang=\"en\">" },
  },
  "image-aspect-ratio": {
    summary: "Stop images from looking stretched.",
    steps: ["Display images at their natural aspect ratio.", "Use object-fit: cover or contain when a box has a different shape."],
    example: { language: "css", code: "img.thumb {\n  width: 100%;\n  aspect-ratio: 4 / 3;\n  object-fit: cover;\n}" },
  },
  "image-size-responsive": {
    summary: "Serve images sharp enough for high-density screens without wasting bytes.",
    steps: ["Export images at about 2x their displayed size.", "Use srcset so each device downloads the size it needs."],
  },
  "geolocation-on-start": {
    summary: "Ask for location only when someone asks for it.",
    steps: ["Request the user's location in response to a click, such as \"Find stores near me\", not on page load."],
  },
  "notification-on-start": {
    summary: "Ask for notification permission only when it is useful.",
    steps: ["Show a button that explains the benefit, and request permission on its click rather than on page load."],
  },
  "no-vulnerable-libraries": {
    summary: "Remove known security holes in the libraries you ship.",
    steps: ["Update each library listed to its latest patched version.", "Run npm audit (or your package manager's equivalent) and fix what it reports."],
    example: { language: "bash", code: "npm audit\nnpm update jquery" },
  },

  // Performance
  "largest-contentful-paint": {
    summary: "Show the biggest thing on the screen sooner.",
    steps: [
      "Find the LCP element in the audit details, usually a hero image or heading.",
      "Preload it and mark it high priority. Never lazy-load it.",
      "Serve it in a modern format (AVIF or WebP) at the size it is shown.",
      "Cut render-blocking CSS and JavaScript ahead of it, and lower your server response time.",
    ],
    example: { language: "html", code: '<link rel="preload" as="image" href="/hero.avif" fetchpriority="high">\n<img src="/hero.avif" width="1200" height="600" fetchpriority="high" alt="…">' },
  },
  "cumulative-layout-shift": {
    summary: "Stop content from jumping around as the page loads.",
    steps: [
      "Set width and height (or aspect-ratio) on every image, video and iframe.",
      "Reserve space for ads, banners and embeds before they load.",
      "Do not insert new content above what is already visible.",
      "Use font-display: swap with a similar fallback font to avoid text reflow.",
    ],
    example: { language: "css", code: "img, video {\n  max-width: 100%;\n  height: auto;\n}\n.hero {\n  aspect-ratio: 16 / 9;\n}" },
  },
  "total-blocking-time": {
    summary: "Keep the page responsive while it loads.",
    steps: [
      "Break up JavaScript tasks longer than 50 ms so the browser can respond in between.",
      "Split your bundle and load code only when a route or feature needs it.",
      "Defer third-party scripts and remove the ones you do not need.",
    ],
    example: { language: "js", code: "// Yield to the browser between chunks of work\nfor (const chunk of chunks) {\n  process(chunk);\n  await new Promise((resolve) => setTimeout(resolve));\n}" },
  },
  "render-blocking-resources": {
    summary: "Let the page paint before every stylesheet and script has finished.",
    steps: [
      "Add defer (or async) to scripts that do not need to run before first paint.",
      "Inline the small amount of CSS needed for the first screen, and load the rest without blocking.",
      "Remove CSS and JavaScript the page does not use.",
    ],
    example: { language: "html", code: '<script src="/app.js" defer></script>\n<link rel="stylesheet" href="/rest.css" media="print" onload="this.media=\'all\'">' },
  },
  "unused-javascript": {
    summary: "Ship less JavaScript so the page loads and responds sooner.",
    steps: ["Code-split by route and load heavy features on demand.", "Remove libraries you barely use, and enable tree-shaking in your build."],
    example: { language: "js", code: "button.addEventListener('click', async () => {\n  const { openEditor } = await import('./editor.js');\n  openEditor();\n});" },
  },
  "unused-css-rules": {
    summary: "Send only the CSS a page needs.",
    steps: ["Remove styles for components that are not on the page.", "Split CSS per route, or use a tool that drops unused rules at build time."],
  },
  "unminified-javascript": {
    summary: "Shrink scripts by removing whitespace and long names.",
    steps: ["Build for production so your bundler minifies the output.", "Check that unminified third-party files are not copied in as-is."],
  },
  "unminified-css": {
    summary: "Shrink stylesheets by removing whitespace and comments.",
    steps: ["Minify CSS in your production build, with a tool such as Lightning CSS or cssnano."],
  },
  "uses-text-compression": {
    summary: "Send text files compressed so they download faster.",
    steps: ["Enable Brotli or gzip on your server or CDN for HTML, CSS, JavaScript, JSON and SVG."],
    example: { language: "nginx", code: "gzip on;\ngzip_types text/css application/javascript application/json image/svg+xml;" },
  },
  "uses-long-cache-ttl": {
    summary: "Let returning visitors reuse files instead of downloading them again.",
    steps: [
      "Give versioned files (with a hash in the name) a long cache lifetime.",
      "Keep HTML on a short lifetime or revalidate it, so updates reach people quickly.",
    ],
    example: { language: "text", code: "Cache-Control: public, max-age=31536000, immutable" },
  },
  "modern-image-formats": {
    summary: "Cut image weight with newer formats.",
    steps: ["Convert photos to AVIF or WebP.", "Keep a JPEG or PNG fallback with the <picture> element if you need older browsers."],
    example: { language: "html", code: '<picture>\n  <source srcset="photo.avif" type="image/avif">\n  <source srcset="photo.webp" type="image/webp">\n  <img src="photo.jpg" width="800" height="600" alt="…">\n</picture>' },
  },
  "uses-optimized-images": {
    summary: "Compress images so they download faster.",
    steps: ["Re-export images at quality 75 to 85, or run them through an optimizer such as Squoosh or Sharp."],
  },
  "uses-responsive-images": {
    summary: "Send phones smaller images than desktops.",
    steps: ["Add srcset and sizes so each screen downloads an image close to the size it displays."],
    example: { language: "html", code: '<img src="photo-800.jpg"\n     srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1600.jpg 1600w"\n     sizes="(min-width: 800px) 800px, 100vw"\n     width="800" height="600" alt="…">' },
  },
  "offscreen-images": {
    summary: "Do not download images the visitor has not scrolled to.",
    steps: ["Add loading=\"lazy\" to images below the first screen.", "Do not lazy-load the main image at the top of the page."],
    example: { language: "html", code: '<img src="gallery-1.jpg" loading="lazy" width="600" height="400" alt="…">' },
  },
  "total-byte-weight": {
    summary: "Lower the total download so slow connections cope.",
    steps: ["Start with the largest files listed: compress or resize images, lazy-load media, and remove heavy libraries."],
  },
  "dom-size": {
    summary: "Keep the page's HTML small enough to render and update quickly.",
    steps: ["Aim for under about 1,500 elements.", "Render long lists in windows (virtualization) and avoid deeply nested wrappers."],
  },
  "server-response-time": {
    summary: "Get the first byte to the browser faster.",
    steps: ["Cache pages or API responses on a CDN or server.", "Optimise slow database queries and server-side work.", "Host closer to your visitors."],
  },
  redirects: {
    summary: "Skip the extra round trips before the page loads.",
    steps: ["Link straight to the final URL, including https and the preferred www or non-www host.", "Collapse redirect chains into a single redirect."],
  },
  "font-display": {
    summary: "Show text right away while custom fonts load.",
    steps: ["Add font-display: swap to each @font-face.", "Preload the one or two fonts used above the fold."],
    example: { language: "css", code: "@font-face {\n  font-family: \"Brand\";\n  src: url(\"/brand.woff2\") format(\"woff2\");\n  font-display: swap;\n}" },
  },
  "critical-request-chains": {
    summary: "Shorten the chain of files the page waits on.",
    steps: [
      "Preload the key files the audit lists so the browser fetches them in parallel.",
      "Connect early to the third-party origins you rely on.",
      "Inline or remove what a chain does not need.",
    ],
    example: { language: "html", code: '<link rel="preconnect" href="https://cdn.example.com" crossorigin>\n<link rel="preload" href="/fonts/brand.woff2" as="font" type="font/woff2" crossorigin>' },
  },
  "third-party-summary": {
    summary: "Stop outside scripts from slowing your page down.",
    steps: ["Remove third-party tags you do not use.", "Load the rest with async or defer, or after the user interacts.", "Use a click-to-load placeholder for heavy embeds such as video and chat."],
  },
  "legacy-javascript": {
    summary: "Stop shipping code that only very old browsers need.",
    steps: ["Update your build's browser targets (browserslist) to modern browsers.", "Remove unneeded polyfills."],
  },
  "duplicated-javascript": {
    summary: "Ship each library once.",
    steps: ["Deduplicate modules in your bundler, and align package versions so one copy is shared."],
  },
  "non-composited-animations": {
    summary: "Keep animations smooth.",
    steps: ["Animate transform and opacity instead of properties such as top, left, width or height."],
    example: { language: "css", code: ".panel {\n  transition: transform 0.2s ease;\n}\n.panel.open {\n  transform: translateX(0);\n}" },
  },
  "forced-reflow": {
    summary: "Avoid making the browser recalculate layout over and over.",
    steps: ["Read layout values (such as offsetHeight) together, then make DOM writes together.", "Do not alternate reads and writes inside a loop."],
  },
};

/** Audits that share a fix with another entry. */
const ALIASES: Record<string, string> = {
  "max-potential-fid": "total-blocking-time",
  "long-tasks": "total-blocking-time",
  "mainthread-work-breakdown": "total-blocking-time",
  "bootup-time": "total-blocking-time",
  "interactive": "total-blocking-time",
  "lcp-breakdown": "largest-contentful-paint",
  "lcp-discovery": "largest-contentful-paint",
  "unsized-images": "cumulative-layout-shift",
  "cls-culprits": "cumulative-layout-shift",
  "render-blocking": "render-blocking-resources",
  "cache": "uses-long-cache-ttl",
  "network-dependency-tree": "critical-request-chains",
  "image-delivery": "modern-image-formats",
  "document-latency": "server-response-time",
  "third-parties": "third-party-summary",
  "tap-targets": "target-size",
};

const CATEGORY_FALLBACK: Record<string, Solution> = {
  performance: {
    summary: "Find the biggest files and slowest steps, fix those first, and measure again.",
    steps: [
      "Open the page in Chrome, then DevTools > Lighthouse, and run the same audit to see the exact files and elements flagged.",
      "Fix the item with the largest saving first. Images, JavaScript and render-blocking files usually matter most.",
      "Run the audit again to confirm the score moved.",
    ],
  },
  accessibility: {
    summary: "Fix the flagged elements so everyone can use the page, then check with a keyboard.",
    steps: [
      "Open Chrome DevTools > Lighthouse, run the accessibility audit and select each flagged element.",
      "Apply the change described in the guide linked below.",
      "Try the page with only the keyboard (Tab, Shift+Tab, Enter) and confirm everything is reachable.",
    ],
  },
  seo: {
    summary: "Make the page easy for search engines to read and describe.",
    steps: ["Check the page's <head> for the tag or setting named in this finding.", "Apply the change described in the guide linked below.", "Run the audit again, then request re-indexing in Google Search Console if the page is live."],
  },
  "best-practices": {
    summary: "Bring the page in line with current web safety and quality standards.",
    steps: ["Read the guide linked below for what the browser expects.", "Apply the change, then reload the page with DevTools open and confirm no related warnings remain."],
  },
};

const GENERIC: Solution = {
  summary: "Follow the guide for this check, then run the audit again.",
  steps: ["Open the guide linked below.", "Apply the recommended change to the page or server.", "Run the audit again to confirm it passes."],
};

/** The fix for an audit: its own entry, a shared one, or the category's general advice. */
export function solutionFor(auditId: string, category: string | null): Solution {
  const base = auditId.replace(/-insight$/, "");
  const key = CATALOG[auditId] ? auditId : CATALOG[base] ? base : ALIASES[base];
  return (key ? CATALOG[key] : undefined) ?? (category ? CATEGORY_FALLBACK[category] : undefined) ?? GENERIC;
}
