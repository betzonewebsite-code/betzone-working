const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

const expectedId = "cmvniolcj0000lovcqigo0xpl";
const expectedEmail = "betzonewebsite@gmail.com";

async function main() {
  const user = await db.user.findUnique({
    where: { email: expectedEmail },
    select: { id: true, email: true, role: true }
  });

  if (!user || user.id !== expectedId || user.role !== "USER") {
    throw new Error(
      "Safety check failed. No changes made. Recheck the account and role."
    );
  }

  const updated = await db.user.updateMany({
    where: {
      id: expectedId,
      email: expectedEmail,
      role: "USER"
    },
    data: { role: "ADMIN" }
  });

  if (updated.count !== 1) {
    throw new Error("Exactly one account was not updated. Stop and investigate.");
  }

  const verified = await db.user.findUnique({
    where: { id: expectedId },
    select: { id: true, email: true, role: true, status: true }
  });

  console.log("Verified account after update:");
  console.log(JSON.stringify(verified, null, 2));
}

main()
  .catch(error => {
    console.error("Promotion failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
