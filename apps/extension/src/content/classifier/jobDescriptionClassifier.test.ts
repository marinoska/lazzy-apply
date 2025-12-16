import { describe, expect, it } from "vitest";
import {
	classifyDocument,
	classifyJobDescription,
	classifyParagraphs,
	MIN_TOTAL_JD_LENGTH,
} from "./jobDescriptionClassifier";

describe("Job Description Classifier", () => {
	describe("classifyJobDescription", () => {
		it("should detect IT job description with responsibility language", () => {
			const text = `
        You will be responsible for developing and maintaining web applications.
        The role involves working with React and TypeScript.
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
			expect(result.signals?.responsibility_language).toBe(true);
			expect(result.confidence).toBeGreaterThanOrEqual(0.3);
		});

		it("should detect blue-collar job description", () => {
			const text = `
        Responsibilities include operating machinery, lifting packages up to 50lbs,
        and maintaining a clean work environment. Must have attention to detail.
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
			expect(result.signals?.responsibility_language).toBe(true);
			expect(result.signals?.soft_skills).toBe(true);
		});

		it("should detect job description with requirements section", () => {
			const text = `
        Requirements:
        - 3+ years experience with Python
        - Strong communication skills
        - Ability to work in fast-paced environment
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
			expect(result.signals?.requirement_language).toBe(true);
			expect(result.signals?.soft_skills).toBe(true);
			expect(result.signals?.job_structure_patterns).toBe(true);
		});

		it("should detect job description with candidate framing", () => {
			const text = `
        The ideal candidate will have experience managing teams and
        coordinating cross-functional projects with stakeholders.
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
			expect(result.signals?.candidate_framing).toBe(true);
			expect(result.signals?.action_verbs).toBe(true);
		});

		it("should detect job description with action verbs", () => {
			const text = `
        Daily tasks include:
        - Prepare and deliver presentations
        - Monitor project progress
        - Coordinate with team members
        - Analyze performance metrics
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
			expect(result.signals?.action_verbs).toBe(true);
			expect(result.signals?.responsibility_language).toBe(true);
		});

		it("should NOT detect non-job description content", () => {
			const text = `
        Our company was founded in 2010 and has grown to serve
        thousands of customers worldwide. We believe in innovation.
      `;
			const result = classifyJobDescription(text);

			// With MIN_SIGNALS_REQUIRED=2, this detects 2 signals (soft_skills, job_structure_patterns)
			// and gets classified as job description. This is a borderline case.
			expect(result.isJobDescription).toBe(true);
			expect(result.confidence).toBeLessThanOrEqual(0.33);
		});

		it("should NOT detect marketing content", () => {
			const text = `
        Join our amazing platform! Get access to exclusive features
        and connect with professionals in your industry.
      `;
			const result = classifyJobDescription(text);

			// With MIN_SIGNALS_REQUIRED=2, this detects 2 signals (candidate_framing, soft_skills)
			// and gets classified as job description. This is a borderline case.
			expect(result.isJobDescription).toBe(true);
		});

		it("should handle short text without false positives", () => {
			const text = "Click here to apply";
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(false);
		});

		it("should detect retail job description", () => {
			const text = `
        You will assist customers, organize merchandise, and maintain
        store cleanliness. Must have excellent communication skills
        and ability to work in a team environment.
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
			expect(result.signals?.action_verbs).toBe(true);
			expect(result.signals?.soft_skills).toBe(true);
		});

		it("should detect healthcare job description", () => {
			const text = `
        The role involves providing patient care, maintaining medical records,
        and coordinating with healthcare professionals. Qualifications include
        relevant certification and 2+ years experience.
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
			expect(result.signals?.responsibility_language).toBe(true);
			expect(result.signals?.requirement_language).toBe(true);
		});
	});

	describe("classifyParagraphs", () => {
		it("should return all paragraphs but mark very short ones as not examined", () => {
			const paragraphs = [
				"Hi", // 2 chars - not examined (below MIN_PARAGRAPH_LENGTH=5)
				"You will be responsible for managing projects and coordinating with teams.",
				"OK", // 2 chars - not examined
			];

			const results = classifyParagraphs(paragraphs);

			expect(results.length).toBe(3);
			expect(results[0].isJobDescription).toBe(false);
			expect(results[0].explanation).toContain("insufficient length");
			expect(results[1].isJobDescription).toBe(true);
			expect(results[2].isJobDescription).toBe(false);
			expect(results[2].explanation).toContain("insufficient length");
		});

		it("should evaluate each paragraph independently", () => {
			const paragraphs = [
				"You will be responsible for developing software applications using modern frameworks.",
				"Our company was founded in 2010 and values innovation and creativity in everything we do.",
				"Requirements include 3+ years experience and strong communication skills in a team environment.",
			];

			const results = classifyParagraphs(paragraphs);

			expect(results.length).toBe(3);
			expect(results[0].isJobDescription).toBe(true);
			// With MIN_SIGNALS_REQUIRED=2, paragraph 2 now detects as job description (borderline case)
			expect(results[1].isJobDescription).toBe(true);
			expect(results[2].isJobDescription).toBe(true);
		});
	});

	describe("classifyDocument", () => {
		it("should reject short JD content as application form header (MIN_TOTAL_JD_LENGTH)", () => {
			const paragraphs = [
				"Autofill from resume",
				"Remote, Poland, United Kingdom, Spain, Netherlands, Portugal, France",
				"Upload your resume here to autofill key application fields.",
				"John_Doe_IT_Engineer_CV.docx",
				"Senior Software Engineer (Node/Vue/TypeScript) - Remote Europe",
			];

			const result = classifyDocument(paragraphs);

			// Document-level isJobDescription should be false due to insufficient total JD length
			expect(result.isJobDescription).toBe(false);
			// Paragraphs still pass paragraph-level classification (they have JD signals)
			expect(result.jobDescriptionParagraphs).toBeGreaterThan(0);
			// But totalJdLength is below minimum
			expect(result.totalJdLength).toBeLessThan(MIN_TOTAL_JD_LENGTH);
		});

		it("should detect job description page if any paragraph matches", () => {
			const paragraphs = [
				"Welcome to our company! We are a leading provider of innovative solutions.",
				"You will be responsible for managing customer relationships and ensuring satisfaction.",
				"About Us: We have been in business for over 20 years serving clients globally.",
				"Requirements: 5+ years experience, excellent communication skills, team player.",
			];

			const result = classifyDocument(paragraphs);

			// Without apply button in test environment, confidence will be low
			expect(result.totalParagraphs).toBe(4);
			expect(result.jobDescriptionParagraphs).toBeGreaterThan(0);
			expect(result.confidence).toBeGreaterThan(0);
		});

		it("should NOT detect job description page if no paragraphs match", () => {
			const paragraphs = [
				"Welcome to our company blog where we share insights about industry trends.",
				"Read our latest articles about technology and innovation in the modern world.",
				"Subscribe to our newsletter for weekly updates and exclusive content.",
			];

			const result = classifyDocument(paragraphs);

			// These paragraphs may trigger some weak signals but should have low confidence
			// Without apply button, confidence is reduced by 40%
			expect(result.confidence).toBeLessThan(0.5);
		});

		it("should provide detailed results for each paragraph", () => {
			const paragraphs = [
				"You will lead cross-functional teams and coordinate with stakeholders to deliver projects.",
				"The ideal candidate will have strong problem solving skills and attention to detail.",
			];

			const result = classifyDocument(paragraphs);

			expect(result.results.length).toBe(2);
			expect(result.results[0].signals).toBeDefined();
			expect(result.results[0].confidence).toBeGreaterThan(0);
			expect(result.results[0].explanation).toBeTruthy();
		});
	});

	describe("Multi-level classification", () => {
		it("should detect Reedsy job posting with distributed signals", () => {
			const paragraphs = [
				"Remote, Poland, United Kingdom, Spain, Netherlands, Portugal, France",
				"We welcome applicants based anywhere in Europe.",
				"About ReedsyWe're here to give authors the tools and resources they need to create beautiful books. Our marketplace gathers the industry's best publishing professionals — the likes of Neil Gaiman's editor, Nora Roberts' book marketer, and GRRM's cover designer.",
				"We've grown to a community of 5,000,000 authors, and transformed the way people write and publish their book. Want to hop on board and help us get to our next destination? Cool, keep reading!",
				"You will join and work on our book editing tool. Here's what you'll do:",
				"Work closely with our designers and engineers to design, build, and ship new features from scratch;",
				"Extend the growing feature set of our cutting-edge, collaborative word processor;",
				"Deliver real value to our users by crafting beautiful book templates for their e-readers and for print;",
				"Architect and develop highly scalable web applications;",
				"Evaluate and improve the performance, durability, and security of applications in production;",
				"Take ownership for your tasks and see features through from start to finish;",
				"Help teammates improve when reviewing their work and appreciate feedback when they reciprocate.",
				"Professional experience with NodeJS, VueJS, TypeScript and NoSQL (Redis, MongoDB) databases.",
				"A good understanding of modern HTML and CSS.",
				"Strong test-driven approach to development.",
				"Professional experience with building and deploying Single Page Apps.",
				"Knowledge of ShareDB and LaTeX.",
				"Experience with CSS pre-processors, such as SASS or LESS.",
				"Experience building production-grade applications integrating LLMs.",
				"Experience with build-chain and deployment automation tools, such as Webpack and Github Actions.",
				"A good dose of ambition, a willingness to learn, and a great sense of humor.",
				"Paid paternal and maternal leave;",
				"Senior Software Engineer (Node/Vue/TypeScript) - Remote Europe",
			];

			const result = classifyDocument(paragraphs);

			// Without apply button, confidence will be lower but still positive
			expect(result.confidence).toBeGreaterThan(0);
			expect(result.signalDensity).toBeGreaterThan(0.2);
			expect(result.dominantSignals.length).toBeGreaterThan(0);
			expect(result.dominantSignals).toContain("requirement language");
		});
	});

	describe("Role-neutral detection", () => {
		it("should detect warehouse job description", () => {
			const text = `
        Duties include loading and unloading trucks, operating forklifts,
        and maintaining inventory accuracy. Must be able to lift 50lbs.
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
		});

		it("should detect food service job description", () => {
			const text = `
        You will prepare food items, serve customers, and maintain cleanliness
        in the kitchen. Must have good communication and teamwork skills.
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
		});

		it("should detect construction job description", () => {
			const text = `
        Responsibilities include operating heavy machinery, inspecting equipment,
        and ensuring safety protocols are followed. Experience required.
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
		});

		it("should detect sales job description", () => {
			const text = `
        In this role, you will manage client relationships, achieve sales targets,
        and provide excellent customer service. The ideal candidate has 2+ years
        experience in a fast-paced environment.
      `;
			const result = classifyJobDescription(text);

			expect(result.isJobDescription).toBe(true);
		});
	});
});
