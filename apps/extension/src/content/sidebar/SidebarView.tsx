import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CloseIcon from "@mui/icons-material/Close";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { UploadsProvider } from "@/lib/api/context/UploadsContext.js";
import {
	LoadingIndicator,
	LoginButton,
	SidebarHeader,
	SidebarMainContent,
	StatusMessage,
} from "./components/index.js";
import { AutofillProvider } from "./context/AutofillContext.js";
import type { SidebarViewProps } from "./types.js";

export function SidebarView({
	state,
	onClose,
	onOpen,
	onCompleteClose,
	onSignIn,
	onSignOut,
}: SidebarViewProps) {
	const { visible, completelyHidden, loading, status, session } = state;
	const statusIsError =
		status?.startsWith("Failed") || status?.startsWith("Error");

	const handleTabClose = (e: React.MouseEvent) => {
		e.stopPropagation();
		onCompleteClose();
	};

	return (
		<>
			<div
				className={`toggle-tab${visible || completelyHidden ? " hidden" : ""}`}
			>
				<button
					type="button"
					className="toggle-tab-open"
					onClick={onOpen}
					aria-label="Open sidebar"
				>
					<ChevronLeftIcon sx={{ fontSize: 20, color: "white" }} />
				</button>
				<button
					type="button"
					className="toggle-tab-close"
					onClick={handleTabClose}
					aria-label="Close sidebar completely"
				>
					<CloseIcon sx={{ fontSize: 14, color: "white" }} />
				</button>
			</div>

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

						{session ? (
							<UploadsProvider>
								<AutofillProvider>
									<SidebarMainContent loading={loading} />
								</AutofillProvider>
							</UploadsProvider>
						) : (
							<LoginButton onClick={onSignIn} disabled={loading} />
						)}
					</Stack>
					{statusIsError && <p>{status}</p>}
				</Sheet>
			</div>
		</>
	);
}
