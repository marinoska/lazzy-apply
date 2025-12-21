import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";

// Environment variables are set in vitest.config.ts to ensure they're available
// before any modules (like env.ts) are loaded

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
	mongoServer = await MongoMemoryReplSet.create({
		replSet: { count: 1, storageEngine: "wiredTiger" },
		instanceOpts: [
			{
				storageEngine: "wiredTiger",
			},
		],
	});
	const mongoUri = mongoServer.getUri();
	await mongoose.connect(mongoUri);
}, 120000);

afterAll(async () => {
	await mongoose.disconnect();
	if (mongoServer) {
		await mongoServer.stop();
	}
});

afterEach(async () => {
	const collections = mongoose.connection.collections;
	for (const key in collections) {
		await collections[key].deleteMany({});
	}
});
