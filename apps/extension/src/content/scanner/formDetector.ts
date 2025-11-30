export interface FormField {
  tag: string;
  type: string;
  id: string | null;
  name: string | null;
  label: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  ariaDescribedBy: string | null;
  description: string | null;
  required: boolean;
  isFileUpload: boolean;
  accept?: string | null;
  options?: Array<{ label: string; value: string }>;
}

export interface ApplicationForm {
  formDetected: boolean;
  totalFields: number;
  fields: FormField[];
  formElement?: {
    id: string | null;
    name: string | null;
    action: string | null;
    method: string | null;
  };
}

/**
 * Detects job application forms on the page and extracts all field information.
 * Handles both traditional <form> elements and React-driven forms without form tags.
 */
export function detectApplicationForm(): ApplicationForm | null {
  // First try <form> tags
  let forms = Array.from(document.querySelectorAll("form"));

  // Filter forms to find the most likely application form
  if (forms.length > 1) {
    forms = forms.filter(form => isLikelyApplicationForm(form));
  }

  // If no form tags exist, detect container as fallback
  let formContainer: Element | null = null;
  if (forms.length === 0) {
    const containers = Array.from(document.querySelectorAll("div, section"))
      .filter(el => {
        const inputs = el.querySelectorAll("input, textarea, select");
        return inputs.length >= 3 && isLikelyApplicationForm(el);
      });

    if (containers.length > 0) {
      formContainer = containers[0];
    }
  }

  // Determine the element to scan (either a form or container)
  const scanElement = forms.length > 0
    ? (forms.length === 1 
        ? forms[0] 
        : forms.reduce((largest, current) => {
            const largestCount = largest.querySelectorAll("input, textarea, select").length;
            const currentCount = current.querySelectorAll("input, textarea, select").length;
            return currentCount > largestCount ? current : largest;
          }))
    : formContainer;

  if (!scanElement) return null;

  const fields: FormField[] = [];
  const inputs = scanElement.querySelectorAll("input, textarea, select");

  inputs.forEach(el => {
    const field = extractFieldInfo(el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, scanElement);
    fields.push(field);
  });

  const formElement = scanElement.tagName === "FORM" ? {
    id: scanElement.id || null,
    name: (scanElement as HTMLFormElement).name || null,
    action: (scanElement as HTMLFormElement).action || null,
    method: (scanElement as HTMLFormElement).method || null,
  } : undefined;

  return {
    formDetected: true,
    totalFields: fields.length,
    fields,
    formElement,
  };
}

/**
 * Determines if an element is likely an application form based on high-confidence signals.
 */
function isLikelyApplicationForm(element: Element): boolean {
  // Check for file upload inputs
  if (element.querySelector('input[type="file"]')) {
    return true;
  }

  // Check for common application form labels
  const labels = Array.from(element.querySelectorAll("label")).map(l => 
    l.textContent?.toLowerCase() || ""
  );
  
  const applicationKeywords = [
    "resume", "cv", "cover letter",
    "first name", "last name", "email", "phone",
    "linkedin", "github", "portfolio",
    "salary", "visa", "sponsorship"
  ];

  if (labels.some(label => 
    applicationKeywords.some(keyword => label.includes(keyword))
  )) {
    return true;
  }

  // Check for submit buttons with application-related text
  const buttons = Array.from(element.querySelectorAll("button, input[type='submit']"));
  const buttonTexts = buttons.map(b => b.textContent?.toLowerCase() || "");
  
  const submitKeywords = ["apply", "submit application", "continue", "next"];
  if (buttonTexts.some(text => 
    submitKeywords.some(keyword => text.includes(keyword))
  )) {
    return true;
  }

  // Check for common field names
  const inputs = element.querySelectorAll("input, textarea, select");
  const fieldNames = Array.from(inputs).map(input => 
    (input.getAttribute("name") || "").toLowerCase()
  );

  const commonFieldNames = [
    "email", "phone", "firstname", "lastname",
    "resume", "cv", "coverletter"
  ];

  const matchCount = fieldNames.filter(name => 
    commonFieldNames.some(common => name.includes(common))
  ).length;

  return matchCount >= 2;
}

/**
 * Extracts comprehensive information about a form field.
 */
function extractFieldInfo(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  form: Element
): FormField {
  const field: Partial<FormField> = {};

  field.tag = el.tagName.toLowerCase();
  field.type = el.getAttribute("type") || (el.tagName === "TEXTAREA" ? "textarea" : "text");

  field.id = el.id || null;
  field.name = el.name || null;
  field.placeholder = (el as HTMLInputElement).placeholder || null;
  field.required = el.required || false;

  // Find label
  let label: string | null = null;

  if (el.id) {
    const lbl = form.querySelector(`label[for="${el.id}"]`);
    if (lbl) label = lbl.textContent?.trim() || null;
  }
  if (!label && el.closest("label")) {
    const closestLabel = el.closest("label");
    if (closestLabel) {
      // Get label text without the input's value
      label = Array.from(closestLabel.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim())
        .filter(Boolean)
        .join(" ") || closestLabel.textContent?.trim() || null;
    }
  }

  field.label = label;

  // ARIA labels
  field.ariaLabel = el.getAttribute("aria-label");
  field.ariaDescribedBy = el.getAttribute("aria-describedby");

  // Description text
  let description: string | null = null;
  const describedIds = (field.ariaDescribedBy || "").split(" ").filter(x => x);
  if (describedIds.length > 0) {
    description = describedIds
      .map(id => {
        const descEl = document.getElementById(id);
        return descEl ? descEl.textContent?.trim() : null;
      })
      .filter(Boolean)
      .join(" ") || null;
  }
  field.description = description;

  // Select options
  if (el.tagName === "SELECT") {
    field.options = Array.from((el as HTMLSelectElement).querySelectorAll("option")).map(opt => ({
      label: opt.textContent?.trim() || "",
      value: opt.value
    }));
  }

  // Detect file uploads
  if (field.type === "file") {
    field.isFileUpload = true;
    field.accept = el.getAttribute("accept") || null;
  } else {
    field.isFileUpload = false;
  }

  return field as FormField;
}
