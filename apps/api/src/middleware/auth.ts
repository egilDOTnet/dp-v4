import { FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { JWTPayload } from "@dp/lib";

export function getUser(request: FastifyRequest): JWTPayload {
  return request.user as JWTPayload;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const decoded = request.user as unknown as { userId: string; email: string; tenantId: string | null; role: string };
    
    if (!decoded?.userId) {
      request.log?.warn({ decoded }, "JWT token missing userId");
      reply.status(401).send({ error: "Invalid token: missing user information" });
      return;
    }
    
    // Verify user still exists and get fresh data
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    });

    if (!user) {
      request.log?.warn({ userId: decoded.userId, email: decoded.email }, "User not found in database during authentication");
      reply.status(401).send({ error: "User not found. Please log out and log back in." });
      return;
    }

    // Attach user info to request
    request.user = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role as any,
    };
  } catch (error: any) {
    request.log?.error({ err: error }, "Authentication error");
    reply.status(401).send({ error: "Unauthorized" });
  }
}

export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user as JWTPayload | undefined;
    if (!user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  };
}

export async function requireTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user as JWTPayload | undefined;
  if (!user?.tenantId) {
    reply.status(403).send({ error: "Tenant required" });
    return;
  }
}

/**
 * Convenience middleware to require GlobalAdministrator role
 */
export function requireGlobalAdmin() {
  return requireRole(["GlobalAdministrator"]);
}

