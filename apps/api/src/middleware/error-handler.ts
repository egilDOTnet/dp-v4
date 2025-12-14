import { FastifyRequest, FastifyReply, FastifyError } from "fastify";
import { ZodError } from "zod";

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "Validation error",
      details: error.errors,
    });
  }

  // Handle Fastify schema validation errors
  if ("statusCode" in error && error.statusCode === 400) {
    return reply.status(400).send({
      error: error.message || "Validation error",
    });
  }

  request.log.error(error);
  return reply.status(500).send({
    error: "Internal server error",
  });
}

