import { AppAlert } from "@/components/AppAlert.js";

interface StatusMessageProps {
	status: string | null;
}

export function StatusMessage({ status }: StatusMessageProps) {
	if (!status) return null;

	const isError = status.startsWith("Failed") || status.startsWith("Error");
	const type = isError ? "error" : "info";

	return <AppAlert type={type} message={isError ? undefined : status} />;
}
