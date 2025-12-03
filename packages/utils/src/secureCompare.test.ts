import { describe, expect, it } from "vitest";
import { secureCompare } from "./secureCompare";

describe("secureCompare", () => {
	describe("equality checks", () => {
		it("should return true for identical strings", () => {
			expect(secureCompare("secret123", "secret123")).toBe(true);
			expect(secureCompare("", "")).toBe(true);
			expect(secureCompare("a", "a")).toBe(true);
		});

		it("should return false for different strings of same length", () => {
			expect(secureCompare("secret123", "secret124")).toBe(false);
			expect(secureCompare("aaa", "aab")).toBe(false);
		});

		it("should return false for strings of different lengths", () => {
			expect(secureCompare("short", "muchlongerstring")).toBe(false);
			expect(secureCompare("longer", "short")).toBe(false);
			expect(secureCompare("a", "")).toBe(false);
			expect(secureCompare("", "a")).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("should handle empty strings", () => {
			expect(secureCompare("", "")).toBe(true);
		});

		it("should handle unicode characters", () => {
			expect(secureCompare("héllo", "héllo")).toBe(true);
			expect(secureCompare("héllo", "hello")).toBe(false);
		});

		it("should handle special characters", () => {
			expect(secureCompare("p@$$w0rd!", "p@$$w0rd!")).toBe(true);
			expect(secureCompare("p@$$w0rd!", "p@$$w0rd?")).toBe(false);
		});
	});

	describe("timing attack resistance", () => {
		it("should not short-circuit on first character mismatch", () => {
			// This test verifies the function completes without throwing
			// The actual timing resistance is ensured by using timingSafeEqual
			const result1 = secureCompare("aaaaaaaaaa", "baaaaaaaaa");
			const result2 = secureCompare("aaaaaaaaaa", "aaaaaaaaab");

			expect(result1).toBe(false);
			expect(result2).toBe(false);
		});

		it("should handle length differences without leaking timing info", () => {
			// When lengths differ, we still perform a comparison to maintain constant time
			const result = secureCompare("short", "verylongstring");
			expect(result).toBe(false);
		});
	});
});
