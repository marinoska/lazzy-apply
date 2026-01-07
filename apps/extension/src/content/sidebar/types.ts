import type { StoredSession } from "../../lib/supabase.js";

export interface SidebarState {
	visible: boolean;
	completelyHidden: boolean;
	loading: boolean;
	status: string | null;
	session: StoredSession | null;
}

export interface SidebarDeps {
	fetchSession: () => Promise<StoredSession | null>;
	signIn: () => Promise<void>;
	signOut: () => Promise<void>;
}

export interface SidebarModule {
	show: () => Promise<void>;
	hide: () => void;
	updateSession: (session: StoredSession | null) => void;
	showError: (message: string) => void;
	isVisible: () => boolean;
}

export interface SidebarViewProps {
	state: SidebarState;
	onClose: () => void;
	onOpen: () => void;
	onCompleteClose: () => void;
	onSignIn: () => void;
	onSignOut: () => void;
}
