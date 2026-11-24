# A server that can run real browsers, for hosts that run containers (Render, Railway, Fly.io, a VPS).
# Netlify and other serverless hosts cannot do this: see docs/DEPLOY_SERVER.md.
#
# The base image already holds Chromium, WebKit and the system libraries for Playwright 1.64.1, which must match the
# version in package.json (tests/dockerfile.test.ts checks that). The older Safari engines are installed below.
# Ubuntu 22.04 ("jammy") is used because the older Playwright releases that carry those engines support it.
FROM mcr.microsoft.com/playwright:v1.64.1-jammy

# tini reaps the browser processes that a session leaves behind, so they do not pile up as zombies.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install first, from the files that decide the dependencies, so a code change does not repeat this step.
# The postinstall script runs "prisma generate", which needs the schema and its config.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# The WebKit builds behind the Mac Safari 15 to 18 devices. Each comes from the Playwright release that bundled it
# (the playwright-webkit-N packages in package.json). They land beside the current browsers in /ms-playwright.
RUN node node_modules/playwright-webkit-18/cli.js install --with-deps webkit \
 && node node_modules/playwright-webkit-17/cli.js install --with-deps webkit \
 && node node_modules/playwright-webkit-16/cli.js install --with-deps webkit \
 && node node_modules/playwright-webkit-15/cli.js install --with-deps webkit

COPY . .
RUN npm run build

# Run as the unprivileged user the Playwright image provides.
RUN chown -R pwuser:pwuser /app
USER pwuser

ENV NODE_ENV=production
# The platform sets PORT. Next reads it, and listens on every interface.
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0"]
