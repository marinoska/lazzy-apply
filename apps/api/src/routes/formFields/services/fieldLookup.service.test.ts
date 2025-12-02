import { describe, it, expect, beforeEach } from "vitest";
import { FormFieldModel } from "@/formFields/index.js";
import { findFieldsByHashes } from "./fieldLookup.service.js";

describe("fieldLookup.service", () => {
	describe("findFieldsByHashes", () => {
		beforeEach(async () => {
			await FormFieldModel.deleteMany({});
		});

		it("should return empty found and all hashes as missing when no fields exist", async () => {
			const result = await findFieldsByHashes(["hash-1", "hash-2"]);

			expect(result.found.size).toBe(0);
			expect(result.missing).toEqual(["hash-1", "hash-2"]);
		});

		it("should return found fields and missing hashes", async () => {
			await FormFieldModel.create({
				fieldHash: "hash-1",
				field: {
					tag: "input",
					type: "email",
					name: "email",
					label: "Email",
					placeholder: null,
					description: null,
					isFileUpload: false,
					accept: null,
				},
				path: "personal.email",
				classification: "personal.email",
			});

			const result = await findFieldsByHashes(["hash-1", "hash-2"]);

			expect(result.found.size).toBe(1);
			expect(result.found.has("hash-1")).toBe(true);
			expect(result.found.get("hash-1")?.classification).toBe("personal.email");
			expect(result.missing).toEqual(["hash-2"]);
		});

		it("should return all fields when all exist", async () => {
			await FormFieldModel.create([
				{
					fieldHash: "hash-1",
					field: {
						tag: "input",
						type: "email",
						name: "email",
						label: "Email",
						placeholder: null,
						description: null,
						isFileUpload: false,
						accept: null,
					},
					path: "personal.email",
					classification: "personal.email",
				},
				{
					fieldHash: "hash-2",
					field: {
						tag: "input",
						type: "text",
						name: "name",
						label: "Full Name",
						placeholder: null,
						description: null,
						isFileUpload: false,
						accept: null,
					},
					path: "personal.fullName",
					classification: "personal.fullName",
				},
			]);

			const result = await findFieldsByHashes(["hash-1", "hash-2"]);

			expect(result.found.size).toBe(2);
			expect(result.missing).toEqual([]);
		});

		it("should handle empty input array", async () => {
			const result = await findFieldsByHashes([]);

			expect(result.found.size).toBe(0);
			expect(result.missing).toEqual([]);
		});
	});
});
