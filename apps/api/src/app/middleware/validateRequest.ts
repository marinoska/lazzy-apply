import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny } from "zod";

import { ValidationError } from "@/app/errors.js";

type ValidationSchemas = {
	body?: ZodTypeAny;
	query?: ZodTypeAny;
	params?: ZodTypeAny;
};

export const validateRequest =
	(schemas: ValidationSchemas) =>
	(req: Request, _res: Response, next: NextFunction) => {
		try {
			if (schemas.body) {
				req.body = schemas.body.parse(req.body);
			}

			if (schemas.query) {
				schemas.query.parse(req.query);
			}

			if (schemas.params) {
				schemas.params.parse(req.params);
			}

			return next();
		} catch (error) {
			throw new ValidationError("Invalid request", error);
		}
	};
