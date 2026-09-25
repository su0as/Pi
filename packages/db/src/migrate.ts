import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  await client.end();

  console.info("Migrations applied.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
