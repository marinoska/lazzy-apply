import { createServer } from "node:http";

import { createApp } from "./app/createApp.js";
import { env } from "./app/env.js";
import { createLogger } from "./app/logger.js";
import { stopMongoClient } from "./app/mongo.js";

const log = createLogger("server");

const server = createServer(createApp());

server.listen(env.PORT, env.HOST, () => {
	log.info(
		`⚡️ Server listening on http://${env.HOST}:${env.PORT}`,
	);
});

const shutdown = (signal: NodeJS.Signals) => {
	log.info({ signal }, "Received shutdown signal");
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
    log.info(
        "Application is being terminated",
    );
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

