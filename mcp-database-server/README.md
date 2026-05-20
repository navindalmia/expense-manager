# MCP Database Server

**Model Context Protocol Database Server** for Expense Manager PostgreSQL database.

This MCP server provides direct database query capabilities for validating data consistency during testing and development.

## Purpose

When testing frontend (Maestro E2E tests) or making changes to the backend, I can independently query the database to:
- Verify data is saved correctly
- Check database state after frontend actions
- Validate all fields are persisted properly
- Answer ad-hoc queries about data

## Installation

```bash
cd mcp-database-server
npm install
```

## Configuration

Set environment variables or use defaults:

```bash
DB_USER=expensemanager          # Default: expensemanager
DB_PASSWORD=password123         # Default: password123
DB_HOST=localhost               # Default: localhost
DB_PORT=5432                    # Default: 5432
DB_NAME=expensemanager          # Default: expensemanager
```

## Running the Server

```bash
npm start
```

Or with file watching:

```bash
npm run dev
```

## Available Tools

### 1. `query_email_verification_state`
Get complete email verification state for a user.

**Input:**
```json
{
  "email": "user@example.com"
}
```

**Returns:**
- userId, email, emailVerified, emailVerifiedAt
- Active token count
- All tokens for the user with status
- Last token expiry

**Use Case:** After Maestro test creates a user, verify they're in the database with correct state.

---

### 2. `query_verification_tokens`
Get all verification tokens for a user.

**Input:**
```json
{
  "email": "user@example.com"
}
```

**Returns:**
- Token list with: token, isUsed, expiresAt, createdAt
- Total token count

**Use Case:** Verify new token was created after resend, or check why verification failed.

---

### 3. `query_user_by_email`
Get full user record.

**Input:**
```json
{
  "email": "user@example.com"
}
```

**Returns:** Complete User object with all fields.

**Use Case:** Debug account state, check password hash, timestamps, etc.

---

### 4. `query_all_test_users`
Get all test users (pattern: e2e-test-*@example.com).

**Returns:** List of all test users with creation timestamps.

**Use Case:** Verify test cleanup worked, see test user retention.

---

### 5. `query_unverified_users`
Get all unverified users (limit 20).

**Returns:** Users with emailVerified = false.

**Use Case:** Ensure login blocking works (unverified users can't access app).

---

### 6. `query_custom_sql`
Execute custom SQL query (SELECT only).

**Input:**
```json
{
  "sql": "SELECT * FROM \"EmailVerificationToken\" WHERE \"isUsed\" = true LIMIT 5"
}
```

**Returns:** Query results.

**Use Case:** Complex queries for debugging specific scenarios.

---

### 7. `get_database_stats`
Overall statistics for email verification feature.

**Returns:**
- Total users
- Verified users
- Unverified users
- Total tokens
- Unused (active) tokens

**Use Case:** Quick health check of the system.

---

## Usage Examples

### Scenario 1: Verify Signup Created User
Frontend test: User signs up with email "e2e-test-123@example.com"

Query:
```
Tool: query_email_verification_state
Email: e2e-test-123@example.com
```

Expected Response:
```json
{
  "userId": 42,
  "email": "e2e-test-123@example.com",
  "emailVerified": false,
  "emailVerifiedAt": null,
  "activeTokenCount": 1,
  "lastTokenExpiry": "2026-05-21T19:30:00.000Z",
  "tokens": [
    {
      "id": 7,
      "token": "vrf_abc123...",
      "isUsed": false,
      "expiresAt": "2026-05-21T19:30:00.000Z",
      "createdAt": "2026-05-20T19:30:00.000Z"
    }
  ]
}
```

✅ Confirms: User created, token generated, not yet verified.

---

### Scenario 2: Verify Email After Deep Link Click
Frontend test: User clicks deep link, should be verified.

Query:
```
Tool: query_email_verification_state
Email: e2e-test-123@example.com
```

Expected Response:
```json
{
  "userId": 42,
  "email": "e2e-test-123@example.com",
  "emailVerified": true,
  "emailVerifiedAt": "2026-05-20T19:31:00.000Z",
  "activeTokenCount": 0,
  "tokens": [
    {
      "id": 7,
      "token": "vrf_abc123...",
      "isUsed": true,
      "expiresAt": "2026-05-21T19:30:00.000Z",
      "createdAt": "2026-05-20T19:30:00.000Z"
    }
  ]
}
```

✅ Confirms: emailVerified=true, token marked isUsed=true, emailVerifiedAt set.

---

### Scenario 3: Answer Ad-Hoc Question
"How many users are still unverified?"

Query:
```
Tool: get_database_stats
```

Response:
```json
{
  "totalUsers": 156,
  "verifiedUsers": 148,
  "unverifiedUsers": 8,
  "totalTokens": 43,
  "unusedTokens": 5
}
```

✅ Quick answer without running manual queries.

---

## Integration with Copilot

Once running, this MCP server can be used by Copilot to:
1. Query database during testing
2. Verify data consistency
3. Answer questions about saved data
4. Validate test assertions

### Configuration File (Optional)

Create `.mcpservers.json` in the root of the repo:

```json
{
  "databaseServer": {
    "command": "node",
    "args": ["./mcp-database-server/server.js"],
    "disabled": false,
    "alwaysAllow": []
  }
}
```

This allows auto-connection in Copilot environments.

---

## Database Schema Reference

### User Table
```
id, email, name, password, emailVerified, emailVerifiedAt, 
failedLoginAttempts, lockedUntil, lastLogin, isActive, createdAt, updatedAt
```

### EmailVerificationToken Table
```
id, userId, token, expiresAt, isUsed, createdAt
```

---

## Security

- ✅ Read-only access only (SELECT queries)
- ✅ Parameterized queries (prevents SQL injection)
- ✅ Custom SQL restricted to SELECT
- ✅ No ability to modify or delete data

---

## Troubleshooting

### "Error: Connection failed"
Check PostgreSQL is running:
```bash
docker ps | grep postgres
```

### "Error: Unknown database"
Ensure `expensemanager` database exists:
```bash
psql -U expensemanager -h localhost -c "CREATE DATABASE expensemanager;"
```

### "Error: relation does not exist"
Ensure migrations have run:
```bash
cd backend
npx prisma migrate deploy
```

---
