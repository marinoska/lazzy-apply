import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
	const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
		null,
	);

	useEffect(() => {
		const host = document.getElementById("lazyjob-auth-sidebar-host");
		if (host?.shadowRoot) {
			const container = host.shadowRoot.querySelector(
				"div",
			) as HTMLElement | null;
			setPortalContainer(container);
		}
	}, []);

	if (!open || !portalContainer) return null;

	return createPortal(
		<>
			{/* Backdrop */}
			<div
				role="button"
				tabIndex={0}
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: "rgba(0, 0, 0, 0.6)",
					zIndex: 2147483648,
					pointerEvents: "auto",
				}}
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === "Escape" || e.key === "Enter") onClose();
				}}
			/>
			{/* Modal Dialog */}
			<Sheet
				sx={{
					position: "fixed",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					width: "400px",
					maxWidth: "calc(100vw - 32px)",
					bgcolor: "background.surface",
					zIndex: 2147483649,
					borderRadius: "md",
					p: 3,
					boxShadow: "lg",
					pointerEvents: "auto",
				}}
			>
				<Stack gap={2}>
					<Typography level="title-lg" color="danger">
						Delete this CV?
					</Typography>
					<Typography level="body-md">
						This will permanently remove "{filename}" from your uploads.
					</Typography>
					<Stack direction="row" gap={1} justifyContent="flex-end">
						<Button variant="plain" color="neutral" onClick={onClose}>
							Cancel
						</Button>
						<Button
							variant="solid"
							color="danger"
							onClick={onConfirm}
							loading={isDeleting}
						>
							Delete
						</Button>
					</Stack>
				</Stack>
			</Sheet>
		</>,
		portalContainer,
	);
}
