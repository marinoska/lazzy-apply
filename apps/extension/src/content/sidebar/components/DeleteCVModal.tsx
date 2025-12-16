import Button from "@mui/joy/Button";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";

interface DeleteCVModalProps {
	open: boolean;
	filename: string;
	isDeleting: boolean;
	onConfirm: () => void;
	onClose: () => void;
}

export function DeleteCVModal({
	open,
	filename,
	isDeleting,
	onConfirm,
	onClose,
}: DeleteCVModalProps) {
	return (
		<Modal open={open} onClose={onClose} disablePortal>
			<ModalDialog variant="outlined" role="alertdialog">
				<DialogTitle>Delete this CV?</DialogTitle>
				<DialogContent>
					This will permanently remove "{filename}" from your uploads.
				</DialogContent>
				<DialogActions>
					<Button
						variant="solid"
						color="danger"
						onClick={onConfirm}
						loading={isDeleting}
					>
						Delete
					</Button>
					<Button variant="plain" color="neutral" onClick={onClose}>
						Cancel
					</Button>
				</DialogActions>
			</ModalDialog>
		</Modal>
	);
}
