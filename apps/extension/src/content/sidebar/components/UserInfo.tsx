import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import React from "react";
import type { StoredSession } from "../../../lib/supabase.js";

interface UserInfoProps {
	session: StoredSession | null;
	loading: boolean;
}

export function UserInfo({ session, loading }: UserInfoProps) {
	if (loading || !session) return null;

	return (
		<Sheet variant="plain" sx={{ borderRadius: "md", px: 1.5, py: 1 }}>
			<Typography
				level="body-sm"
				color="success"
				sx={{ fontWeight: 600, mb: 0.5 }}
			>
				Signed in
			</Typography>
			<Typography level="title-sm">
				{session.user?.email ?? "unknown"}
			</Typography>
		</Sheet>
	);
}
