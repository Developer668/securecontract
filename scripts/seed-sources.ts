import { PostgresRepository } from "../db/repository.js";
import { liveSources } from "../src/data/live-sources.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const repository = new PostgresRepository(connectionString);
try {
  await repository.upsertSources(liveSources);
  console.log(`Seeded ${liveSources.length} verified/draft source definitions.`);
} finally {
  await repository.close();
}
