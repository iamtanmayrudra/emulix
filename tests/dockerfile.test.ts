import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The Dockerfile cannot be built on every machine, so these checks catch the mistakes that would otherwise only show up
 * on the host: a base image that no longer matches Playwright, or an older Safari engine that is never installed.
 */
const dockerfile = readFileSync("Dockerfile", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
const installed = (name: string) => (JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8")) as { version: string }).version;

describe("Dockerfile", () => {
  it("uses the Playwright base image for the installed Playwright version", () => {
    const tag = dockerfile.match(/^FROM mcr\.microsoft\.com\/playwright:v([\d.]+)-jammy$/m);
    expect(tag, "FROM line").not.toBeNull();
    expect(tag![1]).toBe(installed("playwright"));
  });

  it("installs the WebKit build of every playwright-webkit-N package", () => {
    const aliases = Object.keys(pkg.dependencies).filter((name) => name.startsWith("playwright-webkit-"));
    expect(aliases.length).toBeGreaterThan(0);
    for (const name of aliases) {
      expect(dockerfile, name).toContain(`node node_modules/${name}/cli.js install --with-deps webkit`);
    }
  });

  it("installs dependencies after the prisma folder is copied, because postinstall runs prisma generate", () => {
    expect(dockerfile.indexOf("COPY prisma ./prisma")).toBeGreaterThan(-1);
    expect(dockerfile.indexOf("COPY prisma ./prisma")).toBeLessThan(dockerfile.indexOf("RUN npm ci"));
    expect(dockerfile.indexOf("COPY prisma.config.ts")).toBeLessThan(dockerfile.indexOf("RUN npm ci"));
  });

  it("runs as an unprivileged user and starts Next on every interface", () => {
    expect(dockerfile).toMatch(/^USER pwuser$/m);
    expect(dockerfile).toContain('"-H", "0.0.0.0"');
  });
});

describe(".dockerignore", () => {
  const ignore = readFileSync(".dockerignore", "utf8").split("\n").map((line) => line.trim());

  it("keeps secrets, dependencies and build output out of the image", () => {
    for (const entry of ["node_modules", ".next", ".git", ".env*", "src/generated"]) expect(ignore).toContain(entry);
  });
});
