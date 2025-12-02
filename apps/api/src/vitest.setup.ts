import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";

// Set required environment variables for tests
process.env.NODE_ENV = "test";
process.env.HOST = "localhost";
process.env.MONGO_CONNECTION = "mongodb://localhost:27017/test";
process.env.LOG_LEVEL = "silent";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.SUPABASE_JWKS_URL =
	"https://example.supabase.co/.well-known/jwks.json";
process.env.SUPABASE_JWT_SECRET = "test-jwt-secret";
process.env.WORKER_SECRET = "test-worker-secret";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.OPENAI_MODEL = "gpt-4o-mini";
process.env.OPENAI_MODEL_INPUT_PRICE_PER_1M = "0.15";
process.env.OPENAI_MODEL_OUTPUT_PRICE_PER_1M = "0.60";

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
