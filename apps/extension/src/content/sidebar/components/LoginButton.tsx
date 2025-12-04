import Button from "@mui/joy/Button";

interface LoginButtonProps {
	onClick: () => void;
	disabled?: boolean;
}

export function LoginButton({ onClick, disabled }: LoginButtonProps) {
	return (
		<Button
			fullWidth
			variant="solid"
			color="primary"
			size="md"
			onClick={onClick}
			disabled={disabled}
		>
			Sign in with Google
		</Button>
	);
}
