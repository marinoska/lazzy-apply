import type { TypographyProps } from "@mui/joy/Typography";
import Typography from "@mui/joy/Typography";
import type { ReactNode } from "react";

interface BaseTextProps extends Omit<TypographyProps, "level"> {
	children: ReactNode;
}

export function BodySmall({ children, ...props }: BaseTextProps) {
	return (
		<Typography level="body-sm" {...props}>
			{children}
		</Typography>
	);
}

export function BodySmallDarker({ children, ...props }: BaseTextProps) {
	return (
		<Typography
			level="body-sm"
			sx={{ color: "neutral.700", ...props.sx }}
			{...props}
		>
			{children}
		</Typography>
	);
}

export function BodyMedium({ children, ...props }: BaseTextProps) {
	return (
		<Typography level="body-md" {...props}>
			{children}
		</Typography>
	);
}

export function BodyLarge({ children, ...props }: BaseTextProps) {
	return (
		<Typography level="body-lg" {...props}>
			{children}
		</Typography>
	);
}

export function BodyExtraSmall({ children, ...props }: BaseTextProps) {
	return (
		<Typography level="body-xs" {...props}>
			{children}
		</Typography>
	);
}

export function BodyExtraSmallDarker({ children, ...props }: BaseTextProps) {
	return (
		<Typography
			level="body-xs"
			sx={{ color: "neutral.700", ...props.sx }}
			{...props}
		>
			{children}
		</Typography>
	);
}

export function HeadingSmall({ children, ...props }: BaseTextProps) {
	return (
		<Typography level="h4" {...props}>
			{children}
		</Typography>
	);
}

export function HeadingMedium({ children, ...props }: BaseTextProps) {
	return (
		<Typography level="h3" {...props}>
			{children}
		</Typography>
	);
}

export function HeadingLarge({ children, ...props }: BaseTextProps) {
	return (
		<Typography level="h2" {...props}>
			{children}
		</Typography>
	);
}

export function TitleLarge({ children, ...props }: BaseTextProps) {
	return (
		<Typography level="title-lg" {...props}>
			{children}
		</Typography>
	);
}

export function TitleSmall({ children, ...props }: BaseTextProps) {
	return (
		<Typography level="title-sm" {...props}>
			{children}
		</Typography>
	);
}
