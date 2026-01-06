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
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

export default async function vendorRoutes(fastify: FastifyInstance) {
  // Search brreg.no for companies
  fastify.get<{
    Querystring: { query: string };
  }>(
    "/search",
    { preHandler: [authenticate] },
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
          request.log.error(`Brreg API error: ${response.status} ${response.statusText}`);
          return reply.status(502).send({ error: "Failed to search company registry" });
        }

        const data = await response.json() as BrregSearchResponse;
        
        // Transform the response to a simpler format
        const results = data._embedded?.enheter.map((entity) => ({
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
        })) || [];

        return reply.send({
          results,
          total: data.page.totalElements,
        });
      } catch (error: unknown) {
        request.log.error({ err: error }, "Error searching brreg.no");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // Get detailed information for a specific organization number
  fastify.get<{
    Params: { orgNumber: string };
  }>(
    "/brreg/:orgNumber",
    { preHandler: [authenticate] },
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

