import Sheet from "@mui/joy/Sheet";
import { BodySmall, TitleSmall } from "@/components/Typography.js";
import type { StoredSession } from "../../../lib/supabase.js";

interface UserInfoProps {
	session: StoredSession | null;
	loading: boolean;
}

export function UserInfo({ session, loading }: UserInfoProps) {
	if (loading || !session) return null;

	return (
		<Sheet variant="plain" sx={{ borderRadius: "md", px: 1.5, py: 1 }}>
			<BodySmall sx={{ color: "success.500", fontWeight: 600, mb: 0.5 }}>
				Signed in
			</BodySmall>
			<TitleSmall>{session.user?.email ?? "unknown"}</TitleSmall>
		</Sheet>
	);
}
