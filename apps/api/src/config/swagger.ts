export const swaggerOptions = {
  openapi: {
    openapi: "3.0.0",
    info: {
      title: "Dynamic Purchase API",
      description: "API for managing RFI, RFP, ITT processes from project setup to agreement signing",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Development server",
      },
      {
        url: "https://api.example.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http" as const,
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from /api/auth/login or /api/auth/set-password",
        },
      },
    },
    tags: [
      { name: "auth", description: "Authentication endpoints" },
      { name: "users", description: "User management endpoints" },
      { name: "projects", description: "Project management endpoints" },
      { name: "requirements", description: "Requirement management endpoints" },
      { name: "vendors", description: "Vendor management and search endpoints" },
      { name: "rfi", description: "Request for Information (RFI) endpoints" },
      { name: "templates", description: "Template management endpoints" },
      { name: "notifications", description: "Notification endpoints" },
    ],
  },
};

export const swaggerUiOptions = {
  routePrefix: "/api/docs",
  uiConfig: {
    docExpansion: "list" as const,
    deepLinking: true,
  },
  staticCSP: true,
  transformStaticCSP: (header: string) => header,
  transformSpecification: (swaggerObject: any) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
};
