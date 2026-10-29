import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeNextPath } from "../src/lib/auth/next-path";
import { MemoryAuthStore, type UserRecord } from "../src/lib/auth/store";
import { DECLINED_TEST_CARD, detectCardBrand, isDeclinedTestCard, isValidCardNumber } from "../src/lib/billing/card";
import { createOrder, parseCheckoutInput, publicOrder } from "../src/lib/billing/checkout";
import { PRO_PRICING, addCycle, formatMoney, perMonthCents, priceCents, yearlySavingsPercent } from "../src/lib/billing/plans";

/** Shared with the mocks below, which vitest moves to the top of the file. */
const ctx = vi.hoisted(() => ({ userId: null as string | null, store: null as null | { findUserById(id: string): Promise<unknown> } }));

vi.mock("../src/lib/auth/runtime", () => ({
  getCurrentUser: vi.fn(async () => (ctx.userId && ctx.store ? ctx.store.findUserById(ctx.userId) : null)),
}));
vi.mock("../src/lib/auth/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/auth/store")>();
  return { ...original, getAuthStore: () => ctx.store };
});

describe("plan pricing", () => {
  it("formats money the same way everywhere", () => {
    expect(formatMoney(1900)).toBe("$19.00");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("prices each billing period and works out the yearly saving", () => {
    expect(priceCents("monthly")).toBe(PRO_PRICING.monthlyCents);
    expect(priceCents("yearly")).toBe(PRO_PRICING.yearlyCents);
    expect(perMonthCents("yearly")).toBe(Math.round(PRO_PRICING.yearlyCents / 12));
    expect(yearlySavingsPercent()).toBeGreaterThan(0);
    expect(yearlySavingsPercent()).toBeLessThan(100);
  });

  it("renews a month or a year later, without spilling into the next month", () => {
    expect(addCycle(new Date(2026, 0, 15), "monthly")).toEqual(new Date(2026, 1, 15));
    expect(addCycle(new Date(2026, 0, 31), "monthly")).toEqual(new Date(2026, 1, 28));
    expect(addCycle(new Date(2028, 0, 31), "monthly")).toEqual(new Date(2028, 1, 29));
    expect(addCycle(new Date(2026, 9, 29), "yearly")).toEqual(new Date(2027, 9, 29));
    expect(addCycle(new Date(2028, 1, 29), "yearly")).toEqual(new Date(2029, 1, 28));
  });
});

describe("test cards", () => {
  it("recognises the card brand from the first digits", () => {
    expect(detectCardBrand("4111 1111 1111 1111")).toBe("visa");
    expect(detectCardBrand("5555 5555 5555 4444")).toBe("mastercard");
    expect(detectCardBrand("3782 822463 10005")).toBe("amex");
    expect(detectCardBrand("6011 0000 0000 0004")).toBe("discover");
    expect(detectCardBrand("9999")).toBe("card");
    expect(detectCardBrand("")).toBe("card");
  });

  it("has a test card that passes the number check but is declined", () => {
    expect(isValidCardNumber(DECLINED_TEST_CARD)).toBe(true);
    expect(isDeclinedTestCard(DECLINED_TEST_CARD)).toBe(true);
    expect(isDeclinedTestCard("4111 1111 1111 1111")).toBe(false);
  });
});

describe("checkout input and orders", () => {
  it("accepts a billing period with or without a card summary", () => {
    expect(parseCheckoutInput({ plan: "pro", cycle: "yearly" })).toEqual({ ok: true, input: { cycle: "yearly", card: null } });
    expect(parseCheckoutInput({ cycle: "monthly", card: { brand: "visa", last4: "1111" } })).toEqual({
      ok: true,
      input: { cycle: "monthly", card: { brand: "visa", last4: "1111" } },
    });
  });

  it("refuses an unknown plan, period or card summary", () => {
    expect(parseCheckoutInput({ plan: "team", cycle: "monthly" }).ok).toBe(false);
    expect(parseCheckoutInput({ cycle: "weekly" }).ok).toBe(false);
    expect(parseCheckoutInput({}).ok).toBe(false);
    expect(parseCheckoutInput(null).ok).toBe(false);
    expect(parseCheckoutInput({ cycle: "monthly", card: { brand: "visa", last4: "4111111111111111" } }).ok).toBe(false);
    expect(parseCheckoutInput({ cycle: "monthly", card: { brand: "bitcoin", last4: "1111" } }).ok).toBe(false);
  });

  it("prices the order on the server from the period, never from the request", () => {
    const now = new Date(2026, 9, 29);
    const order = createOrder({ cycle: "yearly", card: null }, now, "EMX-TEST0001");
    expect(order).toMatchObject({ orderId: "EMX-TEST0001", plan: "pro", cycle: "yearly", amountCents: PRO_PRICING.yearlyCents, currency: "USD" });
    expect(order.renewsAt).toEqual(new Date(2027, 9, 29));
    expect(publicOrder(order).paidAt).toBe(now.toISOString());
  });
});

describe("redirect after sign-in", () => {
  it("allows a path on this site", () => {
    expect(safeNextPath("/checkout")).toBe("/checkout");
    expect(safeNextPath("/checkout?plan=pro")).toBe("/checkout?plan=pro");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil", "/a://b", "/x\ny", ""]) {
      expect(safeNextPath(bad)).toBe("/dashboard");
    }
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined, "/home")).toBe("/home");
    expect(safeNextPath("/" + "a".repeat(300))).toBe("/dashboard");
  });
});

describe("POST /api/billing/upgrade", () => {
  const store = new MemoryAuthStore();
  ctx.store = store;
  let nextId = 0;

  async function addUser(overrides: Partial<UserRecord> = {}): Promise<UserRecord> {
    nextId += 1;
    const user: UserRecord = {
      id: `u${nextId}`,
      email: `u${nextId}@example.com`,
      name: "Test User",
      passwordHash: "x",
      emailVerifiedAt: new Date(),
      failedLogins: 0,
      lockedUntil: null,
      createdAt: new Date(),
      lastLoginAt: null,
      ...overrides,
    };
    await store.insertUser(user);
    ctx.userId = user.id;
    return user;
  }

  const call = async (body: unknown) => {
    const { POST } = await import("../src/app/api/billing/upgrade/route");
    const response = await POST(new Request("http://localhost/api/billing/upgrade", { method: "POST", body: JSON.stringify(body) }));
    return { status: response.status, json: (await response.json()) as Record<string, unknown> };
  };

  beforeEach(() => {
    ctx.userId = null;
  });

  it("needs a signed-in account", async () => {
    expect((await call({ cycle: "monthly" })).status).toBe(401);
  });

  it("lets an unverified account upgrade while email verification is off", async () => {
    await addUser({ emailVerifiedAt: null });
    expect((await call({ cycle: "monthly" })).status).toBe(200);
  });

  it("turns a free account into Pro and stores the order with only the card's last four digits", async () => {
    const user = await addUser();
    const { status, json } = await call({ plan: "pro", cycle: "yearly", card: { brand: "visa", last4: "1111" } });
    expect(status).toBe(200);
    expect(json.order).toMatchObject({ plan: "pro", cycle: "yearly", amountCents: PRO_PRICING.yearlyCents, card: { brand: "visa", last4: "1111" } });
    const saved = await store.findUserById(user.id);
    expect(saved?.subscription).toBe("active");
    expect(saved?.billing?.orderId).toBe((json.order as { orderId: string }).orderId);
    expect(JSON.stringify(saved?.billing)).not.toMatch(/\d{13}/);
  });

  it("returns the same order on a second request, so a double click never charges twice", async () => {
    await addUser();
    const first = await call({ cycle: "monthly" });
    const second = await call({ cycle: "yearly" });
    expect(second.status).toBe(200);
    expect(second.json.alreadyPro).toBe(true);
    expect((second.json.order as { orderId: string; cycle: string }).orderId).toBe((first.json.order as { orderId: string }).orderId);
    expect((second.json.order as { cycle: string }).cycle).toBe("monthly");
  });

  it("says so when an account is already Pro without an order", async () => {
    await addUser({ subscription: "active" });
    const { status, json } = await call({ cycle: "monthly" });
    expect(status).toBe(409);
    expect(json.error).toBe("already_pro");
  });

  it("rejects an invalid billing period", async () => {
    await addUser();
    expect((await call({ cycle: "weekly" })).status).toBe(400);
    expect((await call({})).status).toBe(400);
  });
});
