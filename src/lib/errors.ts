import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError, type ZodTypeAny, z } from 'zod';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(message = 'Not found'): never {
  throw new HttpError(404, message);
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

export function forbidden(message = 'You do not have permission to do that'): never {
  throw new HttpError(403, message);
}

export function conflict(message: string): never {
  throw new HttpError(409, message);
}

export function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  try {
    return schema.parse(value);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new HttpError(422, error.issues.map((issue) => issue.message).join('; '));
    }
    throw error;
  }
}

interface ErrorDetails {
  code?: unknown;
  statusCode?: unknown;
  message?: unknown;
  headers?: unknown;
}

function getErrorDetails(error: unknown): ErrorDetails {
  if (typeof error === 'object' && error !== null) {
    return error as ErrorDetails;
  }
  return {};
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler(async (request, reply) =>
    reply.code(404).send({ detail: 'Not found', request_id: request.id }),
  );

  app.setErrorHandler(async (error: unknown, request: FastifyRequest, reply) => {
    const details = getErrorDetails(error);
    const known = error instanceof HttpError;
    const message = typeof details.message === 'string' ? details.message : 'Internal server error';
    const driverCode = typeof details.code === 'string' ? details.code : undefined;
    const status = known
      ? error.statusCode
      : typeof details.statusCode === 'number'
        ? details.statusCode
        : undefined;
    const fallbackStatus =
      driverCode === '23505' || driverCode === '23503' ? 409 : undefined;
    const safeStatus =
      fallbackStatus ?? (status && status >= 400 && status < 600 ? status : 500);

    if (safeStatus >= 500) {
      request.log.error({ err: error, request_id: request.id }, 'Request failed');
    } else {
      request.log.info({ statusCode: safeStatus, request_id: request.id }, message);
    }

    if (known && error.headers) {
      reply.headers(error.headers);
    }

    const responseMessage =
      safeStatus === 500
        ? 'Internal server error'
        : fallbackStatus
          ? 'The request conflicts with an existing record or relationship'
          : message;

    return reply.code(safeStatus).send({
      detail: responseMessage,
      request_id: request.id,
    });
  });
}
