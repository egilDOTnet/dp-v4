import { describe, it, expect, vi, beforeEach } from "vitest";
import { FastifyRequest, FastifyReply, FastifyError } from "fastify";
import { errorHandler } from "../../middleware/error-handler";
import { ZodError, ZodIssue } from "zod";

describe("Error Handler Middleware", () => {
  let mockRequest: FastifyRequest;
  let mockReply: FastifyReply;
  let statusCode: number | undefined;
  let responseBody: any;
  let logErrorCalled = false;
  let logErrorArgs: any[] = [];

  beforeEach(() => {
    statusCode = undefined;
    responseBody = undefined;
    logErrorCalled = false;
    logErrorArgs = [];

    mockRequest = {
      log: {
        error: vi.fn((...args: any[]) => {
          logErrorCalled = true;
          logErrorArgs = args;
        }),
      },
    } as unknown as FastifyRequest;

    mockReply = {
      status: (code: number) => ({
        send: (data: any) => {
          statusCode = code;
          responseBody = data;
          return { statusCode: code, body: data };
        },
      }),
    } as unknown as FastifyReply;
  });

  describe("Zod validation errors", () => {
    it("should handle Zod validation errors with 400 status", () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["email"],
          message: "Expected string, received number",
        } as ZodIssue,
        {
          code: "too_small",
          minimum: 1,
          type: "array",
          inclusive: true,
          path: ["items"],
          message: "Array must contain at least 1 element",
        } as ZodIssue,
      ]);

      errorHandler(zodError, mockRequest, mockReply);

      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({
        error: "Validation error",
        details: zodError.errors,
      });
      expect(logErrorCalled).toBe(false); // Should not log Zod errors
    });

    it("should handle Zod errors with multiple validation issues", () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
          path: ["name"],
          message: "Required",
        } as ZodIssue,
        {
          code: "invalid_type",
          expected: "email",
          received: "string",
          path: ["email"],
          message: "Invalid email",
        } as ZodIssue,
      ]);

      errorHandler(zodError, mockRequest, mockReply);

      expect(statusCode).toBe(400);
      expect(responseBody.error).toBe("Validation error");
      expect(responseBody.details).toHaveLength(2);
      expect(responseBody.details[0].path).toEqual(["name"]);
      expect(responseBody.details[1].path).toEqual(["email"]);
    });
  });

  describe("Fastify schema validation errors", () => {
    it("should handle Fastify schema validation errors with 400 status", () => {
      const fastifyError: FastifyError = {
        name: "FastifyError",
        message: "Body cannot be empty when required",
        statusCode: 400,
        code: "FST_ERR_VALIDATION",
      } as FastifyError;

      errorHandler(fastifyError, mockRequest, mockReply);

      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({
        error: "Body cannot be empty when required",
      });
      expect(logErrorCalled).toBe(false); // Should not log validation errors
    });

    it("should handle Fastify validation errors with default message", () => {
      const fastifyError: FastifyError = {
        name: "FastifyError",
        message: "",
        statusCode: 400,
        code: "FST_ERR_VALIDATION",
      } as FastifyError;

      errorHandler(fastifyError, mockRequest, mockReply);

      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({
        error: "Validation error",
      });
    });

    it("should handle Fastify errors with statusCode 400 but different error structure", () => {
      const fastifyError = {
        statusCode: 400,
        message: "Invalid request parameters",
      } as FastifyError;

      errorHandler(fastifyError, mockRequest, mockReply);

      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({
        error: "Invalid request parameters",
      });
    });
  });

  describe("Generic errors", () => {
    it("should handle generic errors with 500 status and log them", () => {
      const genericError = new Error("Something went wrong");

      errorHandler(genericError, mockRequest, mockReply);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        error: "Internal server error",
      });
      expect(logErrorCalled).toBe(true);
      expect(logErrorArgs[0]).toBe(genericError);
    });

    it("should handle errors without message", () => {
      const error = new Error();

      errorHandler(error, mockRequest, mockReply);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        error: "Internal server error",
      });
      expect(logErrorCalled).toBe(true);
    });

    it("should handle database errors", () => {
      const dbError = new Error("Database connection failed");
      dbError.name = "DatabaseError";

      errorHandler(dbError, mockRequest, mockReply);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        error: "Internal server error",
      });
      expect(logErrorCalled).toBe(true);
    });

    it("should handle errors with custom properties", () => {
      const customError = new Error("Custom error") as any;
      customError.customProperty = "custom value";
      customError.code = "CUSTOM_ERROR";

      errorHandler(customError, mockRequest, mockReply);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        error: "Internal server error",
      });
      expect(logErrorCalled).toBe(true);
    });
  });

  describe("Error priority", () => {
    it("should prioritize Zod errors over Fastify errors", () => {
      const zodError = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["test"],
          message: "Expected string",
        } as ZodIssue,
      ]);

      // Even if it has statusCode 400, Zod should be handled first
      const errorWithStatusCode = zodError as any;
      errorWithStatusCode.statusCode = 400;

      errorHandler(errorWithStatusCode, mockRequest, mockReply);

      expect(statusCode).toBe(400);
      expect(responseBody.error).toBe("Validation error");
      expect(responseBody.details).toBeDefined();
    });

    it("should handle Fastify errors before generic errors", () => {
      const fastifyError: FastifyError = {
        name: "FastifyError",
        message: "Validation failed",
        statusCode: 400,
      } as FastifyError;

      errorHandler(fastifyError, mockRequest, mockReply);

      expect(statusCode).toBe(400);
      expect(responseBody.error).toBe("Validation failed");
      expect(logErrorCalled).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle null error gracefully", () => {
      const nullError = null as any;

      errorHandler(nullError, mockRequest, mockReply);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        error: "Internal server error",
      });
      expect(logErrorCalled).toBe(true);
    });

    it("should handle undefined error gracefully", () => {
      const undefinedError = undefined as any;

      errorHandler(undefinedError, mockRequest, mockReply);

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        error: "Internal server error",
      });
      expect(logErrorCalled).toBe(true);
    });

    it("should handle error without log object", () => {
      const requestWithoutLog = {} as FastifyRequest;
      const error = new Error("Test error");

      // Should not throw even if log is missing
      expect(() => {
        errorHandler(error, requestWithoutLog, mockReply);
      }).not.toThrow();

      expect(statusCode).toBe(500);
      expect(responseBody).toEqual({
        error: "Internal server error",
      });
    });
  });
});




