import { describe, expect, it } from "vitest";
import {
  formatCardNumber,
  formatExpiry,
  isValidCardNumber,
  isValidCvv,
  isValidExpiry,
} from "../src/lib/billing/card";

describe("card number", () => {
  it("accepts the Visa test number with or without spaces", () => {
    expect(isValidCardNumber("4111 1111 1111 1111")).toBe(true);
    expect(isValidCardNumber("4111111111111111")).toBe(true);
  });

  it("rejects numbers that fail the Luhn check or have the wrong length", () => {
    expect(isValidCardNumber("4111 1111 1111 1112")).toBe(false);
    expect(isValidCardNumber("411111111111")).toBe(false);
    expect(isValidCardNumber("")).toBe(false);
  });

  it("groups digits in fours while typing", () => {
    expect(formatCardNumber("41111111")).toBe("4111 1111");
    expect(formatCardNumber("4111a1111 1111 1111 9999")).toBe("4111 1111 1111 1111 999");
  });
});

describe("expiry", () => {
  const now = new Date(2026, 9, 27);

  it("accepts a month that has not ended yet, including the current month", () => {
    expect(isValidExpiry("10/26", now)).toBe(true);
    expect(isValidExpiry("12/30", now)).toBe(true);
  });

  it("rejects past months and malformed values", () => {
    expect(isValidExpiry("09/26", now)).toBe(false);
    expect(isValidExpiry("13/30", now)).toBe(false);
    expect(isValidExpiry("1030", now)).toBe(false);
  });

  it("formats MM/YY as the user types", () => {
    expect(formatExpiry("1230")).toBe("12/30");
    expect(formatExpiry("12")).toBe("12");
  });
});

describe("cvv", () => {
  it("accepts 3 or 4 digits only", () => {
    expect(isValidCvv("123")).toBe(true);
    expect(isValidCvv("1234")).toBe(true);
    expect(isValidCvv("12")).toBe(false);
    expect(isValidCvv("12a")).toBe(false);
  });
});
