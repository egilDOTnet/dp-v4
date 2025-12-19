# API Documentation

## Overview

The Dynamic Purchase API provides endpoints for managing RFI, RFP, and ITT processes from project setup to agreement signing. The API is built with Fastify and uses JWT-based authentication.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://api.example.com` (update when deployed)

## Interactive Documentation

Swagger UI is available at `/api/docs` when the API server is running. This provides an interactive interface to explore and test all endpoints.

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Most endpoints require a valid JWT token in the Authorization header.

### Getting a Token

1. **Login with Password** (if user has password set):
   ```
   POST /api/auth/login
   Body: { "email": "user@example.com", "password": "password123" }
   ```

2. **Magic Link** (passwordless authentication):
   ```
   POST /api/auth/magic-link
   Body: { "email": "user@example.com" }
   ```
   Then verify and set password:
   ```
   GET /api/auth/verify-magic-link?token=<token>
   POST /api/auth/set-password
   Body: { "token": "<token>", "password": "newpassword123" }
   ```

### Using the Token

Include the token in the Authorization header for protected endpoints:
```
Authorization: Bearer <your-jwt-token>
```

## API Structure

### Endpoint Groups

- **Auth** (`/api/auth`) - Authentication and user management
- **Users** (`/api/users`) - User profile and company user management
- **Projects** (`/api/projects`) - Project CRUD, phases, tasks, vendors, dashboard
- **Requirements** (`/api/projects/:projectId/requirements`) - Requirement hierarchies and management
- **RFI** (`/api/projects/:id/rfi`) - Request for Information management
- **Vendors** (`/api/vendors`) - Vendor search and lookup
- **Templates** (`/api/templates`) - Template management
- **Notifications** (`/api/notifications`) - User notifications

## Common Patterns

### Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

### Pagination

List endpoints support pagination (where implemented):
```
GET /api/endpoint?page=1&limit=20
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Date Formats

All dates are returned in ISO 8601 format:
```
2024-01-15T10:30:00.000Z
```

### User Display Names

User objects include both structured name fields and a computed `name` field:
- `firstName` - User's first name
- `lastName` - User's last name
- `name` - Computed display name (falls back to firstName, lastName, or legacy name field)

## Role-Based Access Control

### Roles

- **GlobalAdministrator** - Full system access
- **CompanyAdministrator** - Full access within their company/tenant
- **User** - Standard user with project-based access

### Access Patterns

- **Project Access**: Users can access projects they are members of, or all projects if they are company admins
- **Company Resources**: Company admins can manage all users and resources in their company
- **Global Resources**: Only global administrators can access global resources

## Rate Limiting

Rate limiting may be implemented in production. Check response headers for rate limit information:
- `X-RateLimit-Limit` - Request limit per window
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Time when the rate limit resets

## Webhooks & Events

Webhook support may be added in the future. Check the API version for webhook endpoint availability.

## Versioning

The API is currently at version 1.0.0. Future versions will be indicated in the URL path:
```
/api/v1/...
/api/v2/...
```

## Examples

### Creating a Project

```bash
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Procurement Project",
  "type": "Software",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "memberIds": ["user-id-1", "user-id-2"]
}
```

### Adding a Requirement

```bash
POST /api/projects/{projectId}/requirements
Authorization: Bearer <token>
Content-Type: application/json

{
  "hierarchyId": "hierarchy-id",
  "description": "System must support 1000 concurrent users",
  "type": "Functional",
  "status": "Draft"
}
```

### Searching for Vendors

```bash
GET /api/vendors/search?query=Acme%20Corporation
Authorization: Bearer <token>
```

## Support

For API support or questions:
- Check the Swagger UI at `/api/docs` for interactive documentation
- Review endpoint schemas for request/response formats
- Check error responses for detailed error information

## Changelog

### Version 1.0.0
- Initial API release
- JWT authentication
- Project, requirement, RFI, and vendor management
- User and notification systems
