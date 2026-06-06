
import dotenv from "dotenv";
import path from "path";
import app from "./app";

// Load environment variables from .env.local (or .env as fallback)
// Use process.cwd() to get the backend directory correctly
const backendDir = process.cwd();
dotenv.config({ path: path.join(backendDir, ".env.local") });
dotenv.config({ path: path.join(backendDir, ".env") });

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});
