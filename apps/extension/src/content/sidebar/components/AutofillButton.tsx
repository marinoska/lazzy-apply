import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import { useAutofill } from "../context/AutofillContext.js";

export function AutofillButton() {
	const { formDetected, isLoading, runAutofill } = useAutofill();

	const isDisabled = isLoading || formDetected === false;

	return (
		<>
			{formDetected === false && (
				<Alert color="neutral" size="sm" variant="soft">
					No application form detected on this page
				</Alert>
			)}
			<Button
				fullWidth
				variant="outlined"
				color="primary"
				size="md"
				onClick={runAutofill}
				loading={isLoading}
				disabled={isDisabled}
			>
				Autofill Application
			</Button>
		</>
	);
}
