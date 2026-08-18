import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/migrations',
  // Generation is offline; migration still requires callers to provide a real URL.
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://localhost/securecontract' },
});
