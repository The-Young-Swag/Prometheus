import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface ApiErrorResponse {
    status: "error";
    message: string;
    errors?: unknown;
}

const DEFAULT_ERROR_MESSAGE = "An unexpected error occurred";

const SAFE_ERROR_MESSAGES: Partial<Record<number, string>> = {
    502: "The model service request failed",
    503: "The model service is unavailable",
    504: "The model service timed out",
};

export function createErrorResponse(
    message: string,
    errors?: unknown,
): ApiErrorResponse {
    const response: ApiErrorResponse = {
        status: "error",
        message,
    };
    if (errors !== undefined) {
        response.errors = errors;
    }
    return response;
}

function resolveErrorStatus(
    error: unknown,
    defaultStatus: ContentfulStatusCode,
): ContentfulStatusCode {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";

    return isTimeout ? 504 : defaultStatus;
}

export function respondWithError(
    c: Context,
    error: unknown,
    defaultStatus: ContentfulStatusCode = 500,
): Response {
    console.error(error);

    const status = resolveErrorStatus(error, defaultStatus);
    const message = SAFE_ERROR_MESSAGES[status] ?? DEFAULT_ERROR_MESSAGE;

    return c.json(createErrorResponse(message), status);
}

export function respondWithValidationError(
    c: Context,
    issues: unknown,
    status: ContentfulStatusCode = 400,
): Response {
    return c.json(createErrorResponse("Invalid request", issues), status);
}