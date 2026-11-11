import { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface ApiErrorResponse {
    status: "error";
    message: string;
    errors?: unknown;
}

export function createErrorResponse(
    message: string,
    status: number = 500,
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

export function handleError(error: unknown): { message: string; status: ContentfulStatusCode } {
    if (error instanceof Error) {
        return { message: error.message, status: 500 };
    }
    return { message: "An unexpected error occurred", status: 500 };
}

export function respondWithError(
    c: Context,
    error: unknown,
    defaultStatus: ContentfulStatusCode = 500,
): Response {
    const { message } = handleError(error);
    return c.json(createErrorResponse(message, defaultStatus), defaultStatus);
}

export function respondWithValidationError(
    c: Context,
    issues: unknown,
    status: ContentfulStatusCode = 400,
): Response {
    return c.json(
        createErrorResponse("Invalid request", status, issues),
        status,
    );
}