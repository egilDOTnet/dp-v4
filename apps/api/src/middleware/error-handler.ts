import { FastifyRequest, FastifyReply, FastifyError } from "fastify";
import { ZodError } from "zod";

export function errorHandler(
  error: FastifyError | Error | null | undefined,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Handle null/undefined errors
  if (!error) {
    if (request.log) {
      request.log.error("Error handler called with null/undefined error");
    }
    return reply.status(500).send({
      error: "Internal server error",
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "Validation error",
      details: error.errors,
    });
  }

  // Handle Fastify schema validation errors
  if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 400) {
    return reply.status(400).send({
      error: error.message || "Validation error",
    });
  }

  if (request.log) {
    request.log.error(error);
  }
  return reply.status(500).send({
    error: "Internal server error",
  });
}

