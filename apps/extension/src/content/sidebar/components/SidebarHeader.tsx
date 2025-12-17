import Stack from "@mui/joy/Stack";
import { TitleLarge } from "@/content/components/Typography.js";
import type { StoredSession } from "../../../lib/supabase.js";
import { CloseButton } from "./CloseButton";
import { LogoutButton } from "./LogoutButton";

interface SidebarHeaderProps {
	onClose: () => void;
	onSignOut: () => void;
	session: StoredSession | null;
}

export function SidebarHeader({
	onClose,
	onSignOut,
	session,
}: SidebarHeaderProps) {
	return (
		<Stack direction="row" justifyContent="space-between" alignItems="center">
			<TitleLarge sx={{ fontWeight: 600 }}>JobAutoFill</TitleLarge>
			<Stack direction="row" alignItems="center">
				{session && <LogoutButton onSignOut={onSignOut} />}
				<CloseButton onClose={onClose} />
			</Stack>
		</Stack>
	);
}
