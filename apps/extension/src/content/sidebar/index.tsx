import { CacheProvider } from "@emotion/react";
import { CssVarsProvider } from "@mui/joy/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { StoredSession } from "../../lib/supabase.js";
import { SidebarView } from "./SidebarView.js";
import { setupShadowDOM } from "./shadowDOM.js";
import type { SidebarDeps, SidebarModule, SidebarState } from "./types.js";
import { formatError } from "./utils.js";

export type { SidebarModule } from "./types.js";

export function createSidebar(deps: SidebarDeps): SidebarModule {
	const state: SidebarState = {
		visible: false,
		loading: false,
		status: null,
		session: null,
	};

	// Setup shadow DOM
	const { root, theme, emotionCache, shadowRootElement } = setupShadowDOM();

	// Setup React Query
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				refetchOnWindowFocus: false,
				staleTime: 5 * 60 * 1000, // 5 minutes
			},
		},
	});

	// State management
	const update = (partial: Partial<SidebarState>): void => {
		Object.assign(state, partial);
		render();
	};

	const render = (): void => {
		root.render(
			<QueryClientProvider client={queryClient}>
				<CacheProvider value={emotionCache}>
					<CssVarsProvider
						theme={theme}
						colorSchemeNode={shadowRootElement} // where the data-joy-color-scheme attr is set
						colorSchemeSelector=":host" // so the vars live on the shadow root
						disableNestedContext
					>
						<SidebarView
							state={state}
							onClose={hide}
							onSignIn={handleSignIn}
							onSignOut={handleSignOut}
						/>
					</CssVarsProvider>
				</CacheProvider>
			</QueryClientProvider>,
		);
	};

	// Public API
	const show = async (): Promise<void> => {
		update({ visible: true, loading: true, status: null });
		try {
			const session = await deps.fetchSession();
			update({ session, loading: false, status: null });
		} catch (error) {
			console.error("Failed to fetch session:", error);
			update({
				loading: false,
				status: formatError("Failed to fetch session", error),
			});
		}
	};

	const hide = (): void => {
		update({ visible: false });
	};

	// Event handlers
	const handleSignIn = async (): Promise<void> => {
		update({ loading: true, status: "Logging in…" });
		try {
			await deps.signIn();
			update({ status: "Finishing sign-in…" });
			const session = await deps.fetchSession();
			update({ session, loading: false, status: null });
		} catch (error) {
			console.error("Sign-in failed:", error);
			update({
				loading: false,
				status: formatError("Failed to sign in", error),
			});
		}
	};

	const handleSignOut = async (): Promise<void> => {
		update({ loading: true, status: "Signing out…" });
		try {
			await deps.signOut();
			update({ session: null, loading: false, status: null });
		} catch (error) {
			console.error("Sign-out failed:", error);
			update({
				loading: false,
				status: formatError("Failed to sign out", error),
			});
		}
	};

	const updateSession = (session: StoredSession | null): void => {
		update({
			session,
			loading: false,
			status: session ? null : state.status,
		});
	};

	const showError = (message: string): void => {
		console.error("Error:", message);
		update({ loading: false, status: `Error: ${message}` });
	};

	const isVisible = (): boolean => {
		return state.visible;
	};

	// Keyboard handler
	const onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape" && state.visible) {
			event.stopPropagation();
			hide();
		}
	};

	// Setup and initial render
	window.addEventListener("keydown", onKeyDown, true);
	render();

	return {
		show,
		hide,
		updateSession,
		showError,
		isVisible,
	};
}

export default createSidebar;
