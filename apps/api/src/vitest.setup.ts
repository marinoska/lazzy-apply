import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { beforeAll, afterAll, afterEach } from "vitest";

// Set required environment variables for tests
process.env.NODE_ENV = "test";
process.env.HOST = "localhost";
process.env.MONGO_CONNECTION = "mongodb://localhost:27017/test";
process.env.LOG_LEVEL = "silent";

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
	mongoServer = await MongoMemoryReplSet.create({
		replSet: { count: 1 },
	});
	const mongoUri = mongoServer.getUri();
	await mongoose.connect(mongoUri);
}, 60000);

afterAll(async () => {
	await mongoose.disconnect();
	await mongoServer.stop();
});

afterEach(async () => {
	const collections = mongoose.connection.collections;
	for (const key in collections) {
		await collections[key].deleteMany({});
	}
});
