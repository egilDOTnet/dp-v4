/**
 * Utility to ensure test database exists before running tests
 * This prevents connection errors when the database hasn't been created yet
 */

import { execSync } from "child_process";
import { resolve } from "path";

/**
 * Extracts detailed error information from PostgreSQL connection errors
 */
function extractErrorDetails(error: any): {
  code?: string;
  message: string;
  cause?: string;
  type: "connection_refused" | "timeout" | "auth_failed" | "database_not_found" | "unknown";
} {
  // Handle AggregateError (can contain multiple errors)
  if (error instanceof AggregateError && error.errors && error.errors.length > 0) {
    // Use the first error from the aggregate
    error = error.errors[0];
  }

  const code = error.code || error.cause?.code || error.errno?.toString();
  let message = error.message || error.cause?.message;
  
  // If message is still not helpful, try to extract from errors array or stringify
  if (!message || message === "AggregateError") {
    if (error.errors && error.errors.length > 0) {
      message = error.errors[0]?.message || String(error.errors[0]);
    } else {
      message = String(error);
    }
  }
  
  // If we still don't have a message, use the error code or a default
  if (!message || message === "AggregateError") {
    message = code ? `Error code: ${code}` : "Unknown error";
  }
  
  const cause = error.cause?.message || error.cause;

  let type: "connection_refused" | "timeout" | "auth_failed" | "database_not_found" | "unknown" = "unknown";

  if (code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
    type = "connection_refused";
  } else if (code === "ETIMEDOUT" || message.includes("timeout") || message.includes("ETIMEDOUT")) {
    type = "timeout";
  } else if (code === "28P01" || message.includes("password authentication failed") || message.includes("authentication failed")) {
    type = "auth_failed";
  } else if (code === "3D000" || message.includes("does not exist")) {
    type = "database_not_found";
  } else if (code === "EPERM" || message.includes("EPERM")) {
    // EPERM is often a connection issue, treat as connection_refused
    type = "connection_refused";
  }

  return { code, message, cause, type };
}

/**
 * Retries a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`   Retry attempt ${attempt}/${maxAttempts} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Checks if PostgreSQL server is accessible by connecting to the 'postgres' database
 */
async function checkPostgreSQLAvailability(postgresUrl: string): Promise<void> {
  const { Pool } = await import("pg");
  const url = new URL(postgresUrl);
  const host = url.hostname;
  const port = url.port || "5432";

  console.log(`🔍 Checking PostgreSQL availability at ${host}:${port}...`);

  const pool = new Pool({
    connectionString: postgresUrl,
    connectionTimeoutMillis: 10000, // 10s timeout for initial connection check
  });

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log(`✅ PostgreSQL server is accessible`);
  } catch (error: any) {
    const details = extractErrorDetails(error);

    let troubleshooting = "";
    switch (details.type) {
      case "connection_refused":
        troubleshooting = `PostgreSQL is not running or not accessible at ${host}:${port}.\n` +
          `  - Start PostgreSQL: docker-compose up -d postgres\n` +
          `  - Or start your local PostgreSQL service\n` +
          `  - Check if PostgreSQL is running on a different port`;
        break;
      case "timeout":
        troubleshooting = `Connection to PostgreSQL timed out at ${host}:${port}.\n` +
          `  - Check if PostgreSQL is running: docker-compose ps\n` +
          `  - Verify network connectivity\n` +
          `  - Check firewall settings`;
        break;
      case "auth_failed":
        troubleshooting = `Authentication failed for PostgreSQL at ${host}:${port}.\n` +
          `  - Check username and password in connection string\n` +
          `  - Verify PostgreSQL user credentials\n` +
          `  - Check pg_hba.conf configuration`;
        break;
      default:
        troubleshooting = `Unable to connect to PostgreSQL at ${host}:${port}.\n` +
          `  - Error code: ${details.code || "unknown"}\n` +
          `  - Error message: ${details.message}\n` +
          `  - Start PostgreSQL: docker-compose up -d postgres`;
    }

    throw new Error(
      `❌ PostgreSQL server is not accessible\n` +
      `   ${troubleshooting}\n` +
      `   Connection string: ${postgresUrl.replace(/:[^:@]+@/, ":****@")}`
    );
  } finally {
    await pool.end();
  }
}

/**
 * Ensures the test database exists and has migrations applied
 * This is called before connecting to the database in test setup
 */
export async function ensureTestDatabase(testDbUrl: string): Promise<void> {
  try {
    // Extract database name from URL for safety check
    const url = new URL(testDbUrl);
    const dbName = url.pathname.replace("/", "");
    const host = url.hostname;
    const port = url.port || "5432";

    // Safety check: ensure we're using a test database
    if (!dbName.includes("test") && !dbName.includes("_test")) {
      throw new Error(
        `⚠️  SAFETY CHECK FAILED: Test database name must contain 'test'. ` +
          `Current database: ${dbName}. ` +
          `This prevents accidentally deleting production/development data.`
      );
    }

    console.log(`🔍 Ensuring test database '${dbName}' exists at ${host}:${port}...`);

    // First, verify PostgreSQL server is accessible
    const postgresUrl = new URL(testDbUrl);
    postgresUrl.pathname = "/postgres";
    
    await checkPostgreSQLAvailability(postgresUrl.toString());

    // Check if we can connect to the database
    // If connection fails, try to create it
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: testDbUrl,
      connectionTimeoutMillis: 10000, // Increased to 10s
    });

    try {
      // Try to connect to the test database with retry logic
      await retryWithBackoff(async () => {
        const client = await pool.connect();
        await client.query("SELECT 1");
        client.release();
      }, 3, 1000);
      
      // Database exists and is accessible
      console.log(`✅ Test database '${dbName}' is accessible`);
      return;
    } catch (connectError: any) {
      // Connection failed - database might not exist
      const errorDetails = extractErrorDetails(connectError);
      
      // If it's a database not found error, try to create it
      if (errorDetails.type === "database_not_found") {
        console.log(`⚠️  Test database '${dbName}' does not exist, attempting to create it...`);
      } else {
        // For other errors, log but still try to create (might be transient)
        console.log(`⚠️  Cannot connect to test database '${dbName}' (${errorDetails.code || "unknown"}), attempting to create it...`);
      }

      // Connect to postgres database to create the test database
      const postgresPool = new Pool({
        connectionString: postgresUrl.toString(),
        connectionTimeoutMillis: 10000, // Increased to 10s
      });

      try {
        // Use retry logic for connecting to postgres database
        const postgresClient = await retryWithBackoff(async () => {
          return await postgresPool.connect();
        }, 3, 1000);

        // Check if database exists
        const dbCheck = await postgresClient.query(
          "SELECT 1 FROM pg_database WHERE datname = $1",
          [dbName]
        );

        if (dbCheck.rows.length === 0) {
          // Database doesn't exist, create it
          console.log(`📦 Creating test database '${dbName}'...`);
          await postgresClient.query(`CREATE DATABASE ${dbName}`);
          console.log(`✅ Test database '${dbName}' created`);
        } else {
          console.log(`✅ Test database '${dbName}' exists`);
        }

        postgresClient.release();

        // Now run migrations on the test database
        console.log(`🔄 Applying migrations to test database...`);
        const dbPackagePath = resolve(__dirname, "../../../../../packages/db");

        try {
          execSync(`pnpm prisma migrate deploy`, {
            cwd: dbPackagePath,
            env: {
              ...process.env,
              DATABASE_URL: testDbUrl,
            },
            stdio: "pipe",
          });
          console.log(`✅ Migrations applied successfully`);
        } catch (migrationError: any) {
          // Migration errors are non-fatal - database might already have schema
          const migrationDetails = extractErrorDetails(migrationError);
          console.warn(`⚠️  Migration deployment warning:`, migrationDetails.message);
          console.warn(`   Tests may still run if database schema is already up-to-date`);
        }
      } catch (createError: any) {
        const errorDetails = extractErrorDetails(createError);
        
        let troubleshooting = "";
        switch (errorDetails.type) {
          case "connection_refused":
            troubleshooting = `PostgreSQL server is not running or not accessible.\n` +
              `  - Start PostgreSQL: docker-compose up -d postgres\n` +
              `  - Or start your local PostgreSQL service`;
            break;
          case "timeout":
            troubleshooting = `Connection to PostgreSQL timed out.\n` +
              `  - Check if PostgreSQL is running: docker-compose ps\n` +
              `  - Verify network connectivity`;
            break;
          case "auth_failed":
            troubleshooting = `Authentication failed.\n` +
              `  - Check username and password in connection string\n` +
              `  - Verify PostgreSQL user credentials`;
            break;
          default:
            troubleshooting = `Failed to create test database.\n` +
              `  - Error code: ${errorDetails.code || "unknown"}\n` +
              `  - Error message: ${errorDetails.message}`;
        }

        throw new Error(
          `❌ Failed to create test database '${dbName}'\n` +
          `   ${troubleshooting}\n` +
          `   Connection attempted: ${testDbUrl.replace(/:[^:@]+@/, ":****@")}\n` +
          `   You can also run: pnpm --filter @dp/db db:setup-test`
        );
      } finally {
        await postgresPool.end();
      }
    } finally {
      await pool.end();
    }
  } catch (error: any) {
    // If automatic creation fails, provide helpful error message
    if (error.message.includes("SAFETY CHECK FAILED")) {
      throw error;
    }

    // Extract error details for better error messages
    const errorDetails = extractErrorDetails(error);
    
    // If error already has detailed troubleshooting, just re-throw it
    if (error.message.includes("❌")) {
      throw error;
    }

    // Otherwise, provide generic but helpful error
    throw new Error(
      `❌ Failed to ensure test database exists\n` +
      `   Error code: ${errorDetails.code || "unknown"}\n` +
      `   Error message: ${errorDetails.message}\n` +
      `   Make sure PostgreSQL is running.\n` +
      `   If using Docker: docker-compose up -d postgres\n` +
      `   You can also manually run: pnpm --filter @dp/db db:setup-test`
    );
  }
}

