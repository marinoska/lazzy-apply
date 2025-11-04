import mongoose from "mongoose";
import { getEnv } from "./env.js";
import { createLogger } from "./logger.js";

const log = createLogger("Mongo");

export const connected = mongoose.connect(getEnv("MONGO_CONNECTION"), {
	// autoIndex: true,
	tls: true,
	tlsAllowInvalidCertificates: true, // Only for debugging
	serverSelectionTimeoutMS: 5000, // Adjust timeout
});
mongoose.pluralize(null);

export const db = mongoose.connection;

db.once("connected", () => {
	log.info("⚡️ MongoDB connected");
});

db.on("error", (error) => {
	throw error;
});

export const stopMongoClient = async () => {
	await db.close();
	log.info("Mongoose default connection is disconnected");
	process.exit(0);
};
