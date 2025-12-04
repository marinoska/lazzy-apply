import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import {
	LoadingIndicator,
	LoginButton,
	SidebarHeader,
	SidebarMainContent,
	StatusMessage,
} from "./components/index.js";
import type { SidebarViewProps } from "./types.js";

export function SidebarView({
	state,
	onClose,
	onSignIn,
	onSignOut,
}: SidebarViewProps) {
	const { visible, loading, status, session } = state;
	const statusIsError =
		status?.startsWith("Failed") || status?.startsWith("Error");

	return (
		<div
			className={`overlay${visible ? " visible" : ""}`}
			role="presentation"
			aria-hidden={visible ? "false" : "true"}
		>
			<Sheet className="panel" variant="soft" color="neutral">
				<Stack gap={2} sx={{ p: 2.5 }}>
					<SidebarHeader
						onClose={onClose}
						onSignOut={onSignOut}
						session={session}
					/>
					<Divider orientation="horizontal" color="border" />
					<StatusMessage status={status} />

					<LoadingIndicator loading={loading} />

					{!session ? (
						<LoginButton onClick={onSignIn} disabled={loading} />
					) : (
						<SidebarMainContent loading={loading} />
					)}
				</Stack>
				{statusIsError && <p>{status}</p>}
			</Sheet>
		</div>
	);
}
