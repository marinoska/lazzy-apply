import {
	COVER_LETTER_CTAS,
	COVER_LETTER_FORMATS,
	COVER_LETTER_LANGUAGES,
	COVER_LETTER_LENGTHS,
	COVER_LETTER_STYLES,
	COVER_LETTER_TONES,
	type CoverLetterCTA,
	type CoverLetterFormat,
	type CoverLetterLanguage,
	type CoverLetterLength,
	type CoverLetterSettings,
	type CoverLetterStyle,
	type CoverLetterTone,
} from "@lazyapply/types";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

export type {
	CoverLetterCTA,
	CoverLetterFormat,
	CoverLetterLanguage,
	CoverLetterLength,
	CoverLetterSettings,
	CoverLetterStyle,
	CoverLetterTone,
};

export const DEFAULT_COVER_LETTER_SETTINGS: CoverLetterSettings = {
	length: "medium" satisfies CoverLetterLength,
	tone: "professional" satisfies CoverLetterTone,
	format: "paragraph" satisfies CoverLetterFormat,
	language: "neutral" satisfies CoverLetterLanguage,
	cta: "minimal" satisfies CoverLetterCTA,
	style: "to the point" satisfies CoverLetterStyle,
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
const TONE_OPTIONS = COVER_LETTER_TONES;
const FORMAT_OPTIONS = COVER_LETTER_FORMATS;
const LANGUAGE_OPTIONS = COVER_LETTER_LANGUAGES;
const CTA_OPTIONS = COVER_LETTER_CTAS;
const STYLE_OPTIONS = COVER_LETTER_STYLES;

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
				label="Tone"
				options={TONE_OPTIONS}
				value={settings.tone}
				onChange={(tone) => onChange({ ...settings, tone })}
			/>
			<PillGroup
				label="Format"
				options={FORMAT_OPTIONS}
				value={settings.format}
				onChange={(format) => onChange({ ...settings, format })}
			/>
			<PillGroup
				label="Language"
				options={LANGUAGE_OPTIONS}
				value={settings.language}
				onChange={(language) => onChange({ ...settings, language })}
			/>
			<PillGroup
				label="CTA"
				options={CTA_OPTIONS}
				value={settings.cta}
				onChange={(cta) => onChange({ ...settings, cta })}
			/>
			<PillGroup
				label="Style"
				options={STYLE_OPTIONS}
				value={settings.style}
				onChange={(style) => onChange({ ...settings, style })}
			/>
		</Stack>
	);
}
