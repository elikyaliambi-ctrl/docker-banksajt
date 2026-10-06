import { describe, expect, it } from "vitest";
import { validateAmount } from "../src/validateAmount.js";

describe("validateAmount", () => {
  it("godkänner ett vanligt positivt belopp", () => {
    expect(validateAmount(100)).toBe(true);
  });

  it("nekar noll", () => {
    expect(validateAmount(0)).toBe(false);
  });

  it("nekar negativa belopp", () => {
    expect(validateAmount(-50)).toBe(false);
  });

  it("nekar NaN", () => {
    expect(validateAmount(NaN)).toBe(false);
  });

  it("nekar Infinity", () => {
    expect(validateAmount(Infinity)).toBe(false);
  });

  it("nekar värden som inte är ett tal", () => {
    expect(validateAmount("100")).toBe(false);
    expect(validateAmount(null)).toBe(false);
    expect(validateAmount(undefined)).toBe(false);
  });
});
