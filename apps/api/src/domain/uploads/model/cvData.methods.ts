import type { Schema } from "mongoose";

import type { CVDataMethods, TCVData } from "./cvData.types.js";
import type { CVDataModel } from "./cvData.model.js";

export function registerCVDataMethods(
	schema: Schema<TCVData, CVDataModel, CVDataMethods>,
): void {
	// Add custom instance methods here if needed
	// Example:
	// schema.methods.someMethod = async function() {
	//   return this;
	// };
}
