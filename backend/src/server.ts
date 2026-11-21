import "./config/loadEnv"; // must stay first: populates process.env before other modules read it
import { validateRequiredEnv } from "./config/env";
import app from "./app";

// Fail closed: refuse to start with a missing/weak JWT secret.
validateRequiredEnv();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});
