import mongoose from "mongoose";
import { getEnv } from "./env.js";
import { createLogger } from "./logger.js";

const log = createLogger("Mongo");

mongoose.pluralize(null);

export const db = mongoose.connection;

db.on("error", (error) => {
	log.error({ error }, "MongoDB connection error");
	throw error;
});

export const connectToMongo = async () => {
	try {
		await mongoose.connect(getEnv("MONGO_CONNECTION"), {
			// autoIndex: true,
			tls: true,
			tlsAllowInvalidCertificates: true, // Only for debugging
			serverSelectionTimeoutMS: 5000, // Adjust timeout
		});
		log.info("⚡️ MongoDB connected");
	} catch (error) {
		log.error({ error }, "Failed to connect to MongoDB");
		throw error;
	}
};

export const stopMongoClient = async () => {
	await db.close();
	log.info("Mongoose default connection is disconnected");
	process.exit(0);
};
