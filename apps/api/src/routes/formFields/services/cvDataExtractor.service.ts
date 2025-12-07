import {
	CV_DATA_PATH_MAP,
	type CVDataPath,
	type FormFieldPath,
	type ParsedCVData,
} from "@lazyapply/types";

/**
 * Check if a path exists in ParsedCVData structure
 * Uses CV_DATA_PATH_MAP as the single source of truth
 */
export function isPathInCVData(path: FormFieldPath): path is CVDataPath {
	return path in CV_DATA_PATH_MAP;
}

/**
 * Extract a value from CV data by path
 * Returns null if path doesn't exist or value is empty
 */
export function extractValueByPath(
	cvData: ParsedCVData,
	path: CVDataPath,
	linkType?: string,
): string | null {
	switch (path) {
		// Personal fields
		case "personal.fullName":
			return cvData.personal.fullName;
		case "personal.email":
			return cvData.personal.email;
		case "personal.phone":
			return cvData.personal.phone;
		case "personal.location":
			return cvData.personal.location;
		case "personal.nationality":
			return cvData.personal.nationality ?? null;
		case "personal.rightToWork":
			return cvData.personal.rightToWork ?? null;

		// Links - find by type
		case "links": {
			if (!linkType) return null;
			const link = cvData.links.find(
				(l) => l.type.toLowerCase() === linkType.toLowerCase(),
			);
			return link?.url ?? null;
		}

		// Simple string fields
		case "headline":
			return cvData.headline;
		case "summary":
			return cvData.summary;

		// Array fields - format as text
		case "experience":
			return formatExperience(cvData.experience);
		case "education":
			return formatEducation(cvData.education);
		case "certifications":
			return formatCertifications(cvData.certifications);
		case "languages":
			return formatLanguages(cvData.languages);

		// Extras fields
		case "extras.drivingLicense":
			return cvData.extras.drivingLicense ?? null;
		case "extras.workPermit":
			return cvData.extras.workPermit ?? null;
		case "extras.willingToRelocate":
			return cvData.extras.willingToRelocate != null
				? String(cvData.extras.willingToRelocate)
				: null;
		case "extras.remotePreference":
			return cvData.extras.remotePreference ?? null;
		case "extras.noticePeriod":
			return cvData.extras.noticePeriod ?? null;
		case "extras.availability":
			return cvData.extras.availability ?? null;
		case "extras.salaryExpectation":
			return cvData.extras.salaryExpectation ?? null;

		default:
			return null;
	}
}

function formatExperience(
	experience: ParsedCVData["experience"],
): string | null {
	if (!experience.length) return null;

	return experience
		.map((exp) => {
			const parts: string[] = [];
			if (exp.role) parts.push(exp.role);
			if (exp.company) parts.push(`at ${exp.company}`);
			if (exp.startDate || exp.endDate) {
				parts.push(`(${exp.startDate ?? "?"} - ${exp.endDate ?? "Present"})`);
			}
			if (exp.description) parts.push(`\n${exp.description}`);
			return parts.join(" ");
		})
		.join("\n\n");
}

function formatEducation(education: ParsedCVData["education"]): string | null {
	if (!education.length) return null;

	return education
		.map((edu) => {
			const parts: string[] = [];
			if (edu.degree) parts.push(edu.degree);
			if (edu.field) parts.push(`in ${edu.field}`);
			if (edu.institution) parts.push(`at ${edu.institution}`);
			if (edu.startDate || edu.endDate) {
				parts.push(`(${edu.startDate ?? "?"} - ${edu.endDate ?? "?"})`);
			}
			return parts.join(" ");
		})
		.join("\n");
}

function formatCertifications(
	certifications: ParsedCVData["certifications"],
): string | null {
	if (!certifications.length) return null;

	return certifications
		.map((cert) => {
			const parts: string[] = [cert.name];
			if (cert.issuer) parts.push(`by ${cert.issuer}`);
			if (cert.date) parts.push(`(${cert.date})`);
			return parts.join(" ");
		})
		.join("\n");
}

function formatLanguages(languages: ParsedCVData["languages"]): string | null {
	if (!languages.length) return null;

	return languages
		.map((lang) => {
			if (lang.level) return `${lang.language} (${lang.level})`;
			return lang.language;
		})
		.join(", ");
}
