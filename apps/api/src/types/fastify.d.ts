import { JWTPayload } from "@dp/lib";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JWTPayload | undefined;
  }

  // FastifySchema description is now declared in packages/config/typescript/types/fastify.d.ts
  // to be available to both API and web packages
}

