import { useMutation } from "@tanstack/react-query";
import type { RefineFieldRequest } from "../api.js";
import { refineField } from "../api.js";

export const useRefineFieldMutation = () => {
	return useMutation({
		mutationFn: ({
			autofillId,
			fieldHash,
			request,
		}: {
			autofillId: string;
			fieldHash: string;
			request: RefineFieldRequest;
		}) => refineField(autofillId, fieldHash, request),
	});
};
