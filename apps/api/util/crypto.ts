import crypto, { type BinaryLike } from "node:crypto";

export const createHash = (buffer: BinaryLike) =>
  crypto.createHash("sha256").update(buffer).digest("hex");
