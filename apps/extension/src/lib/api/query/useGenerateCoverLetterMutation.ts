import { useMutation } from "@tanstack/react-query";
import type { GenerateCoverLetterRequest } from "../api.js";
import { generateCoverLetter } from "../api.js";

export const useGenerateCoverLetterMutation = () => {
	return useMutation({
		mutationFn: (request: GenerateCoverLetterRequest) =>
			generateCoverLetter(request),
	});
};
