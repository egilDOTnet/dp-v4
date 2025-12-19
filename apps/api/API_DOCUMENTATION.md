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

1. **Check User** (determine authentication method):
   ```
   POST /api/auth/check-user
   Body: { "email": "user@example.com" }
   ```
   Returns: `{ "exists": true, "hasPassword": true }`

2. **Login with Password** (if user has password set):
   ```
   POST /api/auth/login
   Body: { "email": "user@example.com", "password": "password123" }
   ```

3. **Magic Link** (passwordless authentication):
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

4. **Get Current User**:
   ```
   GET /api/auth/me
   Authorization: Bearer <token>
   ```
   Returns current authenticated user information.

5. **Logout**:
   ```
   POST /api/auth/logout
   Authorization: Bearer <token>
   ```
   Note: In stateless JWT systems, logout is primarily client-side. This endpoint exists for consistency and future token blacklist support.

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
- **RFP** (`/api/projects/:id/rfp`) - Request for Proposal management
- **Vendors** (`/api/vendors`) - Vendor search and lookup
- **Templates** (`/api/templates`) - Template management
- **Notifications** (`/api/notifications`) - User notifications
- **Vendor RFI** (`/api/vendor-rfi/*`) - Vendor-facing RFI response endpoints (token-based)
- **Vendor RFP** (`/api/vendor-rfp/*`) - Vendor-facing RFP response endpoints (token-based)

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

## Endpoint Details

### RFP Endpoints

All RFP endpoints are under `/api/projects/:id/rfp` where `:id` is the project ID.

#### RFP Management
- `GET /api/projects/:id/rfp` - Get RFP for a project (creates if doesn't exist)
- `PUT /api/projects/:id/rfp` - Update RFP settings (status, contacts, dates, about)

#### RFP Publishing and Sending
- `POST /api/projects/:id/rfp/publish` - Publish the RFP
- `POST /api/projects/:id/rfp/send` - Send RFP to vendors

#### RFP Schedule
- `GET /api/projects/:id/rfp/schedule` - Get all schedule items
- `POST /api/projects/:id/rfp/schedule` - Create a new schedule item
- `PUT /api/projects/:id/rfp/schedule/:itemId` - Update a schedule item
- `DELETE /api/projects/:id/rfp/schedule/:itemId` - Delete a schedule item

#### RFP Documents
- `GET /api/projects/:id/rfp/documents` - Get all RFP documents
- `POST /api/projects/:id/rfp/documents` - Upload a new document
- `PUT /api/projects/:id/rfp/documents/:docId` - Update document metadata
- `DELETE /api/projects/:id/rfp/documents/:docId` - Delete a document
- `PUT /api/projects/:id/rfp/documents/reorder` - Reorder documents

#### RFP Changelog
- `GET /api/projects/:id/rfp/changelog` - Get changelog entries
- `PUT /api/projects/:id/rfp/changelog/:entryId` - Update a changelog entry
- `DELETE /api/projects/:id/rfp/changelog/:entryId` - Delete a changelog entry

#### RFP Questions
- `GET /api/projects/:id/rfp/questions` - Get all questions (supports `?filter=answered` or `?filter=unanswered`)
- `POST /api/projects/:id/rfp/questions` - Create a new question
- `POST /api/projects/:id/rfp/questions/:questionId/split` - Split a question into multiple questions
- `PUT /api/projects/:id/rfp/questions/:questionId/answer` - Answer a question
- `DELETE /api/projects/:id/rfp/questions/:questionId` - Delete a question

#### RFP Announcements
- `GET /api/projects/:id/rfp/announcements` - Get all announcements
- `POST /api/projects/:id/rfp/announcements` - Create a new announcement
- `PUT /api/projects/:id/rfp/announcements/:announcementId` - Update an announcement
- `DELETE /api/projects/:id/rfp/announcements/:announcementId` - Delete an announcement
- `POST /api/projects/:id/rfp/announcements/:announcementId/send` - Send an announcement

### Vendor RFI Endpoints

Vendor RFI endpoints use token-based authentication. Vendors receive a magic link token that grants access to their specific RFI response.

**Base Path**: `/api/vendor-rfi/*`

All endpoints use a catch-all route pattern where the token is part of the URL path:

- `GET /api/vendor-rfi/{token}` - Get RFI data, project info, vendor info, and existing responses
- `GET /api/vendor-rfi/{token}/response` - Get existing response data and contact person
- `POST /api/vendor-rfi/{token}/response` - Submit RFI response (answers and contact person)
- `PUT /api/vendor-rfi/{token}/answers` - Save answers incrementally (auto-save)
- `GET /api/vendor-rfi/{token}/contacts` - Get all contacts for the vendor
- `POST /api/vendor-rfi/{token}/contacts` - Create a new contact person

**Note**: The token is a JWT that contains the vendor response ID. Tokens expire based on the RFI deadline or configured expiration time.

### Vendor RFP Endpoints

Vendor RFP endpoints support both token-based and authenticated access.

#### Vendor RFP Authentication
- `POST /api/vendor-rfp/auth/check-user` - Check if vendor contact exists and has password
- `POST /api/vendor-rfp/auth/login` - Login with email and password
- `POST /api/vendor-rfp/auth/magic-link` - Request magic link for passwordless auth
- `POST /api/vendor-rfp/auth/set-password` - Set password from magic link token
- `GET /api/vendor-rfp/auth/me` - Get current authenticated vendor contact

#### Vendor RFP Data Access
- `GET /api/vendor-rfp/rfps` - List RFPs accessible to the authenticated vendor
- `GET /api/vendor-rfp/rfps/:rfpId` - Get RFP details (supports optional `?token=` query param for token-based access)
- `POST /api/vendor-rfp/rfps/:rfpId/participate` - Participate in an RFP (creates vendor response)

#### Vendor RFP Questions
- `GET /api/vendor-rfp/rfps/:rfpId/questions` - Get questions for an RFP
- `POST /api/vendor-rfp/rfps/:rfpId/questions` - Submit a question about the RFP

#### Vendor RFP Proposals
- `GET /api/vendor-rfp/rfps/:rfpId/proposal` - Get proposal data (questions, answers, files)
- `POST /api/vendor-rfp/rfps/:rfpId/proposal/files` - Upload a proposal file
- `PUT /api/vendor-rfp/rfps/:rfpId/proposal/files/:fileId` - Update file metadata
- `DELETE /api/vendor-rfp/rfps/:rfpId/proposal/files/:fileId` - Delete a proposal file
- `POST /api/vendor-rfp/rfps/:rfpId/proposal/submit` - Submit the proposal

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

### RFP Management

```bash
# Get or create RFP for a project
GET /api/projects/{projectId}/rfp
Authorization: Bearer <token>

# Update RFP settings
PUT /api/projects/{projectId}/rfp
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "Published",
  "contactPersonId": "contact-id",
  "publishDate": "2024-01-15T10:00:00Z",
  "deliveryDate": "2024-02-15T10:00:00Z",
  "about": "RFP description"
}

# Publish RFP
POST /api/projects/{projectId}/rfp/publish
Authorization: Bearer <token>

# Send RFP to vendors
POST /api/projects/{projectId}/rfp/send
Authorization: Bearer <token>
```

### Vendor Authentication (RFP)

Vendors can authenticate to access RFP responses:

```bash
# Check if vendor contact exists
POST /api/vendor-rfp/auth/check-user
Body: { "email": "vendor@example.com" }

# Login with password
POST /api/vendor-rfp/auth/login
Body: { "email": "vendor@example.com", "password": "password123" }

# Get current vendor user
GET /api/vendor-rfp/auth/me
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
