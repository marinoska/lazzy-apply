import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import type { StoredSession } from "../../../lib/supabase.js";

interface ActionButtonsProps {
	session: StoredSession | null;
	loading: boolean;
	onSignIn: () => void;
	onUploadClick: () => void;
}

export function ActionButtons({
	session,
	loading,
	onSignIn,
	onUploadClick,
}: ActionButtonsProps) {
	return (
		<Stack direction="row" spacing={1}>
			{!session ? <Button
				fullWidth
				variant="solid"
				color="primary"
				size="md"
				onClick={onSignIn}
				disabled={loading}
			>
				Sign in with Google
			</Button> : 
			<Button
				fullWidth
				variant="solid"
				color="primary"
				size="md"
				onClick={onUploadClick}
				disabled={loading}
			>
				Upload your CV
			</Button>
			}
		</Stack>
	);
}
