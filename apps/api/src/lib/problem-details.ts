import { brand } from "@repo/config/brand";
import type { ClientErrorStatusCode, ServerErrorStatusCode } from "hono/utils/http-status";

/** AppError is always a 4xx or 5xx — never informational/redirect/success. */
type ErrorStatusCode = ClientErrorStatusCode | ServerErrorStatusCode;

/**
 * RFC 9457 (application/problem+json) error responses — CLAUDE.md: "Errors: RFC 9457
 * application/problem+json with type, title, status, detail, code, requestId."
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  requestId: string;
  [key: string]: unknown;
}

/** Thrown by route handlers for any error that should reach the client as structured
 * problem+json rather than a bare 500 — caught by the error-handler middleware. */
export class AppError extends Error {
  readonly status: ErrorStatusCode;
  readonly code: string;

  constructor(status: ErrorStatusCode, code: string, detail: string) {
    super(detail);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

function typeBase(): string {
  return `https://${brand.domain}/errors`;
}

export function problemDetails(
  status: number,
  code: string,
  title: string,
  detail: string | undefined,
  requestId: string,
  extra?: Record<string, unknown>,
): ProblemDetails {
  return {
    type: `${typeBase()}/${code}`,
    title,
    status,
    detail,
    code,
    requestId,
    ...extra,
  };
}

const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

export function titleForStatus(status: number): string {
  return STATUS_TITLES[status] ?? "Error";
}
