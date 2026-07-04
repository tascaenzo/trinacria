if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const argon2 = require("argon2");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const sessionExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [adminPasswordHash, editorPasswordHash, viewerPasswordHash] =
    await Promise.all([
      argon2.hash("dev-password"),
      argon2.hash("editor-password"),
      argon2.hash("viewer-password"),
    ]);

  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        id: "user_admin_1",
        email: "admin@trinacria.dev",
        name: "Playground Admin",
        role: "admin",
        passwordHash: adminPasswordHash,
      },
      {
        id: "user_editor_1",
        email: "editor@trinacria.dev",
        name: "Playground Editor",
        role: "editor",
        passwordHash: editorPasswordHash,
      },
      {
        id: "user_viewer_1",
        email: "viewer@trinacria.dev",
        name: "Playground Viewer",
        role: "user",
        passwordHash: viewerPasswordHash,
      },
    ],
  });

  await prisma.authSession.createMany({
    data: [
      {
        sid: "seed_session_admin",
        csrfToken: "seed_csrf_admin",
        expiresAt: sessionExpiry,
        userId: "user_admin_1",
      },
      {
        sid: "seed_session_editor",
        csrfToken: "seed_csrf_editor",
        expiresAt: sessionExpiry,
        userId: "user_editor_1",
      },
    ],
  });

  console.log("Seed completed: users and auth sessions created.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
