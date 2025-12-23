import { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth";

interface BrregEntity {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: {
    kode: string;
    beskrivelse: string;
  };
  forretningsadresse?: {
    land: string;
    landkode: string;
    postnummer?: string;
    poststed?: string;
    adresse?: string[];
    kommune?: string;
    kommunenummer?: string;
  };
  hjemmeside?: string;
  naeringskode1?: {
    beskrivelse: string;
    kode: string;
  };
}

interface BrregSearchResponse {
  _embedded?: {
    enheter: BrregEntity[];
  };
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

export default async function vendorRoutes(fastify: FastifyInstance) {
  /**
   * Search Norwegian company registry (brreg.no) for companies
   * Returns company information including organization number, name, address, etc.
   */
  fastify.get<{
    Querystring: { query: string };
  }>(
    "/search",
    {
      preHandler: [authenticate],
      schema: {
        description: "Search the Norwegian company registry (brreg.no) for companies by name. Returns up to 20 results with company details.",
        tags: ["vendors"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              minLength: 2,
              description: "Company name to search for (minimum 2 characters)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    organizationNumber: { type: "string" },
                    name: { type: "string" },
                    organizationForm: { type: "string", nullable: true },
                    address: {
                      type: "object",
                      nullable: true,
                      properties: {
                        street: { type: "string", nullable: true },
                        postalCode: { type: "string", nullable: true },
                        city: { type: "string", nullable: true },
                        municipality: { type: "string", nullable: true },
                      },
                    },
                    website: { type: "string", nullable: true },
                    industry: { type: "string", nullable: true },
                  },
                },
              },
              total: {
                type: "number",
                description: "Total number of results available",
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Query too short (must be at least 2 characters)",
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized",
          },
          502: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Failed to search company registry",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Internal server error",
          },
        },
      },
    },
    async (request, reply) => {
      const { query } = request.query;

      if (!query || query.trim().length < 2) {
        return reply.status(400).send({ error: "Query must be at least 2 characters" });
      }

      try {
        // Search the Enhetsregisteret API
        const searchUrl = `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(query)}&size=20`;
        const response = await fetch(searchUrl);

        if (!response.ok) {
          let errorBody: string | undefined;
          try {
            errorBody = await response.text();
          } catch {
            // Ignore if we can't read the body
          }
          request.log.error(
            {
              status: response.status,
              statusText: response.statusText,
              url: searchUrl,
              errorBody,
            },
            "Brreg API error"
          );
          return reply.status(502).send({ error: "Failed to search company registry" });
        }

        let data: BrregSearchResponse;
        try {
          data = await response.json() as BrregSearchResponse;
        } catch (jsonError: unknown) {
          const responseText = await response.text().catch(() => "Unable to read response");
          request.log.error(
            {
              err: jsonError,
              responseText: responseText.substring(0, 500), // Limit log size
              url: searchUrl,
            },
            "Failed to parse brreg.no API response as JSON"
          );
          return reply.status(502).send({ error: "Invalid response from company registry" });
        }

        // Validate response structure
        if (!data || typeof data !== "object") {
          request.log.error(
            { data, url: searchUrl },
            "Invalid response structure from brreg.no API"
          );
          return reply.status(502).send({ error: "Invalid response from company registry" });
        }

        // Transform the response to a simpler format
        // Handle cases where _embedded might be missing
        const entities = data._embedded?.enheter || [];
        const results = entities.map((entity) => ({
          organizationNumber: entity.organisasjonsnummer,
          name: entity.navn,
          organizationForm: entity.organisasjonsform?.beskrivelse || null,
          address: entity.forretningsadresse
            ? {
                street: entity.forretningsadresse.adresse?.join(", ") || null,
                postalCode: entity.forretningsadresse.postnummer || null,
                city: entity.forretningsadresse.poststed || null,
                municipality: entity.forretningsadresse.kommune || null,
              }
            : null,
          website: entity.hjemmeside || null,
          industry: entity.naeringskode1?.beskrivelse || null,
        }));

        // Safely access page.totalElements with fallback
        const total = data.page?.totalElements ?? results.length;

        return reply.send({
          results,
          total,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        request.log.error(
          {
            err: error,
            errorMessage,
            errorStack,
            query,
          },
          "Error searching brreg.no"
        );
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  /**
   * Get detailed information for a specific organization number from brreg.no
   * Returns comprehensive company details including address, industry, etc.
   */
  fastify.get<{
    Params: { orgNumber: string };
  }>(
    "/brreg/:orgNumber",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get detailed information for a specific Norwegian organization number from brreg.no. Returns comprehensive company details.",
        tags: ["vendors"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["orgNumber"],
          properties: {
            orgNumber: {
              type: "string",
              pattern: "^\\d{9}$",
              description: "9-digit Norwegian organization number",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              organizationNumber: { type: "string" },
              name: { type: "string" },
              organizationForm: { type: "string", nullable: true },
              address: {
                type: "object",
                nullable: true,
                properties: {
                  street: { type: "string", nullable: true },
                  postalCode: { type: "string", nullable: true },
                  city: { type: "string", nullable: true },
                  municipality: { type: "string", nullable: true },
                },
              },
              website: { type: "string", nullable: true },
              industry: { type: "string", nullable: true },
              rawData: {
                type: "object",
                description: "Raw data from brreg.no API for future AI analysis",
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid organization number format",
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Organization not found in brreg.no",
          },
          502: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Failed to fetch company details from brreg.no",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Internal server error",
          },
        },
      },
    },
    async (request, reply) => {
      const { orgNumber } = request.params;

      // Validate organization number format (9 digits)
      if (!/^\d{9}$/.test(orgNumber)) {
        return reply.status(400).send({ error: "Invalid organization number format. Must be 9 digits." });
      }

      try {
        const detailsUrl = `https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}`;
        const response = await fetch(detailsUrl);

        if (response.status === 404) {
          return reply.status(404).send({ error: "Organization not found" });
        }

        if (!response.ok) {
          request.log.error(`Brreg API error: ${response.status} ${response.statusText}`);
          return reply.status(502).send({ error: "Failed to fetch company details" });
        }

        const entity = await response.json() as BrregEntity;

        // Return detailed information
        return reply.send({
          organizationNumber: entity.organisasjonsnummer,
          name: entity.navn,
          organizationForm: entity.organisasjonsform?.beskrivelse || null,
          address: entity.forretningsadresse
            ? {
                street: entity.forretningsadresse.adresse?.join(", ") || null,
                postalCode: entity.forretningsadresse.postnummer || null,
                city: entity.forretningsadresse.poststed || null,
                municipality: entity.forretningsadresse.kommune || null,
              }
            : null,
          website: entity.hjemmeside || null,
          industry: entity.naeringskode1?.beskrivelse || null,
          rawData: entity, // Store for future AI analysis
        });
      } catch (error: unknown) {
        request.log.error({ err: error }, "Error fetching from brreg.no");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}

