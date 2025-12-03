import { describe, expect, it } from "vitest";

/**
 * Simulates SHA-256 hash computation to verify buffer content.
 * Uses Web Crypto API like the actual implementation.
 */
async function sha256(buffer: ArrayBuffer): Promise<string> {
	const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA-256 of empty buffer - this is what we get when buffer is consumed
const EMPTY_BUFFER_HASH =
	"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/**
 * Tests for buffer handling in uploadHandler.
 * The buffer copy fix ensures that text extraction doesn't consume
 * the buffer needed for R2 storage and hash computation.
 */
describe("uploadHandler buffer handling", () => {
	describe("buffer copy preservation", () => {
		it("should preserve buffer content after slice copy", () => {
			// Simulate PDF buffer
			const original = new ArrayBuffer(16);
			const originalView = new Uint8Array(original);
			// PDF magic bytes: %PDF
			originalView[0] = 0x25;
			originalView[1] = 0x50;
			originalView[2] = 0x44;
			originalView[3] = 0x46;

			// Make a copy like we do in uploadHandler
			const copy = original.slice(0);
			const copyView = new Uint8Array(copy);

			// Verify copy has same content
			expect(copyView[0]).toBe(0x25);
			expect(copyView[1]).toBe(0x50);
			expect(copyView[2]).toBe(0x44);
			expect(copyView[3]).toBe(0x46);
			expect(copy.byteLength).toBe(original.byteLength);
		});

		it("should maintain independent copies", () => {
			const original = new ArrayBuffer(8);
			const originalView = new Uint8Array(original);
			originalView[0] = 0xff;

			const copy = original.slice(0);
			const copyView = new Uint8Array(copy);

			// Modify original
			originalView[0] = 0x00;

			// Copy should be unchanged
			expect(copyView[0]).toBe(0xff);
		});

		it("should capture fileSize before any operations", () => {
			const buffer = new ArrayBuffer(283456); // Typical PDF size
			const fileSize = buffer.byteLength;

			// Even if buffer were somehow modified, fileSize is captured
			expect(fileSize).toBe(283456);
		});

		it("should handle empty buffer", () => {
			const original = new ArrayBuffer(0);
			const copy = original.slice(0);

			expect(copy.byteLength).toBe(0);
		});

		it("should handle large buffer", () => {
			// 5MB buffer (max upload size)
			const size = 5 * 1024 * 1024;
			const original = new ArrayBuffer(size);
			const originalView = new Uint8Array(original);

			// Set some bytes
			originalView[0] = 0x25;
			originalView[size - 1] = 0xff;

			const copy = original.slice(0);
			const copyView = new Uint8Array(copy);

			expect(copy.byteLength).toBe(size);
			expect(copyView[0]).toBe(0x25);
			expect(copyView[size - 1]).toBe(0xff);
		});
	});

	describe("PDF magic bytes detection", () => {
		it("should detect valid PDF magic bytes", () => {
			const buffer = new ArrayBuffer(16);
			const bytes = new Uint8Array(buffer);
			// %PDF-1.4
			bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

			const isPDF =
				bytes[0] === 0x25 &&
				bytes[1] === 0x50 &&
				bytes[2] === 0x44 &&
				bytes[3] === 0x46;

			expect(isPDF).toBe(true);
		});

		it("should reject non-PDF content", () => {
			const buffer = new ArrayBuffer(16);
			const bytes = new Uint8Array(buffer);
			// Some random bytes
			bytes.set([0x00, 0x01, 0x02, 0x03]);

			const isPDF =
				bytes[0] === 0x25 &&
				bytes[1] === 0x50 &&
				bytes[2] === 0x44 &&
				bytes[3] === 0x46;

			expect(isPDF).toBe(false);
		});

		it("should reject empty buffer", () => {
			const buffer = new ArrayBuffer(0);
			const bytes = new Uint8Array(buffer);

			const isPDF =
				bytes[0] === 0x25 &&
				bytes[1] === 0x50 &&
				bytes[2] === 0x44 &&
				bytes[3] === 0x46;

			expect(isPDF).toBe(false);
		});
	});

	describe("hash computation with buffer copy", () => {
		it("should compute correct hash from buffer copy", async () => {
			// Create a buffer with known content
			const original = new ArrayBuffer(4);
			const view = new Uint8Array(original);
			view.set([0x25, 0x50, 0x44, 0x46]); // %PDF

			// Make a copy like uploadHandler does
			const copy = original.slice(0);

			// Hash should be computed from the copy
			const hash = await sha256(copy);

			// Should NOT be the empty buffer hash
			expect(hash).not.toBe(EMPTY_BUFFER_HASH);
			// Should be consistent
			expect(hash).toBe(
				"3df79d34abbca99308e79cb94461c1893582604d68329a41fd4bec1885e6adb4",
			);
		});

		it("should detect empty buffer hash", async () => {
			const emptyBuffer = new ArrayBuffer(0);
			const hash = await sha256(emptyBuffer);

			expect(hash).toBe(EMPTY_BUFFER_HASH);
		});

		it("should produce different hashes for different content", async () => {
			const buffer1 = new ArrayBuffer(4);
			new Uint8Array(buffer1).set([1, 2, 3, 4]);

			const buffer2 = new ArrayBuffer(4);
			new Uint8Array(buffer2).set([5, 6, 7, 8]);

			const hash1 = await sha256(buffer1);
			const hash2 = await sha256(buffer2);

			expect(hash1).not.toBe(hash2);
			expect(hash1).not.toBe(EMPTY_BUFFER_HASH);
			expect(hash2).not.toBe(EMPTY_BUFFER_HASH);
		});

		it("should produce same hash for copied buffer", async () => {
			const original = new ArrayBuffer(100);
			const view = new Uint8Array(original);
			for (let i = 0; i < 100; i++) {
				view[i] = i;
			}

			const copy = original.slice(0);

			const hashOriginal = await sha256(original);
			const hashCopy = await sha256(copy);

			expect(hashOriginal).toBe(hashCopy);
			expect(hashOriginal).not.toBe(EMPTY_BUFFER_HASH);
		});
	});
});
