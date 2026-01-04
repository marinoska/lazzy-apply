import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Button from "@mui/joy/Button";
import { useState } from "react";
import { useAutofill } from "../context/AutofillContext.js";
import { CoverLetterModal } from "./CoverLetterModal.js";

export function GenerateCoverLetter() {
	const { hasCoverLetterField } = useAutofill();
	const [modalOpen, setModalOpen] = useState(false);
	if (!hasCoverLetterField) {
		return null;
	}

	return (
		<>
			<Button
				fullWidth
				variant="outlined"
				color="success"
				size="md"
				onClick={() => setModalOpen(true)}
				startDecorator={<AutoAwesomeIcon />}
			>
				Generate Cover Letter
			</Button>
			<CoverLetterModal open={modalOpen} onClose={() => setModalOpen(false)} />
		</>
	);
}
