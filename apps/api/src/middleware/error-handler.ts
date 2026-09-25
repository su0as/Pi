import type { Hook } from "@hono/zod-openapi";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { AppError, problemDetails, titleForStatus } from "../lib/problem-details.js";
import type { AppEnv } from "../types.js";

function requestIdOf(c: Context<AppEnv>): string {
  // Falls back when the error happens before requestId middleware runs (shouldn't happen given
  // the middleware order in app.ts, but a request ID of "unknown" beats a crash while erroring).
  return c.get("requestId") ?? "unknown";
}

/** Global validation-failure hook for every `@hono/zod-openapi` route — maps a ZodError to
 * problem+json instead of the library's default plain-JSON error shape. */
export const validationHook: Hook<unknown, AppEnv, string, Response | undefined> = (result, c) => {
  if (!result.success) {
    const requestId = requestIdOf(c);
    return c.json(
      problemDetails(
        400,
        "validation_error",
        titleForStatus(400),
        "The request did not match the expected shape.",
        requestId,
        { target: result.target, issues: result.error.issues },
      ),
      400,
    );
  }
  return undefined;
};

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = requestIdOf(c);
  const logger = c.get("logger");

  if (err instanceof AppError) {
    logger?.warn({ err, code: err.code }, "request failed");
    return c.json(
      problemDetails(err.status, err.code, titleForStatus(err.status), err.message, requestId),
      err.status,
    );
  }

  if (err instanceof HTTPException) {
    logger?.warn({ err }, "request failed");
    return c.json(
      problemDetails(
        err.status,
        "http_exception",
        titleForStatus(err.status),
        err.message,
        requestId,
      ),
      err.status,
    );
  }

  logger?.error({ err }, "unhandled error");
  return c.json(
    problemDetails(500, "internal_error", titleForStatus(500), undefined, requestId),
    500,
  );
};

export const notFound: NotFoundHandler<AppEnv> = (c) => {
  const requestId = requestIdOf(c);
  return c.json(
    problemDetails(404, "not_found", titleForStatus(404), `No route for ${c.req.path}`, requestId),
    404,
  );
};
