import type { Query, Schema } from "mongoose";

interface QueryWithOp extends Query<unknown, unknown> {
  op?: string;
}

function enforceOwnership(this: QueryWithOp) {
  const options = this.getOptions();
  
  // Allow bypassing ownership enforcement for system-level operations
  if (options.skipOwnershipEnforcement) {
    return;
  }
  
  const userId = options.userId;
  if (userId) {
    this.where({ userId });
  } else {
    const modelName = this.model.modelName;
    const operation = this.op;
    throw new Error(`User ID is missing on ${modelName}.${operation}`);
  }
}

const methodsToEnforce = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndRemove",
  "findOneAndReplace",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
  "replaceOne",
] as const;

// biome-ignore lint/suspicious/noExplicitAny: Mongoose Schema requires generic parameters, using any for flexibility
export function applyOwnershipEnforcement(schema: Schema<any, any, any, any>) {
  for (const method of methodsToEnforce) {
    schema.pre(method as Parameters<Schema["pre"]>[0], enforceOwnership);
  }
}
