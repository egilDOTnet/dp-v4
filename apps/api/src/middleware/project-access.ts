import { FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { getUser } from "./auth";

/**
 * Middleware to verify that the current user has access to a project.
 * User must be either:
 * - A project member, OR
 * - A CompanyAdministrator or GlobalAdministrator from the same tenant as the project
 * 
 * @param projectId - The project ID from the request params
 * @returns Middleware function that verifies project access
 * @throws 403 if user doesn't have access
 * @throws 404 if project doesn't exist
 */
export async function verifyProjectAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Check if user is authenticated
  if (!request.user) {
    reply.status(401).send({ error: "Unauthorized" });
    return;
  }

  const user = getUser(request);
  const params = request.params as { id?: string; projectId?: string };
  // Prefer projectId over id, since id might be a resource ID (e.g., hierarchy ID, requirement ID)
  const projectId = params.projectId || params.id;

  // Log for debugging
  if (request.log) {
    request.log.debug({ 
      params: request.params, 
      extractedProjectId: projectId,
      hasId: !!params.id,
      hasProjectId: !!params.projectId,
      url: request.url,
      method: request.method
    }, "verifyProjectAccess: extracting projectId");
  }

  if (!projectId) {
    request.log?.warn({ params: request.params, url: request.url }, "Project ID not found in request params");
    reply.status(400).send({ error: "Project ID required" });
    return;
  }

  // Fetch project with tenant info
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { ProjectMember: true },
  });

  if (!project) {
    request.log?.warn({ projectId, params: request.params, url: request.url }, "Project not found in database");
    reply.status(404).send({ error: "Project not found" });
    return;
  }

  // Fetch user with project memberships
  const userWithMemberships = await db.user.findUnique({
    where: { id: user.userId },
    include: { projectMembers: true },
  });

  if (!userWithMemberships) {
    reply.status(401).send({ error: "User not found" });
    return;
  }

  // Check if user is a project member
  const isMember = userWithMemberships.projectMembers.some(
    (pm) => pm.projectId === project.id
  );

  // Check if user is an admin from the same tenant
  const isAdmin =
    (user.role === "CompanyAdministrator" || user.role === "GlobalAdministrator") &&
    user.tenantId === project.tenantId;

  if (!isMember && !isAdmin) {
    reply.status(403).send({ error: "Access denied - not a project member" });
    return;
  }

  // Attach project to request for use in route handlers
  (request as any).project = project;
  (request as any).userWithMemberships = userWithMemberships;
}

/**
 * Middleware to require project admin privileges.
 * - GlobalAdministrator: Always allowed (no tenant restriction)
 * - CompanyAdministrator: Only allowed if user's tenant matches project's tenant
 * - Other roles: Denied
 * 
 * @returns Middleware function that verifies project admin access
 * @throws 403 if user doesn't have admin access
 * @throws 404 if project doesn't exist
 */
export function requireProjectAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }

    const user = getUser(request);
    
    const params = request.params as { id?: string; projectId?: string };
    // Prefer projectId over id, since id might be a resource ID
    const projectId = params.projectId || params.id;

    if (!projectId) {
      request.log?.warn({ params: request.params, url: request.url }, "Project ID not found in request params");
      reply.status(400).send({ error: "Project ID required" });
      return;
    }

    // Fetch project to get tenant info
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, tenantId: true },
    });

    if (!project) {
      request.log?.warn({ projectId, params: request.params, url: request.url }, "Project not found in database");
      reply.status(404).send({ error: "Project not found" });
      return;
    }

    // Global Administrators have access to all projects
    if (user.role === "GlobalAdministrator") {
      // Attach project to request for use in route handlers
      (request as any).project = project;
      return;
    }

    // For Company Administrators, we need to check tenant match
    if (user.role !== "CompanyAdministrator") {
      reply.status(403).send({ error: "Forbidden - admin role required" });
      return;
    }

    // Company Administrators can only admin projects in their own tenant
    if (user.tenantId !== project.tenantId) {
      reply.status(403).send({ error: "Forbidden - Company Administrators can only manage projects in their own company" });
      return;
    }

    // Attach project to request for use in route handlers
    // Note: This is a minimal project object with just id and tenantId
    // Handlers may need to fetch the full project with relations
    (request as any).project = project;
  };
}
