import type { NextFunction, Request, Response } from "express";
import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";

import { env, getEnv } from "@/app/env.js";
import { Unauthorized } from "@/app/errors.js";

const jwks = env.SUPABASE_JWKS_URL
	? createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL))
	: undefined;

const jwtSecret = env.SUPABASE_JWT_SECRET
	? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
	: undefined;

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

	// Decode token header to see what algorithm is being used
	const [headerB64] = token.split(".");
	const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
	console.log("[Auth] JWT Header:", header);

	// Use JWT secret if available, otherwise use JWKS
	let payload: JWTPayload;
	if (jwtSecret) {
		const result = await jwtVerify(token, jwtSecret, {
			algorithms: ["HS256"],
		});
		payload = result.payload;
	} else if (jwks) {
		// For ES256, don't specify algorithms - let jose auto-detect from the JWKS
		const result = await jwtVerify(token, jwks);
		payload = result.payload;
	} else {
		throw new Error("Neither SUPABASE_JWT_SECRET nor SUPABASE_JWKS_URL is configured");
	}
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
