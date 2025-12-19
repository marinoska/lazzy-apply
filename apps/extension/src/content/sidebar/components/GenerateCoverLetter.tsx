import DescriptionIcon from "@mui/icons-material/Description";
import Button from "@mui/joy/Button";
import { useState } from "react";
import { useAutofill } from "../context/AutofillContext.js";
import { CoverLetterModal } from "./CoverLetterModal.js";

export function GenerateCoverLetter() {
	const { hasCoverLetterField } = useAutofill();
	const [modalOpen, setModalOpen] = useState(false);
	console.log({ hasCoverLetterField });
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
				startDecorator={<DescriptionIcon />}
			>
				Generate Cover Letter
			</Button>
			<CoverLetterModal open={modalOpen} onClose={() => setModalOpen(false)} />
		</>
	);
}
