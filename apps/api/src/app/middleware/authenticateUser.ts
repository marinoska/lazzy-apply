import type { NextFunction, Request, Response } from "express";
import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";

import { getEnv } from "@/app/env.js";
import { Unauthorized } from "@/app/errors.js";

const jwks = createRemoteJWKSet(new URL(getEnv("SUPABASE_JWKS_URL")));

export interface AuthenticatedUser {
	id: string;
	email?: string;
	role?: string;
	audience?: string;
	issuedAt?: number;
	expiresAt?: number;
	metadata?: Record<string, unknown>;
	token: string;
	raw: JWTPayload;
}

declare global {
	namespace Express {
		// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- merging into Express namespace
		interface Request {
			user?: AuthenticatedUser;
		}
	}
}

const extractToken = (authorizationHeader?: string): string => {
	if (!authorizationHeader) {
		throw new Unauthorized("Missing Authorization header");
	}

	const [scheme, token] = authorizationHeader.split(" ");

	if (!token || scheme?.toLowerCase() !== "bearer") {
		throw new Unauthorized("Authorization header must be a Bearer token");
	}

	return token;
};

const normalizeAudience = (aud?: string | string[]): string | undefined => {
	if (!aud) {
		return undefined;
	}

	if (Array.isArray(aud)) {
		return aud[0];
	}

	return aud;
};

export const authenticateUser = async (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	const token = extractToken(
		req.header("authorization") ?? req.header("Authorization"),
	);

	const { payload } = await jwtVerify(token, jwks);
	const id = typeof payload.sub === "string" ? payload.sub : undefined;
console.log(payload);
	if (!id) {
		throw new Unauthorized("Token is missing subject claim");
	}

	req.user = {
		id,
		email: typeof payload.email === "string" ? payload.email : undefined,
		role: typeof payload.role === "string" ? payload.role : undefined,
		audience: normalizeAudience(payload.aud),
		issuedAt: typeof payload.iat === "number" ? payload.iat : undefined,
		expiresAt: typeof payload.exp === "number" ? payload.exp : undefined,
		metadata:
			payload.user_metadata && typeof payload.user_metadata === "object"
				? (payload.user_metadata as Record<string, unknown>)
				: undefined,
		token,
		raw: payload,
	};

	return next();
};
