import { createServer } from "node:http";

import { createApp } from "./app/createApp.js";
import { env } from "./app/env.js";
import { createLogger } from "./app/logger.js";
import { connectToMongo, stopMongoClient } from "./app/mongo.js";
import {
	startOutboxProcessor,
	stopOutboxProcessor,
} from "./workers/outboxProcessor.js";

const log = createLogger("server");

const startServer = async () => {
	try {
		await connectToMongo();

		// Start background jobs after DB is connected
		startOutboxProcessor();

		// Create and start the HTTP server
		const server = createServer(createApp());

		server.listen(env.PORT, env.HOST, () => {
			log.info(`⚡️ Server listening on http://${env.HOST}:${env.PORT}`);
		});

		return server;
	} catch (error) {
		log.fatal({ error }, "Failed to start server");
		process.exit(1);
	}
};

const server = await startServer();

const _shutdown = (signal: NodeJS.Signals) => {
	log.info({ signal }, "Received shutdown signal");
	stopOutboxProcessor();
	void stopMongoClient();

	server.close((err) => {
		if (err) {
			log.error({ err }, "Error while closing server");
			process.exit(1);
		}

		log.info("Server closed gracefully");
		process.exit(0);
	});
};

const gracefulExit = () => {
	log.info("Application is being terminated");
	stopOutboxProcessor();
	// If the Node process ends, close the Mongoose connection
	void stopMongoClient();
};

process.on("SIGINT", gracefulExit);
process.on("SIGTERM", gracefulExit);

process.on("uncaughtException", (error) => {
	log.fatal({ error }, "Uncaught exception");
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	log.fatal({ reason }, "Unhandled promise rejection");
	process.exit(1);
});
