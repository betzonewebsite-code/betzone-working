require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL }
  }
});

async function test() {
  try {
    const result = await db.$queryRaw`SELECT 1 AS result`;
    console.log("SESSION POOLER SUCCESS:", result);
  } catch (error) {
    console.log("SESSION POOLER FAILED:", error.message);
  } finally {
    await db.$disconnect();
  }
}

test();
