import { FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";

export function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "Validation error",
      details: error.errors,
    });
  }

  request.log.error(error);
  return reply.status(500).send({
    error: "Internal server error",
  });
}

