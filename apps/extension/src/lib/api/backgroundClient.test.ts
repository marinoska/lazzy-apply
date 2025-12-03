import { describe, expect, it } from "vitest";

/**
 * Tests for base64 encoding/decoding used in Chrome message passing.
 * The actual sendUploadRequest function requires Chrome APIs, so we test
 * the encoding/decoding logic in isolation.
 */
describe("backgroundClient base64 encoding", () => {
	describe("ArrayBuffer to base64 encoding", () => {
		it("should correctly encode binary data to base64", () => {
			// Simulate the encoding logic from sendUploadRequest
			const testData = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF magic bytes
			const binaryString = testData.reduce(
				(str, byte) => str + String.fromCharCode(byte),
				"",
			);
			const base64 = btoa(binaryString);

			expect(base64).toBe("JVBERg==");
		});

		it("should handle empty buffer", () => {
			const testData = new Uint8Array([]);
			const binaryString = testData.reduce(
				(str, byte) => str + String.fromCharCode(byte),
				"",
			);
			const base64 = btoa(binaryString);

			expect(base64).toBe("");
		});

		it("should handle large binary data", () => {
			// Create 1KB of random-ish data
			const testData = new Uint8Array(1024);
			for (let i = 0; i < testData.length; i++) {
				testData[i] = i % 256;
			}

			const binaryString = testData.reduce(
				(str, byte) => str + String.fromCharCode(byte),
				"",
			);
			const base64 = btoa(binaryString);

			// Base64 should be ~33% larger
			expect(base64.length).toBeGreaterThan(1024);
			expect(base64.length).toBeLessThan(1400);
		});
	});

	describe("base64 to ArrayBuffer decoding", () => {
		it("should correctly decode base64 back to binary", () => {
			// Simulate the decoding logic from messageHandler
			const base64 = "JVBERg=="; // %PDF
			const binaryString = atob(base64);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			expect(bytes[0]).toBe(0x25); // %
			expect(bytes[1]).toBe(0x50); // P
			expect(bytes[2]).toBe(0x44); // D
			expect(bytes[3]).toBe(0x46); // F
		});

		it("should handle empty base64 string", () => {
			const base64 = "";
			const binaryString = atob(base64);
			const bytes = new Uint8Array(binaryString.length);

			expect(bytes.length).toBe(0);
		});

		it("should roundtrip encode/decode correctly", () => {
			// Test with PDF-like content
			const original = new Uint8Array([
				0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xd3, 0xeb,
				0xe9, 0xe1, 0x0a, 0x31,
			]);

			// Encode
			const binaryString = original.reduce(
				(str, byte) => str + String.fromCharCode(byte),
				"",
			);
			const base64 = btoa(binaryString);

			// Decode
			const decodedBinaryString = atob(base64);
			const decoded = new Uint8Array(decodedBinaryString.length);
			for (let i = 0; i < decodedBinaryString.length; i++) {
				decoded[i] = decodedBinaryString.charCodeAt(i);
			}

			expect(decoded).toEqual(original);
		});

		it("should preserve all byte values 0-255", () => {
			// Test all possible byte values
			const original = new Uint8Array(256);
			for (let i = 0; i < 256; i++) {
				original[i] = i;
			}

			// Encode
			const binaryString = original.reduce(
				(str, byte) => str + String.fromCharCode(byte),
				"",
			);
			const base64 = btoa(binaryString);

			// Decode
			const decodedBinaryString = atob(base64);
			const decoded = new Uint8Array(decodedBinaryString.length);
			for (let i = 0; i < decodedBinaryString.length; i++) {
				decoded[i] = decodedBinaryString.charCodeAt(i);
			}

			expect(decoded).toEqual(original);
		});
	});
});
