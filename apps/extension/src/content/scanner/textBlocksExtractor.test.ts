import { beforeEach, describe, expect, it } from "vitest";
import { extractTextBlocks } from "./textBlocksExtractor";

describe("extractTextBlocks", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("should extract h1 headers as header type", () => {
		document.body.innerHTML = `
      <h1 class="fw-extrabold fs-xl mb-sm">
        <span class="mb-0">Data Engineering Functional Lead</span>
      </h1>
    `;

		const blocks = extractTextBlocks();
		const headers = blocks.filter((b) => b.type === "header");

		expect(headers).toHaveLength(1);
		expect(headers[0].text).toBe("Data Engineering Functional Lead");
		expect(headers[0].element).toBe("h1");
	});

	it("should extract all header levels (h1-h6)", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <h2>About the Role</h2>
      <h3>Responsibilities</h3>
      <h4>Requirements</h4>
      <h5>Benefits</h5>
      <h6>Additional Info</h6>
    `;

		const blocks = extractTextBlocks();
		const headers = blocks.filter((b) => b.type === "header");

		expect(headers).toHaveLength(6);
		expect(headers.map((h) => h.element)).toEqual([
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
		]);
	});

	it("should extract paragraphs as paragraph type", () => {
		document.body.innerHTML = `
      <p>This is a job description paragraph with enough text to pass the minimum length threshold.</p>
    `;

		const blocks = extractTextBlocks();
		const paragraphs = blocks.filter((b) => b.type === "paragraph");

		expect(paragraphs).toHaveLength(1);
		expect(paragraphs[0].element).toBe("p");
	});

	it("should skip headers in navigation elements", () => {
		document.body.innerHTML = `
      <nav>
        <h1>Site Navigation</h1>
      </nav>
      <h1>Actual Job Title</h1>
    `;

		const blocks = extractTextBlocks();
		const headers = blocks.filter((b) => b.type === "header");

		expect(headers).toHaveLength(1);
		expect(headers[0].text).toBe("Actual Job Title");
	});

	it("should skip hidden headers", () => {
		document.body.innerHTML = `
      <h1 style="display: none;">Hidden Title</h1>
      <h1>Visible Title</h1>
    `;

		const blocks = extractTextBlocks();
		const headers = blocks.filter((b) => b.type === "header");

		expect(headers).toHaveLength(1);
		expect(headers[0].text).toBe("Visible Title");
	});

	it("should extract text from complex header structures", () => {
		document.body.innerHTML = `
      <h1 class="job-title">
        <span class="prefix">Senior</span>
        <span class="main">Software Engineer</span>
      </h1>
    `;

		const blocks = extractTextBlocks();
		const headers = blocks.filter((b) => b.type === "header");

		expect(headers).toHaveLength(1);
		expect(headers[0].text).toBe("Senior Software Engineer");
	});

	it("should deduplicate identical text blocks", () => {
		document.body.innerHTML = `
      <h1>Duplicate Title</h1>
      <h2>Duplicate Title</h2>
      <p>This is a unique paragraph with sufficient length to be extracted properly.</p>
    `;

		const blocks = extractTextBlocks();

		// Should only have one "Duplicate Title" due to deduplication
		const duplicateTitles = blocks.filter((b) => b.text === "Duplicate Title");
		expect(duplicateTitles).toHaveLength(1);
	});

	it("should filter out short paragraphs but not headers", () => {
		document.body.innerHTML = `
      <h1>Short</h1>
      <p>Too short</p>
      <p>This paragraph is long enough to be included in the extraction results.</p>
    `;

		const blocks = extractTextBlocks();

		expect(blocks.some((b) => b.text === "Short" && b.type === "header")).toBe(
			true,
		);
		expect(blocks.some((b) => b.text === "Too short")).toBe(false);
		expect(blocks.some((b) => b.text.includes("long enough"))).toBe(true);
	});

	it("should extract list items as paragraphs", () => {
		document.body.innerHTML = `
      <ul>
        <li>Responsibility one with enough text to pass the minimum threshold</li>
        <li>Responsibility two with enough text to pass the minimum threshold</li>
      </ul>
    `;

		const blocks = extractTextBlocks();
		const listItems = blocks.filter((b) => b.element === "li");

		expect(listItems).toHaveLength(2);
		expect(listItems.every((item) => item.type === "paragraph")).toBe(true);
	});

	it("should extract leaf divs as paragraphs", () => {
		document.body.innerHTML = `
      <div>This is a leaf div with enough text content to be extracted as a paragraph.</div>
    `;

		const blocks = extractTextBlocks();
		const divs = blocks.filter((b) => b.element === "div");

		expect(divs).toHaveLength(1);
		expect(divs[0].type).toBe("paragraph");
	});

	it("should maintain order: headers first, then paragraphs", () => {
		document.body.innerHTML = `
      <h1>Title</h1>
      <p>First paragraph with sufficient length to be included in extraction.</p>
      <h2>Subtitle</h2>
      <p>Second paragraph with sufficient length to be included in extraction.</p>
    `;

		const blocks = extractTextBlocks();

		// Headers are extracted first, then paragraphs
		const headerIndices = blocks
			.map((b, i) => ({ block: b, index: i }))
			.filter(({ block }) => block.type === "header")
			.map(({ index }) => index);

		expect(headerIndices[0]).toBeLessThan(
			blocks.findIndex((b) => b.type === "paragraph"),
		);
	});

	it("should handle real-world job posting structure", () => {
		document.body.innerHTML = `
      <h1 class="fw-extrabold fs-xl mb-sm">
        <span class="mb-0">Data Engineering Functional Lead</span>
      </h1>
      <div class="company-info">
        <a href="/company/neko-health" target="_blank">
          <picture class="d-inline-block">
            <img src="https://example.com/logo.jpg" alt="Company Logo" height="48" width="48">
          </picture>
        </a>
      </div>
      <h2>About the Role</h2>
      <p>We are looking for an experienced Data Engineering Functional Lead to join our team.</p>
      <h2>Responsibilities</h2>
      <ul>
        <li>Lead the data engineering team and drive technical excellence across projects</li>
        <li>Design and implement scalable data pipelines and infrastructure solutions</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>5+ years of experience in data engineering with proven leadership skills</li>
        <li>Strong knowledge of cloud platforms (AWS, GCP, or Azure) and data tools</li>
      </ul>
    `;

		const blocks = extractTextBlocks();
		const headers = blocks.filter((b) => b.type === "header");
		const paragraphs = blocks.filter((b) => b.type === "paragraph");

		expect(headers.length).toBeGreaterThan(0);
		expect(paragraphs.length).toBeGreaterThan(0);
		expect(headers[0].text).toBe("Data Engineering Functional Lead");
		expect(headers.some((h) => h.text === "About the Role")).toBe(true);
		expect(headers.some((h) => h.text === "Responsibilities")).toBe(true);
	});

	it("should skip content inside script tags", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <p>This is the main job description with enough text to be extracted properly.</p>
      <script>
        const data = "This should not be extracted";
        console.log("Script content");
      </script>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Software Engineer"
        }
      </script>
    `;

		const blocks = extractTextBlocks();

		// Should extract main content
		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);

		// Should NOT extract script content
		expect(
			blocks.some((b) => b.text.includes("This should not be extracted")),
		).toBe(false);
		expect(blocks.some((b) => b.text.includes("Script content"))).toBe(false);
		expect(blocks.some((b) => b.text.includes("JobPosting"))).toBe(false);
	});

	it("should skip content in footer elements", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <p>This is the main job description with enough text to be extracted properly.</p>
      <footer>
        <h2>Footer Header</h2>
        <p>Footer paragraph with enough text that would normally be extracted if not in footer.</p>
        <div>Footer div content with enough text that would normally be extracted if not in footer.</div>
      </footer>
    `;

		const blocks = extractTextBlocks();

		// Should extract main content
		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);

		// Should NOT extract footer content
		expect(blocks.some((b) => b.text === "Footer Header")).toBe(false);
		expect(blocks.some((b) => b.text.includes("Footer paragraph"))).toBe(false);
		expect(blocks.some((b) => b.text.includes("Footer div content"))).toBe(
			false,
		);
	});

	it("should skip content inside form elements", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <p>This is the main job description with enough text to be extracted properly.</p>
      <form>
        <h2>Application Form</h2>
        <label for="name">Full Name</label>
        <input type="text" id="name" name="name" />
        <p>Please fill out all required fields in this application form to proceed.</p>
        <select name="experience">
          <option>Junior</option>
          <option>Senior</option>
        </select>
        <textarea name="cover-letter"></textarea>
        <button type="submit">Submit Application</button>
      </form>
    `;

		const blocks = extractTextBlocks();

		// Should extract main content
		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);

		// Should NOT extract form content
		expect(blocks.some((b) => b.text === "Application Form")).toBe(false);
		expect(blocks.some((b) => b.text === "Full Name")).toBe(false);
		expect(blocks.some((b) => b.text.includes("Please fill out"))).toBe(false);
		expect(blocks.some((b) => b.text === "Junior")).toBe(false);
		expect(blocks.some((b) => b.text === "Senior")).toBe(false);
		expect(blocks.some((b) => b.text === "Submit Application")).toBe(false);
	});

	it("should skip content inside label elements", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <div>
        <label>Email Address</label>
        <label for="phone">Phone Number</label>
      </div>
      <p>This is the main job description with enough text to be extracted properly.</p>
    `;

		const blocks = extractTextBlocks();

		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);
		expect(blocks.some((b) => b.text === "Email Address")).toBe(false);
		expect(blocks.some((b) => b.text === "Phone Number")).toBe(false);
	});

	it("should skip content inside select and option elements", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <div>
        <select name="english-level">
          <option>A0/A1 English (Beginner/Elementary) Level A0/A1 corresponds to basic users of English who can understand and use familiar everyday expressions and very basic phrases.</option>
          <option>B1 English (Intermediate) Level B1 corresponds to users who can understand and produce text on familiar topics and give opinions and descriptions.</option>
          <option>C2 English (Proficient) Level C2 corresponds to proficient users of English, who can understand and express virtually everything with ease and differentiate finer shades of meaning.</option>
        </select>
      </div>
      <p>This is the main job description with enough text to be extracted properly.</p>
    `;

		const blocks = extractTextBlocks();

		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);
		// Should not extract verbose option descriptions
		expect(
			blocks.some((b) => b.text.includes("corresponds to basic users")),
		).toBe(false);
		expect(blocks.some((b) => b.text.includes("Level B1 corresponds"))).toBe(
			false,
		);
		expect(
			blocks.some((b) => b.text.includes("proficient users of English")),
		).toBe(false);
	});

	it("should skip content inside input and textarea elements", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <div>
        <input type="text" value="Some input value" />
        <textarea>Some textarea content</textarea>
      </div>
      <p>This is the main job description with enough text to be extracted properly.</p>
    `;

		const blocks = extractTextBlocks();

		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);
		expect(blocks.some((b) => b.text === "Some input value")).toBe(false);
		expect(blocks.some((b) => b.text === "Some textarea content")).toBe(false);
	});

	it("should skip content inside button elements", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <div>
        <button>Submit Application</button>
        <button type="button">Upload Resume</button>
      </div>
      <p>This is the main job description with enough text to be extracted properly.</p>
    `;

		const blocks = extractTextBlocks();

		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);
		expect(blocks.some((b) => b.text === "Submit Application")).toBe(false);
		expect(blocks.some((b) => b.text === "Upload Resume")).toBe(false);
	});

	it("should filter out file type and size mentions", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <p>This is the main job description with enough text to be extracted properly.</p>
      <div>Accepted files: PDF, DOC, DOCX up to 50MB</div>
      <div>Upload your resume (PNG, JPG, JPEG up to 20MB)</div>
      <div>File formats: PDF or DOCX, maximum 10MB per file</div>
    `;

		const blocks = extractTextBlocks();

		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);
		// Should filter out file type/size text
		expect(
			blocks.some((b) => b.text.includes("PDF, DOC, DOCX up to 50MB")),
		).toBe(false);
		expect(
			blocks.some((b) => b.text.includes("PNG, JPG, JPEG up to 20MB")),
		).toBe(false);
		expect(
			blocks.some((b) => b.text.includes("PDF or DOCX, maximum 10MB")),
		).toBe(false);
	});

	it("should filter out highly repetitive text", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <p>This is the main job description with enough text to be extracted properly.</p>
      <div>Upload a file or drag and drop here Upload a file or drag and drop here Upload a file or drag and drop here Upload a file or drag and drop here</div>
    `;

		const blocks = extractTextBlocks();

		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);
		// Should filter out repetitive upload instructions
		expect(
			blocks.some((b) => b.text.includes("Upload a file or drag and drop")),
		).toBe(false);
	});

	it("should filter out very short text (< 3 chars)", () => {
		document.body.innerHTML = `
      <h1>Job Title</h1>
      <p>This is the main job description with enough text to be extracted properly.</p>
      <div>OK</div>
      <div>No</div>
      <div>*</div>
    `;

		const blocks = extractTextBlocks();

		expect(blocks.some((b) => b.text === "Job Title")).toBe(true);
		expect(blocks.some((b) => b.text.includes("main job description"))).toBe(
			true,
		);
		// Should filter out very short text
		expect(blocks.some((b) => b.text === "OK")).toBe(false);
		expect(blocks.some((b) => b.text === "No")).toBe(false);
		expect(blocks.some((b) => b.text === "*")).toBe(false);
	});

	it("should handle real-world form with job description", () => {
		document.body.innerHTML = `
      <h1>Senior Blockchain Developer</h1>
      <h2>Why Join ZIGChain?</h2>
      <p>At ZIGChain, we're designing the next generation of blockchain infrastructure, leveraging decentralized technologies for enhanced security, scalability and interoperability.</p>
      <h2>Responsibilities</h2>
      <ul>
        <li>Design, develop, and optimize blockchain solutions using Cosmos SDK, Ignite, and IBC.</li>
        <li>Architect scalable and secure solutions that power ZIGChain's ecosystem.</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>10+ years of software development experience, more than 3+ with Go.</li>
        <li>3+ years of hands-on experience with Cosmos SDK, Ignite, and IBC.</li>
      </ul>
      <form>
        <h2>Application Form</h2>
        <p>Fill out the information below</p>
        <label>Upload your CV or resume file</label>
        <div>Upload a file or drag and drop here Upload a file or drag and drop here Accepted files: PDF, DOC, DOCX up to 50MB.</div>
        <label>Do you have an Engineering, Math, or Physics Degree?</label>
        <select>
          <option>Yes</option>
          <option>No</option>
        </select>
        <label>What's your level of English?</label>
        <select>
          <option>A0/A1 English (Beginner/Elementary) Level A0/A1 corresponds to basic users of English who can understand and use familiar everyday expressions and very basic phrases.</option>
          <option>B1 English (Intermediate) Level B1 corresponds to users who can understand and produce text on familiar topics and give opinions and descriptions.</option>
        </select>
        <button>Submit Application</button>
      </form>
    `;

		const blocks = extractTextBlocks();
		const headers = blocks.filter((b) => b.type === "header");
		const paragraphs = blocks.filter((b) => b.type === "paragraph");

		// Should extract job description content
		expect(headers.some((h) => h.text === "Senior Blockchain Developer")).toBe(
			true,
		);
		expect(headers.some((h) => h.text === "Why Join ZIGChain?")).toBe(true);
		expect(headers.some((h) => h.text === "Responsibilities")).toBe(true);
		expect(headers.some((h) => h.text === "Requirements")).toBe(true);
		expect(
			paragraphs.some((p) => p.text.includes("blockchain infrastructure")),
		).toBe(true);
		expect(paragraphs.some((p) => p.text.includes("Cosmos SDK"))).toBe(true);

		// Should NOT extract form content
		expect(headers.some((h) => h.text === "Application Form")).toBe(false);
		expect(
			blocks.some((b) => b.text.includes("Fill out the information")),
		).toBe(false);
		expect(blocks.some((b) => b.text.includes("Upload your CV"))).toBe(false);
		expect(blocks.some((b) => b.text.includes("drag and drop"))).toBe(false);
		expect(blocks.some((b) => b.text.includes("Accepted files"))).toBe(false);
		expect(blocks.some((b) => b.text === "Yes")).toBe(false);
		expect(blocks.some((b) => b.text === "No")).toBe(false);
		expect(
			blocks.some((b) => b.text.includes("corresponds to basic users")),
		).toBe(false);
		expect(blocks.some((b) => b.text === "Submit Application")).toBe(false);
	});

	it("should extract company name and position from builtin.com job card", () => {
		document.body.innerHTML = `
      <div class="row g-sm">
        <div class="col-12 col-lg-5">
          <div class="bg-white rounded-3 p-md position-relative h-100">
            <div class="mb-sm d-inline-flex align-items-center">
              <a href="/company/neko-health" target="_blank">
                <picture class="d-inline-block">
                  <img src="https://cdn.builtin.com/cdn-cgi/image/f=auto,fit=scale-down,w=200,h=200/sites/www.builtin.com/files/2024-11/1674503969551.JPEG" alt="https://cdn.builtin.com/cdn-cgi/image/f=auto,fit=scale-down,w=200,h=200/sites/www.builtin.com/files/2024-11/1674503969551.JPEG Logo" height="48" width="48" class="p-xs rounded-2 border border-gray-02 me-md img-default object-fit-contain">
                </picture>
              </a>
              <a href="/company/neko-health" target="_blank" class="hover-underline text-pretty-blue font-barlow fw-medium fs-2xl">
                <h2 class="text-pretty-blue m-0">Neko Health</h2>
              </a>
            </div>
            <h1 class="fw-extrabold fs-xl mb-sm">
              <span class="mb-0">Data Engineering Functional Lead</span>
            </h1>
            <div class="mb-sm">
              <i class="fa-light text-pretty-blue fa-clock me-sm fs-sm" aria-hidden="true" title="Job Posted 2 Days Ago"></i><span class="sr-only">Job Posted 2 Days Ago</span>
              <span class="font-barlow fs-md fw-regular">Posted 2 Days Ago</span>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-3">
          <div class="d-flex flex-column gap-sm bg-white rounded-3 p-md position-relative h-100">
            <div class="d-flex flex-wrap gap-sm">
              <div class="d-inline-flex bg-pretty-blue-highlight rounded-3 py-xs px-sm">
                <span class="fw-semibold fs-xs">Be an Early Applicant</span>
              </div>
            </div>
            <div>
              <div class="d-flex align-items-start gap-sm">
                <div class="d-flex justify-content-center align-items-center h-lg min-w-md">
                  <i class="fa-regular fa-location-dot fs-xs text-pretty-blue" aria-hidden="true"></i>
                </div>
                <div class="font-barlow text-gray-03 position-relative">
                  <span class="cursor-pointer text-decoration-underline" data-bs-toggle="tooltip" data-bs-placement="bottom" data-html="true" data-bs-original-title="&lt;div class='row g-xs py-sm font-barlow fs-md'&gt;&lt;div class='col-lg-6 px-md'&gt;Greece&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Norway&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Italy&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;UK&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Spain&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Hungary&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Cyprus&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;France&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Poland&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Sweden&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Turkey&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Belgium&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Austria&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Germany&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Denmark&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Estonia&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Finland&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Croatia&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Ukraine&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Bulgaria&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Portugal&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Iceland&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;România&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Luxembourg&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Switzerland&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Netherlands&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Ireland, IRL&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Czech Republic&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;United Kingdom&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Berlin, DEU&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;Stockholm, SWE&lt;/div&gt;&lt;div class='col-lg-6 px-md'&gt;London, Greater London, England, GBR&lt;/div&gt;&lt;/div&gt;">
                    32 Locations
                  </span>
                </div>
              </div>
            </div>
            <div class="d-flex gap-md">
              <div class="d-flex align-items-start gap-sm">
                <div class="d-flex justify-content-center align-items-center h-lg min-w-md">
                  <i class="fa-regular fa-house-building fs-xs text-pretty-blue" aria-hidden="true"></i>
                </div>
                <span class="font-barlow text-gray-03">In-Office or Remote</span>
              </div>
            </div>
            <div class="d-flex align-items-start gap-sm">
              <div class="d-flex justify-content-center align-items-center h-lg min-w-md">
                <i class="fa-regular fa-trophy fs-xs text-pretty-blue" aria-hidden="true"></i>
              </div>
              <span class="font-barlow text-gray-03">Senior level</span>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="bg-white rounded-3 p-md h-100">
            <div class="font-barlow fw-medium mb-md">Healthtech</div>
          </div>
        </div>
      </div>
    `;

		const blocks = extractTextBlocks();
		const headers = blocks.filter((b) => b.type === "header");

		// Verify company name is extracted
		const companyHeader = headers.find((h) => h.text === "Neko Health");
		expect(companyHeader).toBeDefined();
		expect(companyHeader?.element).toBe("h2");

		// Verify position is extracted
		const positionHeader = headers.find(
			(h) => h.text === "Data Engineering Functional Lead",
		);
		expect(positionHeader).toBeDefined();
		expect(positionHeader?.element).toBe("h1");

		// Verify both are present
		expect(headers.some((h) => h.text === "Neko Health")).toBe(true);
		expect(
			headers.some((h) => h.text === "Data Engineering Functional Lead"),
		).toBe(true);
	});
});
