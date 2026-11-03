const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function main() {
  const user = await db.user.findUnique({
    where: { email: "betzonewebsite@gmail.com" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true
    }
  });

  if (!user) {
    console.log("Account not found in the local database.");
    return;
  }

  console.log(JSON.stringify({
    ...user,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt)
  }, null, 2));
}

main()
  .catch(error => {
    console.error("Read-only check failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
