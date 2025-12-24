
import type { GenerateCoverLetterReq

// Custom fetch that routes through background script to avoid CORS/mixed content
async function backgroundFetch(
	input: RequestInfo | URL,
	init?: Request_backgroundFetch
): Promise<Response> {
	await apiClient.setAccessToken();

	const url = typeof input === "string" ? input : input.toString();

	const response = await fetch(`${apiClient.host}${url}`, {
		...init,
		headers: {
			...init?.headers,
			Authorization: apiClient.authToken ? `Bearer ${apiClient.authToken}` : "",
		},
	});

	return response;
}
