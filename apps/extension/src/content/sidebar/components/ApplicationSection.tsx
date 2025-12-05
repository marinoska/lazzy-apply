import { AppAlert } from "@/components/AppAlert.js";
import { useUploads } from "@/lib/api/context/UploadsContext.js";
import { AutofillButton } from "./AutofillButton.js";

interface ApplicationSectionProps {
	onError: (message: string) => void;
}

export function ApplicationSection({ onError }: ApplicationSectionProps) {
	const { isSelectedReady, hasUploads } = useUploads();

	if (!hasUploads) {
		return null;
	}

	if (!isSelectedReady) {
		return (
			<AppAlert
				type="info"
				message="Please select a ready CV to autofill your application"
			/>
		);
	}

	return <AutofillButton onError={onError} />;
}
