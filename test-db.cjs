require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function test() {
  try {
    const result = await db.$queryRaw`SELECT 1 AS result`;
    console.log("DATABASE CONNECTION SUCCESS:", result);
  } catch (error) {
    console.error("DATABASE CONNECTION FAILED:", error.message);
  } finally {
    await db.$disconnect();
  }
}

test();