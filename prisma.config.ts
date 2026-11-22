import "dotenv/config";
import { defineConfig } from "prisma/config";

// Generating the client doesn't need a database, so a fresh `npm install`
// works before .env exists. Anything that connects reads DATABASE_URL itself.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
