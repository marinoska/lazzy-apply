import cors from "cors";
import "express-async-errors";
import type {
	ErrorRequestHandler,
	Express,
	NextFunction,
	Request,
	Response,
} from "express";
import express from "express";
import helmet from "helmet";

import { registerRoutes } from "../routes/index.js";
import { env } from "./env.js";
import { normalizeError } from "./errors.js";
import { createLogger } from "./logger.js";

export const createApp = (): Express => {
	const log = createLogger("http");
	const app = express();

	app.disable("x-powered-by");
	app.use(
		helmet({
			hsts: env.NODE_ENV === "production",
			contentSecurityPolicy: env.NODE_ENV === "production",
		}),
	);
	app.use(express.json({ limit: "1mb" }));
	app.use(express.urlencoded({ extended: true }));

	if (env.ALLOWED_ORIGIN_LIST.length > 0) {
		app.use(
			cors({
				origin: env.ALLOWED_ORIGIN_LIST,
				credentials: true,
			}),
		);
	} else {
		app.use(cors());
	}

	registerRoutes(app);

	const errorHandler: ErrorRequestHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
		if (!err) {
			return _next();
		}

		const error = normalizeError(err);
		const statusCode = error.status();

		if (statusCode >= 400 && statusCode < 500) {
			log.debug(error.log(), `Client error while handling ${req.url}:`);
		} else {
			log.error(error.log(), `Exception while handling ${req.url}:`);
		}

		res.status(statusCode).json(error.json());
	};

	app.use((_req, res) => {
		res.status(404).json({ error: "Not Found" });
	});

	app.use(errorHandler);

	return app;
};
