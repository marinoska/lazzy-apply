import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateCoverLetterRequest } from "../api.js";
import * as api from "../api.js";
import { useGenerateCoverLetterMutation } from "./useGenerateCoverLetterMutation.js";

vi.mock("../api.js", async () => {
	const actual = await vi.importActual("../api.js");
	return {
		...actual,
		generateCoverLetter: vi.fn(),
	};
});

describe("useGenerateCoverLetterMutation", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		vi.clearAllMocks();
	});

	const wrapper = ({ children }: { children: React.ReactNode }) => {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};

	it("should successfully generate cover letter", async () => {
		const mockResponse = {
			autofillId: "test-autofill-id",
			coverLetter: "Dear Hiring Manager,\n\nTest cover letter content...",
		};

		vi.mocked(api.generateCoverLetter).mockResolvedValue(mockResponse);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		const request: GenerateCoverLetterRequest = {
			autofillId: "test-autofill-id",
			fieldHash: "test-field-hash",
			instructions: "Highlight leadership experience",
			settings: {
				length: "medium",
				format: "paragraph",
			},
		};

		result.current.mutate(request);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(api.generateCoverLetter).toHaveBeenCalledWith(request);
		expect(result.current.data).toEqual(mockResponse);
	});

	it("should handle request without instructions", async () => {
		const mockResponse = {
			autofillId: "test-autofill-id",
			coverLetter: "Generated cover letter",
		};

		vi.mocked(api.generateCoverLetter).mockResolvedValue(mockResponse);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		const request: GenerateCoverLetterRequest = {
			autofillId: "test-autofill-id",
			fieldHash: "test-field-hash",
			settings: {
				length: "short",
				format: "bullet",
			},
		};

		result.current.mutate(request);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(api.generateCoverLetter).toHaveBeenCalledWith(request);
	});

	it("should handle request without settings", async () => {
		const mockResponse = {
			autofillId: "test-autofill-id",
			coverLetter: "Generated cover letter",
		};

		vi.mocked(api.generateCoverLetter).mockResolvedValue(mockResponse);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		const request: GenerateCoverLetterRequest = {
			autofillId: "test-autofill-id",
			fieldHash: "test-field-hash",
			instructions: "Focus on technical skills",
		};

		result.current.mutate(request);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(api.generateCoverLetter).toHaveBeenCalledWith(request);
	});

	it("should handle minimal request with only autofillId", async () => {
		const mockResponse = {
			autofillId: "minimal-id",
			coverLetter: "Minimal cover letter",
		};

		vi.mocked(api.generateCoverLetter).mockResolvedValue(mockResponse);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		const request: GenerateCoverLetterRequest = {
			autofillId: "minimal-id",
			fieldHash: "test-field-hash",
		};

		result.current.mutate(request);

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data?.autofillId).toBe("minimal-id");
	});

	it("should handle API errors", async () => {
		const error = new Error("Failed to generate cover letter");
		vi.mocked(api.generateCoverLetter).mockRejectedValue(error);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		const request: GenerateCoverLetterRequest = {
			autofillId: "test-autofill-id",
			fieldHash: "test-field-hash",
		};

		result.current.mutate(request);

		await waitFor(() => expect(result.current.isError).toBe(true));

		expect(result.current.error).toEqual(error);
	});

	it("should handle network errors", async () => {
		const networkError = new Error("Network request failed");
		vi.mocked(api.generateCoverLetter).mockRejectedValue(networkError);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		result.current.mutate({
			autofillId: "test-autofill-id",
			fieldHash: "test-field-hash",
		});

		await waitFor(() => expect(result.current.isError).toBe(true));

		expect(result.current.error).toEqual(networkError);
	});

	it("should track loading state correctly", async () => {
		const mockResponse = {
			autofillId: "test-autofill-id",
			coverLetter: "Test content",
		};

		vi.mocked(api.generateCoverLetter).mockImplementation(
			() =>
				new Promise((resolve) => {
					setTimeout(() => resolve(mockResponse), 100);
				}),
		);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		expect(result.current.isPending).toBe(false);

		result.current.mutate({
			autofillId: "test-autofill-id",
			fieldHash: "test-field-hash",
		});

		await waitFor(() => expect(result.current.isPending).toBe(true));
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.isPending).toBe(false);
	});

	it("should handle multiple mutations sequentially", async () => {
		const responses = [
			{ autofillId: "id-1", coverLetter: "Letter 1" },
			{ autofillId: "id-2", coverLetter: "Letter 2" },
			{ autofillId: "id-3", coverLetter: "Letter 3" },
		];

		vi.mocked(api.generateCoverLetter)
			.mockResolvedValueOnce(responses[0])
			.mockResolvedValueOnce(responses[1])
			.mockResolvedValueOnce(responses[2]);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		for (let i = 0; i < 3; i++) {
			result.current.mutate({
				autofillId: `id-${i + 1}`,
				fieldHash: "test-field-hash",
			});

			await waitFor(() => expect(result.current.isSuccess).toBe(true));
			expect(result.current.data).toEqual(responses[i]);
		}

		expect(api.generateCoverLetter).toHaveBeenCalledTimes(3);
	});

	it("should handle all length and format options", async () => {
		const lengths = ["short", "medium", "detailed"] as const;
		const formats = ["paragraph", "bullet"] as const;

		for (const length of lengths) {
			for (const format of formats) {
				vi.mocked(api.generateCoverLetter).mockResolvedValue({
					autofillId: "test-id",
					coverLetter: `${length} ${format} letter`,
				});

				const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
					wrapper,
				});

				result.current.mutate({
					autofillId: "test-id",
					fieldHash: "test-field-hash",
					settings: {
						length,
						format,
					},
				});

				await waitFor(() => expect(result.current.isSuccess).toBe(true));
			}
		}
	});

	it("should reset mutation state", async () => {
		const mockResponse = {
			autofillId: "test-id",
			coverLetter: "Test letter",
		};

		vi.mocked(api.generateCoverLetter).mockResolvedValue(mockResponse);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		result.current.mutate({
			autofillId: "test-id",
			fieldHash: "test-field-hash",
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		result.current.reset();

		await waitFor(() => {
			expect(result.current.data).toBeUndefined();
			expect(result.current.isSuccess).toBe(false);
			expect(result.current.isError).toBe(false);
		});
	});

	it("should handle very long cover letters", async () => {
		const longCoverLetter = "A".repeat(10000);
		const mockResponse = {
			autofillId: "test-id",
			coverLetter: longCoverLetter,
		};

		vi.mocked(api.generateCoverLetter).mockResolvedValue(mockResponse);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		result.current.mutate({
			autofillId: "test-id",
			fieldHash: "test-field-hash",
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data?.coverLetter.length).toBe(10000);
	});

	it("should handle special characters in cover letter", async () => {
		const specialChars =
			"Test with émojis 🎉, quotes \"'', and symbols @#$%^&*()";
		const mockResponse = {
			autofillId: "test-id",
			coverLetter: specialChars,
		};

		vi.mocked(api.generateCoverLetter).mockResolvedValue(mockResponse);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		result.current.mutate({
			autofillId: "test-id",
			fieldHash: "test-field-hash",
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data?.coverLetter).toBe(specialChars);
	});

	it("should handle timeout errors", async () => {
		const timeoutError = new Error("Request timeout");
		vi.mocked(api.generateCoverLetter).mockRejectedValue(timeoutError);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		result.current.mutate({
			autofillId: "test-id",
			fieldHash: "test-field-hash",
		});

		await waitFor(() => expect(result.current.isError).toBe(true));

		expect(result.current.error).toEqual(timeoutError);
	});

	it("should handle unauthorized errors", async () => {
		const authError = new Error("Unauthorized");
		vi.mocked(api.generateCoverLetter).mockRejectedValue(authError);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		result.current.mutate({
			autofillId: "test-id",
			fieldHash: "test-field-hash",
		});

		await waitFor(() => expect(result.current.isError).toBe(true));

		expect(result.current.error).toEqual(authError);
	});

	it("should use mutateAsync for promise-based flow", async () => {
		const mockResponse = {
			autofillId: "test-id",
			coverLetter: "Async letter",
		};

		vi.mocked(api.generateCoverLetter).mockResolvedValue(mockResponse);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		const response = await result.current.mutateAsync({
			autofillId: "test-id",
			fieldHash: "test-field-hash",
		});

		expect(response).toEqual(mockResponse);
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
	});

	it("should handle mutateAsync errors", async () => {
		const error = new Error("Async error");
		vi.mocked(api.generateCoverLetter).mockRejectedValue(error);

		const { result } = renderHook(() => useGenerateCoverLetterMutation(), {
			wrapper,
		});

		await expect(
			result.current.mutateAsync({
				autofillId: "test-id",
				fieldHash: "test-field-hash",
			}),
		).rejects.toThrow("Async error");
	});
});
