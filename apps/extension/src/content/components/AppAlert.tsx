import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import { BodySmall } from "@/content/components/Typography.js";

type AlertType = "error" | "success" | "info";

interface AppAlertProps {
	type: AlertType;
	message?: string;
	onClose?: () => void;
}

const CONFIG = {
	error: {
		color: "danger",
		icon: <ErrorIcon />,
		defaultMessage: "Oops... Please try reloading the page.",
	},
	success: {
		color: "success",
		icon: <CheckCircleIcon />,
		defaultMessage: "Success!",
	},
	info: {
		color: "neutral",
		icon: <InfoIcon />,
		defaultMessage: "",
	},
} as const;

export function AppAlert({ type, message, onClose }: AppAlertProps) {
	const config = CONFIG[type];
	const displayMessage = message ?? config.defaultMessage;

	return (
		<Alert
			variant="soft"
			color={config.color}
			startDecorator={config.icon}
			endDecorator={
				onClose ? (
					<Button
						size="sm"
						variant="plain"
						color={config.color}
						onClick={onClose}
					>
						<CloseIcon />
					</Button>
				) : undefined
			}
		>
			<BodySmall>{displayMessage}</BodySmall>
		</Alert>
	);
}
