export type AllowedFileType = "docx" | "pdf";
export const ALLOWED_FILE_TYPES: AllowedFileType[] = ["docx", "pdf"];

export const validateFileContent = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;

      if (file.type === "application/pdf") {
        // Basic PDF Validation: Check for "%PDF" marker
        const isPDF = (content as string).includes("%PDF-");
        resolve(isPDF);
      } else if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        // DOCX Validation: Ensure it is a valid ZIP archive
        const isDOCX = (content as ArrayBuffer)?.byteLength > 0;
        resolve(isDOCX);
      } else {
        resolve(false); // Unrecognized type = invalid
      }
    };

    // Read file as ArrayBuffer to check binary contents
    if (file.type === "application/pdf" || file.type === "application/msword") {
      reader.readAsText(file); // Read text content for PDFs or DOC
    } else {
      reader.readAsArrayBuffer(file); // Binary content for DOCX
    }
  });
};
