import { FastifyRequest } from "fastify";
import { JWTPayload } from "@dp/lib";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

