import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pkg from "pg";
const { Pool } = pkg;

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "admin123",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "expense_db",
});

// Verify connection
await pool.query("SELECT NOW()").catch((err) => {
  console.error("Database connection failed:", err.message);
  process.exit(1);
});

const server = new Server(
  {
    name: "mcp-database-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const tools = [
  {
    name: "query_email_verification_state",
    description:
      "Get email verification state for a user by email address. Returns: userId, email, emailVerified, emailVerifiedAt, active token count, last token expiry.",
    inputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "User email address",
        },
      },
      required: ["email"],
    },
  },
  {
    name: "query_verification_tokens",
    description:
      "Get all verification tokens for a user. Returns: token, isUsed, expiresAt, createdAt.",
    inputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "User email address",
        },
      },
      required: ["email"],
    },
  },
  {
    name: "query_user_by_email",
    description: "Get full user record by email",
    inputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "User email address",
        },
      },
      required: ["email"],
    },
  },
  {
    name: "query_all_test_users",
    description: "Get all test users (pattern: e2e-test-*@example.com)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "query_unverified_users",
    description: "Get all users who haven't verified their email",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "query_custom_sql",
    description:
      "Execute custom SQL query (read-only). Use for complex queries.",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "SQL query to execute (SELECT only)",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "get_database_stats",
    description: "Get overall database statistics for email verification",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request;

  try {
    let result;

    switch (name) {
      case "query_email_verification_state": {
        const { email } = args;
        const userResult = await pool.query(
          `SELECT id, email, "emailVerified", "emailVerifiedAt" FROM "User" WHERE email = $1`,
          [email]
        );

        if (userResult.rows.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No user found with email: ${email}`,
              },
            ],
          };
        }

        const user = userResult.rows[0];
        const tokenResult = await pool.query(
          `SELECT id, token, "isUsed", "expiresAt", "createdAt" FROM "EmailVerificationToken" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
          [user.id]
        );

        result = {
          userId: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
          activeTokenCount: tokenResult.rows.filter((t) => !t.isUsed).length,
          tokens: tokenResult.rows,
          lastTokenExpiry: tokenResult.rows[0]?.expiresAt || null,
        };
        break;
      }

      case "query_verification_tokens": {
        const { email } = args;
        const userResult = await pool.query(
          `SELECT id FROM "User" WHERE email = $1`,
          [email]
        );

        if (userResult.rows.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No user found with email: ${email}`,
              },
            ],
          };
        }

        const tokenResult = await pool.query(
          `SELECT id, token, "isUsed", "expiresAt", "createdAt" FROM "EmailVerificationToken" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
          [userResult.rows[0].id]
        );

        result = {
          email,
          tokenCount: tokenResult.rows.length,
          tokens: tokenResult.rows,
        };
        break;
      }

      case "query_user_by_email": {
        const { email } = args;
        const userResult = await pool.query(
          `SELECT * FROM "User" WHERE email = $1`,
          [email]
        );

        if (userResult.rows.length === 0) {
          result = `No user found with email: ${email}`;
        } else {
          result = userResult.rows[0];
        }
        break;
      }

      case "query_all_test_users": {
        const result_data = await pool.query(
          `SELECT id, name, email, "emailVerified", "emailVerifiedAt", "createdAt" FROM "User" WHERE email LIKE $1 ORDER BY "createdAt" DESC`,
          ["e2e-test-%@example.com"]
        );
        result = {
          count: result_data.rows.length,
          users: result_data.rows,
        };
        break;
      }

      case "query_unverified_users": {
        const result_data = await pool.query(
          `SELECT id, name, email, "createdAt" FROM "User" WHERE "emailVerified" = false ORDER BY "createdAt" DESC LIMIT 20`
        );
        result = {
          count: result_data.rows.length,
          users: result_data.rows,
        };
        break;
      }

      case "query_custom_sql": {
        const { sql } = args;
        // Basic security: only allow SELECT
        if (!sql.trim().toUpperCase().startsWith("SELECT")) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Only SELECT queries are allowed",
              },
            ],
          };
        }

        const result_data = await pool.query(sql);
        result = {
          rowCount: result_data.rows.length,
          rows: result_data.rows,
        };
        break;
      }

      case "get_database_stats": {
        const totalUsers = await pool.query(`SELECT COUNT(*) FROM "User"`);
        const verifiedUsers = await pool.query(
          `SELECT COUNT(*) FROM "User" WHERE "emailVerified" = true`
        );
        const unverifiedUsers = await pool.query(
          `SELECT COUNT(*) FROM "User" WHERE "emailVerified" = false`
        );
        const totalTokens = await pool.query(
          `SELECT COUNT(*) FROM "EmailVerificationToken"`
        );
        const unusedTokens = await pool.query(
          `SELECT COUNT(*) FROM "EmailVerificationToken" WHERE "isUsed" = false`
        );

        result = {
          totalUsers: parseInt(totalUsers.rows[0].count),
          verifiedUsers: parseInt(verifiedUsers.rows[0].count),
          unverifiedUsers: parseInt(unverifiedUsers.rows[0].count),
          totalTokens: parseInt(totalTokens.rows[0].count),
          unusedTokens: parseInt(unusedTokens.rows[0].count),
        };
        break;
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP Database Server running on stdio");
