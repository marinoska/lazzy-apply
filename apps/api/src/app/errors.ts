import boom, { Boom } from "@hapi/boom";
import { ZodError } from "zod";

export const isZodError = (err: unknown): err is ZodError =>
	err instanceof ZodError;

export const ExternalServiceUnauthorizedStatusCode = 440;

export class HttpError extends Error {
	httpError: Boom;

	constructor(message: string, error: unknown) {
		super(message);
		// all unrecognized errors become internal 500
		// in production environment boom will not print out the carried message for 500
		if (boom.isBoom(error)) {
			this.httpError = error;
		} else if (isZodError(error)) {
			// validation error
			this.httpError = boom.badRequest(error.message);
		} else if (error instanceof Error) {
			this.httpError = boom.boomify(error, { statusCode: 500 });
		} else {
			this.httpError = boom.internal(message);
		}
	}

	status() {
		return this.httpError.output.statusCode;
	}

	json() {
		return { ...this.httpError.output.payload };
	}

	log() {
		return {
			...this.httpError.output.payload,
			data: this.httpError.data,
			stack: this.httpError.stack,
			message: this.message,
		};
	}
}

export class Forbidden extends HttpError {
	constructor(message: string, data: unknown) {
		super(message, boom.forbidden("Forbidden", data));
	}
}

export class Unauthorized extends HttpError {
	constructor(message: string) {
		super(message, boom.unauthorized("Can not authenticate user"));
	}
}

export class InvalidSignature extends HttpError {
	constructor(message: string) {
		super(message, boom.unauthorized("Invalid signature"));
	}
}

export class InvalidToken extends HttpError {
	constructor(message: string) {
		super(
			message,
			new Boom("Invalid token", {
				statusCode: ExternalServiceUnauthorizedStatusCode,
			}),
		);
	}
}

export class NotFound extends HttpError {
	constructor(message: string) {
		super(message, boom.notFound(message));
	}
}

export class DBError extends HttpError {
	constructor(message: string, data?: unknown) {
		super(message, boom.internal(message, data));
	}
}

export class ValidationError extends HttpError {
	constructor(message: string, errors?: unknown) {
		super(message, boom.badRequest(errors ? JSON.stringify(errors) : message));
	}
}

export const normalizeError = (err: unknown) => {
	if (err instanceof HttpError) {
		return err;
	}

	const message =
		"message" in (err as { message: string })
			? (err as { message: string }).message
			: "Unknown error";
	// any unknown error gets becomes http error 500
	return new HttpError(message, err);
};
