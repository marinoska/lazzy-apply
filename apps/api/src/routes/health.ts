import { type Router as ExpressRouter, Router } from "express";

export const healthRouter: ExpressRouter = Router().get("/", (_req, res) => {
	res.json({
		status: "ok",
	});
});
