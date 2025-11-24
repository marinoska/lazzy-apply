import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import React from "react";
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
			<Typography level="title-lg" sx={{ fontWeight: 600 }}>
				LazyApplyAgent
			</Typography>
			<Stack direction="row" alignItems="center">
				{session && <LogoutButton onSignOut={onSignOut} />}
				<CloseButton onClose={onClose} />
			</Stack>
		</Stack>
	);
}
