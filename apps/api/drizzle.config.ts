import { defineConfig } from 'drizzle-kit';
import { env } from './src/config';

export default defineConfig({
  dialect: 'mssql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  schemaFilter: ['lotrinh'],
  dbCredentials: { url: env().DATABASE_URL },
});
