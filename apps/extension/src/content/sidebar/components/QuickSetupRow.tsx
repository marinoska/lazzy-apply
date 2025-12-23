import {
	COVER_LETTER_FORMATS,
	COVER_LETTER_LENGTHS,
	type CoverLetterFormat,
	type CoverLetterLength,
	type CoverLetterSettings,
} from "@lazyapply/types";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

export type { CoverLetterFormat, CoverLetterLength };

export const DEFAULT_COVER_LETTER_SETTINGS: CoverLetterSettings = {
	length: "medium" satisfies CoverLetterLength,
	format: "bullet" satisfies CoverLetterFormat,
};

interface PillGroupProps<T extends string> {
	label: string;
	options: readonly T[];
	value: T;
	onChange: (value: T) => void;
}

function PillGroup<T extends string>({
	label,
	options,
	value,
	onChange,
}: PillGroupProps<T>) {
	return (
		<Stack direction="row" alignItems="center" gap={0.5}>
			<Typography
				level="body-xs"
				sx={{ color: "neutral.500", minWidth: "fit-content", mr: 0.5 }}
			>
				{label}:
			</Typography>
			{options.map((option) => (
				<Chip
					key={option}
					size="sm"
					variant={value === option ? "solid" : "outlined"}
					color={value === option ? "primary" : "neutral"}
					onClick={() => onChange(option)}
					sx={{
						cursor: "pointer",
						fontSize: "0.7rem",
						minHeight: "22px",
						"--Chip-paddingInline": "8px",
						transition: "all 0.15s ease",
						"&:hover": {
							bgcolor: value === option ? "primary.500" : "neutral.100",
						},
					}}
				>
					{option}
				</Chip>
			))}
		</Stack>
	);
}

const LENGTH_OPTIONS = COVER_LETTER_LENGTHS;
const FORMAT_OPTIONS = COVER_LETTER_FORMATS;

interface QuickSetupRowProps {
	settings: CoverLetterSettings;
	onChange: (settings: CoverLetterSettings) => void;
}

export function QuickSetupRow({ settings, onChange }: QuickSetupRowProps) {
	return (
		<Stack direction="column" gap={1.5} py={1} px={0.5}>
			<PillGroup
				label="Length"
				options={LENGTH_OPTIONS}
				value={settings.length}
				onChange={(length) => onChange({ ...settings, length })}
			/>
			<PillGroup
				label="Format"
				options={FORMAT_OPTIONS}
				value={settings.format}
				onChange={(format) => onChange({ ...settings, format })}
			/>
		</Stack>
	);
}
