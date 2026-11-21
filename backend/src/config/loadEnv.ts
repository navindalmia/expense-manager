/**
 * Loads .env.local / .env into process.env as an import side effect.
 *
 * Must be the FIRST import of the entrypoint (server.ts): ES imports are
 * hoisted, so any module that reads process.env while it is being imported
 * would otherwise run before dotenv and miss values that live in the files.
 */
import dotenv from 'dotenv';
import path from 'path';

const backendDir = process.cwd();
dotenv.config({ path: path.join(backendDir, '.env.local') });
dotenv.config({ path: path.join(backendDir, '.env') });
