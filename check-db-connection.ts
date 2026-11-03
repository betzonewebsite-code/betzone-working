import { db } from "./src/lib/server/db";

async function main() {
  try {
    const result = await db.$queryRaw`SELECT current_database() AS database, current_user AS username`;
    console.log(result);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
