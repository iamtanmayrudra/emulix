import { describe, expect, it } from "vitest";
import { JobFailure, createTestJob, userJobs } from "../src/lib/testing/jobs";
import { isPrivateAddress, parseTargetUrl, resolvesToPublicAddress } from "../src/lib/testing/url-guard";

describe("parseTargetUrl", () => {
  it("accepts a normal https address", () => {
    const result = parseTargetUrl("https://example.com/pricing");
    expect(result.ok).toBe(true);
  });

  it.each([
    ["", "Enter a website address."],
    ["example.com", "Enter a full address, including https://."],
    ["ftp://example.com", "Only http and https addresses can be tested."],
    ["https://user:pass@example.com", "Addresses with a username or password are not allowed."],
    ["https://example.com:22", "Only the standard web ports (80, 443, 8080, 8443) can be tested."],
    ["http://localhost/", "Local addresses cannot be tested."],
    ["http://intranet", "Use a full domain name, such as example.com."],
    ["http://intranet.local", "Local addresses cannot be tested."],
    ["https://" + "a".repeat(2100) + ".com", "That address is too long."],
  ])("rejects %j", (input, message) => {
    const result = parseTargetUrl(input);
    expect(result).toEqual({ ok: false, reason: message });
  });
});

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.5",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:10.0.0.1",
  ])("treats %s as private", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "192.0.43.8", "2606:4700:4700::1111"])("treats %s as public", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe("resolvesToPublicAddress", () => {
  it("allows public IP literals and blocks private ones without a DNS lookup", async () => {
    expect(await resolvesToPublicAddress("8.8.8.8")).toBe(true);
    expect(await resolvesToPublicAddress("169.254.169.254")).toBe(false);
    expect(await resolvesToPublicAddress("10.0.0.5")).toBe(false);
  });
});

describe("createTestJob", () => {
  const userId = "user-test-jobs";

  it("rejects an unknown device profile", async () => {
    await expect(
      createTestJob({ userId, url: "https://8.8.8.8/", profileId: "nope", landscape: false, plan: "pro" }),
    ).rejects.toMatchObject({ code: "unknown_profile" });
  });

  it("blocks a Pro-only profile for a Free user", async () => {
    await expect(
      createTestJob({ userId, url: "https://8.8.8.8/", profileId: "ipad-air", landscape: false, plan: "free" }),
    ).rejects.toBeInstanceOf(JobFailure);
  });

  it("blocks a private target before any browser starts", async () => {
    await expect(
      createTestJob({ userId: "other", url: "http://10.0.0.5/", profileId: "iphone-14", landscape: false, plan: "free" }),
    ).rejects.toMatchObject({ code: "unsafe_target" });
  });

  it("refuses a local address at the syntax check", async () => {
    await expect(
      createTestJob({ userId: "other", url: "http://localhost:3000/", profileId: "iphone-14", landscape: false, plan: "free" }),
    ).rejects.toMatchObject({ code: "invalid_url" });
  });

  it("allows one unfinished run on Free and blocks a second", async () => {
    const first = await createTestJob({
      userId: "free-user",
      url: "https://8.8.8.8/",
      profileId: "iphone-14",
      landscape: false,
      plan: "free",
    });
    expect(first.status).toBe("queued");
    await expect(
      createTestJob({ userId: "free-user", url: "https://8.8.8.8/", profileId: "pixel-7", landscape: false, plan: "free" }),
    ).rejects.toMatchObject({ code: "concurrency_limit" });
    expect(userJobs("free-user")).toHaveLength(1);
  });
});
