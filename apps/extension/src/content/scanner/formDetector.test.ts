import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectApplicationForm } from "./formDetector.js";

describe("formDetector", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("detectApplicationForm", () => {
    it("should detect a basic application form with standard fields", () => {
      container.innerHTML = `
        <form id="application-form" action="/apply" method="POST">
          <label for="firstName">First Name</label>
          <input type="text" id="firstName" name="firstName" required />
          
          <label for="lastName">Last Name</label>
          <input type="text" id="lastName" name="lastName" required />
          
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required />
          
          <label for="phone">Phone</label>
          <input type="tel" id="phone" name="phone" />
          
          <button type="submit">Apply Now</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      expect(result?.formDetected).toBe(true);
      expect(result?.totalFields).toBe(4);
      expect(result?.formElement).toEqual({
        id: "application-form",
        name: null,
        action: expect.stringContaining("/apply"),
        method: "post",
      });

      const emailField = result?.fields.find(f => f.name === "email");
      expect(emailField).toMatchObject({
        tag: "input",
        type: "email",
        id: "email",
        name: "email",
        label: "Email",
        isFileUpload: false,
      });
    });

    it("should detect file upload fields with accept attribute", () => {
      container.innerHTML = `
        <form>
          <label for="resume">Resume/CV</label>
          <input type="file" id="resume" name="resume" accept=".pdf,.doc,.docx" required />
          
          <label for="coverLetter">Cover Letter</label>
          <input type="file" id="coverLetter" name="coverLetter" accept=".pdf" />
          
          <button type="submit">Submit Application</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      expect(result?.totalFields).toBe(2);

      const resumeField = result?.fields.find(f => f.name === "resume");
      expect(resumeField).toMatchObject({
        tag: "input",
        type: "file",
        id: "resume",
        name: "resume",
        label: "Resume/CV",
        isFileUpload: true,
        accept: ".pdf,.doc,.docx",
      });

      const coverLetterField = result?.fields.find(f => f.name === "coverLetter");
      expect(coverLetterField).toMatchObject({
        isFileUpload: true,
        accept: ".pdf",
      });
    });

    it("should not extract select inputs", () => {
      container.innerHTML = `
        <form>
          <label for="name">Name</label>
          <input type="text" id="name" name="name" />
          
          <label for="experience">Years of Experience</label>
          <select id="experience" name="experience" required>
            <option value="">Select...</option>
            <option value="0-2">0-2 years</option>
          </select>
          
          <button type="submit">Apply</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      // Select should not be extracted
      const experienceField = result?.fields.find(f => f.name === "experience");
      expect(experienceField).toBeUndefined();
      // But input should be
      expect(result?.fields.find(f => f.name === "name")).toBeDefined();
    });

    it("should extract textarea fields", () => {
      container.innerHTML = `
        <form>
          <label for="bio">Tell us about yourself</label>
          <textarea id="bio" name="bio" placeholder="Your background..." required></textarea>
          
          <button type="submit">Apply</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      const bioField = result?.fields.find(f => f.name === "bio");
      
      expect(bioField).toMatchObject({
        tag: "textarea",
        type: "textarea",
        id: "bio",
        name: "bio",
        label: "Tell us about yourself",
        placeholder: "Your background...",
        isFileUpload: false,
      });
    });

    it("should extract aria labels and descriptions", () => {
      container.innerHTML = `
        <form>
          <label for="linkedin">LinkedIn Profile</label>
          <input 
            type="url" 
            id="linkedin" 
            name="linkedin" 
            aria-label="LinkedIn profile URL"
            aria-describedby="linkedin-help"
          />
          <span id="linkedin-help">Enter your full LinkedIn profile URL</span>
          
          <button type="submit">Apply</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      const linkedinField = result?.fields.find(f => f.name === "linkedin");
      
      expect(linkedinField).toMatchObject({
        id: "linkedin",
        name: "linkedin",
        label: "LinkedIn Profile",
        description: "Enter your full LinkedIn profile URL",
      });
    });

    it("should detect form without form tag (React-style)", () => {
      container.innerHTML = `
        <div class="application-container">
          <input type="text" id="firstName" name="firstName" placeholder="First Name" />
          <input type="text" id="lastName" name="lastName" placeholder="Last Name" />
          <input type="email" id="email" name="email" placeholder="Email" />
          <input type="file" id="resume" name="resume" />
          <button>Apply Now</button>
        </div>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      expect(result?.formDetected).toBe(true);
      expect(result?.totalFields).toBe(4);
      expect(result?.formElement).toBeUndefined();
    });

    it("should handle labels wrapping inputs", () => {
      container.innerHTML = `
        <form>
          <label>
            First Name
            <input type="text" id="firstName" name="firstName" />
          </label>
          
          <label>
            Email Address
            <input type="email" id="email" name="email" required />
          </label>
          
          <button type="submit">Submit</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      const firstNameField = result?.fields.find(f => f.name === "firstName");
      const emailField = result?.fields.find(f => f.name === "email");
      
      expect(firstNameField?.label).toContain("First Name");
      expect(emailField?.label).toContain("Email Address");
    });

    it("should return null when no form is present", () => {
      container.innerHTML = `
        <div>
          <p>Just some text content</p>
          <input type="text" name="search" />
        </div>
      `;

      const result = detectApplicationForm();

      expect(result).toBeNull();
    });

    it("should prioritize form with file upload when multiple forms exist", () => {
      container.innerHTML = `
        <form id="newsletter">
          <input type="email" id="newsletter-email" name="email" />
          <button>Subscribe</button>
        </form>
        
        <form id="application">
          <input type="text" id="name" name="name" />
          <input type="email" id="email" name="email" />
          <input type="file" id="resume" name="resume" />
          <button>Apply</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      expect(result?.formElement?.id).toBe("application");
      expect(result?.fields.some(f => f.isFileUpload)).toBe(true);
    });

    it("should handle fields with no labels", () => {
      container.innerHTML = `
        <form>
          <input type="text" id="unlabeled" name="unlabeled" placeholder="Enter text" />
          <input type="email" id="email" name="email" />
          <button>Submit</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      const unlabeledField = result?.fields.find(f => f.name === "unlabeled");
      
      expect(unlabeledField?.label).toBeNull();
      expect(unlabeledField?.placeholder).toBe("Enter text");
    });

    it("should detect common application keywords in labels", () => {
      container.innerHTML = `
        <div>
          <label>Resume</label>
          <input type="file" name="resume" />
          
          <label>Phone Number</label>
          <input type="tel" name="phone" />
          
          <label>Salary Expectations</label>
          <input type="text" name="salary" />
          
          <button>Apply for Position</button>
        </div>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      expect(result?.formDetected).toBe(true);
    });

    it("should handle complex nested form structure", () => {
      container.innerHTML = `
        <form>
          <div class="section">
            <h3>Personal Information</h3>
            <div class="field-group">
              <label for="name">Full Name</label>
              <input type="text" id="name" name="name" required />
            </div>
            <div class="field-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required />
            </div>
          </div>
          
          <div class="section">
            <h3>Documents</h3>
            <div class="field-group">
              <label for="cv">CV/Resume</label>
              <input type="file" id="cv" name="cv" accept=".pdf" required />
            </div>
          </div>
          
          <button type="submit">Submit Application</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      expect(result?.totalFields).toBe(3);
      
      const cvField = result?.fields.find(f => f.name === "cv");
      expect(cvField).toMatchObject({
        type: "file",
        label: "CV/Resume",
        isFileUpload: true,
        accept: ".pdf",
      });
    });

    it("should detect real-life Recruitee application form with all sections", () => {
      container.innerHTML = `
        <form id="offer-application-form" autocomplete="on" novalidate="" class="sc-1mqz0cx-5 bRCACm">
          <!-- Personal Information Section -->
          <section class="sc-1mqz0cx-0 crqiBE">
            <fieldset class="sc-1mqz0cx-1 iFKxRS">
              <legend class="sc-1glzqyg-0 gxsobq">My information</legend>
              <p class="sc-1npqnwg-9 sc-1mqz0cx-2 fcSWHa">Fill out the information below</p>
              
              <!-- Full Name -->
              <div class="sc-1mqz0cx-3 cOGVLM">
                <div>
                  <label for="input-candidate.name-5" class="sc-1glzqyg-0 jrDZFl">
                    Full name
                    <span aria-hidden="true">&nbsp;<span title="This field is required and can not be left empty." class="sc-1glzqyg-1 gIAVEJ">*</span></span>
                  </label>
                  <input 
                    type="text" 
                    id="input-candidate.name-5" 
                    aria-invalid="false" 
                    required="" 
                    maxlength="255" 
                    aria-describedby="input-candidate.name-5-error" 
                    placeholder="Full name" 
                    autocomplete="name" 
                    name="candidate.name" 
                    class="sc-15kbb6z-0 PCmSD"
                  />
                  <div role="alert" id="input-candidate.name-5-error" class="sc-8ux9um-1 gSAZEO"></div>
                </div>
              </div>
              
              <!-- Email -->
              <div class="sc-1mqz0cx-3 cOGVLM">
                <div>
                  <label for="input-candidate.email-6" class="sc-1glzqyg-0 jrDZFl">
                    Email address
                    <span aria-hidden="true">&nbsp;<span title="This field is required and can not be left empty." class="sc-1glzqyg-1 gIAVEJ">*</span></span>
                  </label>
                  <input 
                    type="email" 
                    id="input-candidate.email-6" 
                    aria-invalid="false" 
                    required="" 
                    maxlength="255" 
                    aria-describedby="input-candidate.email-6-error" 
                    placeholder="Your email address" 
                    autocomplete="email" 
                    name="candidate.email" 
                    class="sc-15kbb6z-0 PCmSD"
                  />
                  <div role="alert" id="input-candidate.email-6-error" class="sc-8ux9um-1 gSAZEO"></div>
                </div>
              </div>
              
              <!-- Phone -->
              <div class="sc-1mqz0cx-3 cOGVLM">
                <label for="input-candidate.phone-7" class="sc-1glzqyg-0 jrDZFl">Phone number</label>
                <input 
                  type="tel" 
                  aria-invalid="false" 
                  aria-describedby="input-candidate.phone-7-error" 
                  autocomplete="tel" 
                  name="candidate.phone" 
                  placeholder="Your phone number" 
                  id="input-candidate.phone-7" 
                  class="sc-15kbb6z-0 sc-1hkfaog-0 DIHLu PhoneInputInput" 
                  value="+49"
                />
                <div role="alert" id="input-candidate.phone-7-error" class="sc-8ux9um-1 gSAZEO"></div>
              </div>
            </fieldset>
          </section>
          
          <!-- CV Upload Section -->
          <section class="sc-1mqz0cx-0 crqiBE">
            <label for="input-candidate.cv-11" class="sc-1glzqyg-0 gxsobq">CV or resume</label>
            <p id="input-cv-description-12" class="sc-1npqnwg-9 sc-1mqz0cx-2 fcSWHa">Upload your CV or resume file</p>
            <div class="sc-1mqz0cx-3 cOGVLM">
              <div>
                <div tabindex="-1" role="presentation" class="sc-5buvxd-0 dMohfR">
                  <input 
                    type="file" 
                    autocomplete="off" 
                    tabindex="0" 
                    accept="application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/pdf, application/vnd.oasis.opendocument.text, application/rtf, text/plain, image/png, image/jpeg" 
                    name="candidate.cv" 
                    id="input-candidate.cv-11" 
                    aria-describedby="input-candidate.cv-11-error input-candidate.cv-9 input-cv-description-12" 
                    aria-labelledby="input-candidate.cv-10" 
                    aria-invalid="false" 
                    data-cy="fileInputField"
                  />
                  <div id="input-candidate.cv-9" class="sc-1m8d63o-1 cBPVEv">
                    <span style="border:0;clip:rect(0 0 0 0);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap;word-wrap:normal">Upload a file or drag and drop here</span>
                    Accepted files: PDF, DOC, DOCX, JPEG and PNG up to 50MB.
                  </div>
                </div>
                <div role="alert" id="input-candidate.cv-11-error" class="sc-8ux9um-1 gSAZEO"></div>
              </div>
            </div>
          </section>
          
          <!-- Cover Letter Section -->
          <section class="sc-1mqz0cx-0 crqiBE">
            <label for="input-candidate.coverLetterFile-17" class="sc-1glzqyg-0 gxsobq">Cover letter</label>
            <p id="input-cover-letter-description-16" class="sc-1npqnwg-9 sc-1mqz0cx-2 fcSWHa">Upload your cover letter</p>
            <div>
              <div tabindex="-1" role="presentation" class="sc-5buvxd-0 dMohfR">
                <input 
                  type="file" 
                  autocomplete="off" 
                  tabindex="0" 
                  accept="application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/pdf, application/vnd.oasis.opendocument.text, application/rtf, text/plain, image/png, image/jpeg" 
                  name="candidate.coverLetterFile" 
                  id="input-candidate.coverLetterFile-17" 
                  aria-describedby="input-candidate.coverLetterFile-17-error input-candidate.coverLetterFile-14 input-cover-letter-description-16" 
                  aria-labelledby="input-candidate.coverLetterFile-15" 
                  aria-invalid="false" 
                  data-cy="candidate.coverLetterFile"
                />
              </div>
              <div role="alert" id="input-candidate.coverLetterFile-17-error" class="sc-8ux9um-1 gSAZEO"></div>
            </div>
          </section>
          
          <!-- Questions Section -->
          <section data-testid="segment-open-questions" class="sc-1mqz0cx-0 crqiBE">
            <fieldset class="sc-1mqz0cx-1 iFKxRS">
              <legend class="sc-1glzqyg-0 gxsobq">Questions</legend>
              <p class="sc-1npqnwg-9 sc-1mqz0cx-2 fcSWHa">Please fill in additional questions</p>
              
              <div class="sc-1mqz0cx-6 lVfaV">
                <!-- Question 1: Availability -->
                <div>
                  <input type="hidden" value="2593511" name="candidate.openQuestionAnswers.2593511.openQuestionId" />
                  <div>
                    <label for="input-candidate.openQuestionAnswers.2593511.content-18" class="sc-1glzqyg-0 jrDZFl">
                      Please tell us your earliest possible date of availability.
                      <span aria-hidden="true">&nbsp;<span title="This field is required and can not be left empty." class="sc-1glzqyg-1 gIAVEJ">*</span></span>
                    </label>
                    <input 
                      type="text" 
                      id="input-candidate.openQuestionAnswers.2593511.content-18" 
                      aria-invalid="false" 
                      required="" 
                      maxlength="255" 
                      aria-describedby="input-candidate.openQuestionAnswers.2593511.content-18-error" 
                      autocomplete="on" 
                      name="candidate.openQuestionAnswers.2593511.content" 
                      class="sc-15kbb6z-0 PCmSD"
                    />
                  </div>
                </div>
                
                <!-- Question 2: Salary -->
                <div>
                  <input type="hidden" value="2593512" name="candidate.openQuestionAnswers.2593512.openQuestionId" />
                  <div>
                    <label for="input-candidate.openQuestionAnswers.2593512.content-19" class="sc-1glzqyg-0 jrDZFl">
                      Please let us know your salary expectations (in €).
                    </label>
                    <input 
                      type="text" 
                      id="input-candidate.openQuestionAnswers.2593512.content-19" 
                      aria-invalid="false" 
                      maxlength="255" 
                      aria-describedby="input-candidate.openQuestionAnswers.2593512.content-19-error" 
                      autocomplete="on" 
                      name="candidate.openQuestionAnswers.2593512.content" 
                      class="sc-15kbb6z-0 PCmSD"
                    />
                  </div>
                </div>
                
                <!-- Question 3: Remote/Relocate -->
                <div>
                  <input type="hidden" value="2593513" name="candidate.openQuestionAnswers.2593513.openQuestionId" />
                  <div>
                    <label for="input-candidate.openQuestionAnswers.2593513.content-20" class="sc-1glzqyg-0 jrDZFl">
                      Are you interested to relocate or remote work only?
                    </label>
                    <input 
                      type="text" 
                      id="input-candidate.openQuestionAnswers.2593513.content-20" 
                      aria-invalid="false" 
                      maxlength="255" 
                      aria-describedby="input-candidate.openQuestionAnswers.2593513.content-20-error" 
                      autocomplete="on" 
                      name="candidate.openQuestionAnswers.2593513.content" 
                      class="sc-15kbb6z-0 PCmSD"
                    />
                  </div>
                </div>
                
                <!-- Question 4: Source -->
                <div>
                  <input type="hidden" value="2593514" name="candidate.openQuestionAnswers.2593514.openQuestionId" />
                  <div>
                    <label for="input-candidate.openQuestionAnswers.2593514.content-21" class="sc-1glzqyg-0 jrDZFl">
                      Where did you find us?
                    </label>
                    <input 
                      type="text" 
                      id="input-candidate.openQuestionAnswers.2593514.content-21" 
                      aria-invalid="false" 
                      maxlength="255" 
                      aria-describedby="input-candidate.openQuestionAnswers.2593514.content-21-error" 
                      autocomplete="on" 
                      name="candidate.openQuestionAnswers.2593514.content" 
                      class="sc-15kbb6z-0 PCmSD"
                    />
                  </div>
                </div>
                
                <!-- Question 5: Why epilot (textarea) -->
                <div>
                  <input type="hidden" value="3352052" name="candidate.openQuestionAnswers.3352052.openQuestionId" />
                  <div>
                    <label for="input-candidate.openQuestionAnswers.3352052.content-22" class="sc-1glzqyg-0 jrDZFl">
                      Why do you want to start at epilot?
                      <span aria-hidden="true">&nbsp;<span title="This field is required and can not be left empty." class="sc-1glzqyg-1 gIAVEJ">*</span></span>
                    </label>
                    <textarea 
                      data-cy="textAreaInputField" 
                      required="" 
                      id="input-candidate.openQuestionAnswers.3352052.content-22" 
                      rows="6" 
                      aria-invalid="false" 
                      aria-describedby="input-candidate.openQuestionAnswers.3352052.content-22-error " 
                      autocomplete="on" 
                      name="candidate.openQuestionAnswers.3352052.content" 
                      class="sc-1bxfyf3-0 eIewEB"
                    ></textarea>
                  </div>
                </div>
                
                <!-- Question 6: Achievement (textarea) -->
                <div>
                  <input type="hidden" value="3352053" name="candidate.openQuestionAnswers.3352053.openQuestionId" />
                  <div>
                    <label for="input-candidate.openQuestionAnswers.3352053.content-23" class="sc-1glzqyg-0 jrDZFl">
                      What achievement in your career are you particularly proud of? Why?
                      <span aria-hidden="true">&nbsp;<span title="This field is required and can not be left empty." class="sc-1glzqyg-1 gIAVEJ">*</span></span>
                    </label>
                    <textarea 
                      data-cy="textAreaInputField" 
                      required="" 
                      id="input-candidate.openQuestionAnswers.3352053.content-23" 
                      rows="6" 
                      aria-invalid="false" 
                      aria-describedby="input-candidate.openQuestionAnswers.3352053.content-23-error " 
                      autocomplete="on" 
                      name="candidate.openQuestionAnswers.3352053.content" 
                      class="sc-1bxfyf3-0 eIewEB"
                    ></textarea>
                  </div>
                </div>
                
                <!-- Question 7: Engineering principles (textarea) -->
                <div>
                  <input type="hidden" value="4536168" name="candidate.openQuestionAnswers.4536168.openQuestionId" />
                  <div>
                    <label for="input-candidate.openQuestionAnswers.4536168.content-24" class="sc-1glzqyg-0 jrDZFl">
                      Which of our engineering principles appeals to you the most and why?
                      <span aria-hidden="true">&nbsp;<span title="This field is required and can not be left empty." class="sc-1glzqyg-1 gIAVEJ">*</span></span>
                    </label>
                    <textarea 
                      data-cy="textAreaInputField" 
                      required="" 
                      id="input-candidate.openQuestionAnswers.4536168.content-24" 
                      rows="6" 
                      aria-invalid="false" 
                      aria-describedby="input-candidate.openQuestionAnswers.4536168.content-24-error " 
                      autocomplete="on" 
                      name="candidate.openQuestionAnswers.4536168.content" 
                      class="sc-1bxfyf3-0 eIewEB"
                    ></textarea>
                  </div>
                </div>
              </div>
            </fieldset>
          </section>
          
          <!-- Legal Agreements Section -->
          <section data-cy="segment-legal-agreements" data-testid="segment-legal-agreements" class="sc-1mqz0cx-0 crqiBE">
            <fieldset class="sc-1mqz0cx-1 iFKxRS">
              <legend style="margin-bottom:24px" class="sc-1glzqyg-0 gxsobq">Legal Agreements</legend>
              <div class="sc-1mqz0cx-7 hpUHVc">
                <div class="sc-17ac6n8-1 iHSVwy">
                  <input type="hidden" value="176" name="candidate.agreements.0.agreementId" />
                  <input 
                    type="checkbox" 
                    required="" 
                    aria-invalid="false" 
                    value="false" 
                    aria-labelledby="input-candidate.agreements.0.consent-25-0" 
                    name="candidate.agreements.0.consent" 
                    class="sc-17ac6n8-0 sODwz"
                  />
                  <div id="input-candidate.agreements.0.consent-25-0" class="sc-17ac6n8-2 byHflx">
                    <div>
                      <div data-gramm="false" data-cy="WYSIWYG-text-edit" data-testid="WYSIWYG-text-edit" class="sc-1tu8yb8-1 cKZGOF">
                        <p>I consent to my data being transmitted to the career tool used by epilot and used to contact me again in the event of subsequent job offers.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </fieldset>
          </section>
          
          <button aria-live="polite" aria-busy="false" type="submit" data-testid="submit-application-form-button" class="sc-s03za1-0 bDZlbp sc-csisgn-0 cWtVVQ">Send</button>
        </form>
      `;

      const result = detectApplicationForm();

      expect(result).not.toBeNull();
      expect(result?.formDetected).toBe(true);
      expect(result?.formElement?.id).toBe("offer-application-form");
      
      // Should detect all visible input fields with ids (excluding hidden inputs, selects, and checkbox without id)
      // 3 personal info + 2 file uploads + 7 questions (4 text + 3 textarea) = 12 visible fields with ids
      expect(result?.fields.length).toBeGreaterThanOrEqual(12);

      // Test personal information fields
      const nameField = result?.fields.find(f => f.name === "candidate.name");
      expect(nameField).toMatchObject({
        tag: "input",
        type: "text",
        id: "input-candidate.name-5",
        name: "candidate.name",
        label: expect.stringContaining("Full name"),
        placeholder: "Full name",
        isFileUpload: false,
      });

      const emailField = result?.fields.find(f => f.name === "candidate.email");
      expect(emailField).toMatchObject({
        tag: "input",
        type: "email",
        id: "input-candidate.email-6",
        name: "candidate.email",
        label: expect.stringContaining("Email address"),
        placeholder: "Your email address",
        isFileUpload: false,
      });

      const phoneField = result?.fields.find(f => f.name === "candidate.phone");
      expect(phoneField).toMatchObject({
        tag: "input",
        type: "tel",
        id: "input-candidate.phone-7",
        name: "candidate.phone",
        label: "Phone number",
        placeholder: "Your phone number",
        isFileUpload: false,
      });

      // Test file upload fields
      const cvField = result?.fields.find(f => f.name === "candidate.cv");
      expect(cvField).toMatchObject({
        tag: "input",
        type: "file",
        id: "input-candidate.cv-11",
        name: "candidate.cv",
        label: "CV or resume",
        isFileUpload: true,
        accept: expect.stringContaining("application/pdf"),
      });

      const coverLetterField = result?.fields.find(f => f.name === "candidate.coverLetterFile");
      expect(coverLetterField).toMatchObject({
        tag: "input",
        type: "file",
        id: "input-candidate.coverLetterFile-17",
        name: "candidate.coverLetterFile",
        label: "Cover letter",
        isFileUpload: true,
        accept: expect.stringContaining("application/pdf"),
      });

      // Test custom question fields
      const availabilityField = result?.fields.find(f => 
        f.name === "candidate.openQuestionAnswers.2593511.content"
      );
      expect(availabilityField).toMatchObject({
        tag: "input",
        type: "text",
        label: expect.stringContaining("earliest possible date of availability"),
        isFileUpload: false,
      });

      const salaryField = result?.fields.find(f => 
        f.name === "candidate.openQuestionAnswers.2593512.content"
      );
      expect(salaryField).toMatchObject({
        tag: "input",
        type: "text",
        label: expect.stringContaining("salary expectations"),
        isFileUpload: false,
      });

      // Test textarea fields
      const whyEpilotField = result?.fields.find(f => 
        f.name === "candidate.openQuestionAnswers.3352052.content"
      );
      expect(whyEpilotField).toMatchObject({
        tag: "textarea",
        type: "textarea",
        label: expect.stringContaining("Why do you want to start at epilot"),
        isFileUpload: false,
      });

      const achievementField = result?.fields.find(f => 
        f.name === "candidate.openQuestionAnswers.3352053.content"
      );
      expect(achievementField).toMatchObject({
        tag: "textarea",
        type: "textarea",
        label: expect.stringContaining("achievement in your career"),
        isFileUpload: false,
      });

      const principlesField = result?.fields.find(f => 
        f.name === "candidate.openQuestionAnswers.4536168.content"
      );
      expect(principlesField).toMatchObject({
        tag: "textarea",
        type: "textarea",
        label: expect.stringContaining("engineering principles"),
        isFileUpload: false,
      });

      // Verify file upload detection worked
      const fileUploadFields = result?.fields.filter(f => f.isFileUpload);
      expect(fileUploadFields?.length).toBe(2);
    });

    describe("hash generation", () => {
      it("should generate hash for each field with domain prefix", () => {
        container.innerHTML = `
          <form>
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required />
            <button type="submit">Submit</button>
          </form>
        `;

        const result = detectApplicationForm();

        expect(result).not.toBeNull();
        const emailField = result?.fields.find(f => f.name === "email");
        
        // Hash should be in format "[SLD].[TLD]:hash:[hashValue]"
        expect(emailField?.hash).toMatch(/^[a-z0-9.-]+:hash:.+$/);
        // In test environment, hostname is "localhost"
        expect(emailField?.hash).toMatch(/^localhost:hash:.+$/);
      });

      it("should generate formHash from all field hashes", () => {
        container.innerHTML = `
          <form>
            <label for="firstName">First Name</label>
            <input type="text" id="firstName" name="firstName" />
            
            <label for="email">Email</label>
            <input type="email" id="email" name="email" />
            
            <button type="submit">Submit</button>
          </form>
        `;

        const result = detectApplicationForm();

        expect(result).not.toBeNull();
        // formHash should be in format "[SLD].[TLD]:hash:[hashValue]"
        expect(result?.formHash).toMatch(/^localhost:hash:.+$/);
      });

      it("should generate consistent hashes for identical fields", () => {
        container.innerHTML = `
          <form>
            <label for="email">Email</label>
            <input type="email" id="email" name="email" placeholder="Enter email" />
            <button type="submit">Submit</button>
          </form>
        `;

        const result1 = detectApplicationForm();
        
        // Re-detect the same form
        const result2 = detectApplicationForm();

        expect(result1?.fields[0].hash).toBe(result2?.fields[0].hash);
        expect(result1?.formHash).toBe(result2?.formHash);
      });

      it("should generate different hashes for different fields", () => {
        container.innerHTML = `
          <form>
            <label for="email">Email</label>
            <input type="email" id="email" name="email" />
            
            <label for="phone">Phone</label>
            <input type="tel" id="phone" name="phone" />
            
            <button type="submit">Submit</button>
          </form>
        `;

        const result = detectApplicationForm();

        expect(result).not.toBeNull();
        const emailField = result?.fields.find(f => f.name === "email");
        const phoneField = result?.fields.find(f => f.name === "phone");
        
        expect(emailField?.hash).not.toBe(phoneField?.hash);
      });
    });
  });
});
