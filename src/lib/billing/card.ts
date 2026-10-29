/**
 * Card checks for the simulated checkout. They run in the browser only, so card details are never sent to the server.
 * A real payment provider replaces this module (Phase 4).
 */

/** Visa test number. It passes the Luhn check and is not a real account. */
export const TEST_CARD_NUMBER = "4111 1111 1111 1111";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Groups digits in fours as the user types, for example 4111 1111 1111 1111. */
export function formatCardNumber(value: string): string {
  return digitsOnly(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function isValidCardNumber(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 13 || digits.length > 19) return false;

  // Luhn check: every second digit from the right is doubled.
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Turns MM/YY into the last day it is valid. Returns null when the format is wrong. */
export function parseExpiry(value: string): { month: number; year: number } | null {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: 2000 + Number(match[2]) };
}

/** A card is valid through the end of its expiry month. */
export function isValidExpiry(value: string, now: Date = new Date()): boolean {
  const expiry = parseExpiry(value);
  if (!expiry) return false;
  const firstDayAfter = new Date(expiry.year, expiry.month, 1);
  return firstDayAfter > now;
}

export function isValidCvv(value: string): boolean {
  return /^\d{3,4}$/.test(value.trim());
}

/** Inserts the slash in MM/YY as the user types. */
export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "card";

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  card: "Card",
};

/** The brand from the leading digits. It only labels the card on screen and on the receipt. */
export function detectCardBrand(value: string): CardBrand {
  const digits = digitsOnly(value);
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(6011|65)/.test(digits)) return "discover";
  return "card";
}

/** A standard test number that always fails, so the declined path can be tried without a real card. */
export const DECLINED_TEST_CARD = "4000 0000 0000 0002";

export function isDeclinedTestCard(value: string): boolean {
  return digitsOnly(value) === digitsOnly(DECLINED_TEST_CARD);
}
