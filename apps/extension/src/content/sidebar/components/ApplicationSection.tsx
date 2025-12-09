import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import { AppAlert } from "@/components/AppAlert.js";
import { useUploads } from "@/lib/api/context/UploadsContext.js";
import { useAutofill } from "../context/AutofillContext.js";
import { AutofillButton } from "./AutofillButton.js";
import { GenerateCoverLetter } from "./GenerateCoverLetter.js";

interface ApplicationSectionProps {
	onError: (message: string) => void;
}

export function ApplicationSection({ onError }: ApplicationSectionProps) {
	const { isSelectedReady, hasUploads } = useUploads();
	const { error, clearError } = useAutofill();

	// Report errors to parent
	if (error) {
		onError(error);
		clearError();
	}

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

	return (
		<Stack direction="column" spacing={1}>
			<Divider orientation="horizontal" />
			<AutofillButton />
			<GenerateCoverLetter />
		</Stack>
	);
}
