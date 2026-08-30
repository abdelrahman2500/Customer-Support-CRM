// Idempotent Prisma seed — safe to re-run any number of times.
//
// Creates the first Organization/Branch/Department, the permission
// catalog, baseline roles, and one bootstrap admin user, so
// `POST /api/v1/auth/login` and the new `/api/v1/identity/*` endpoints
// (Story 03) have something real to work against.
//
// Run via `pnpm --filter @crm/api prisma:seed` (wraps `prisma db seed`,
// which loads `apps/api/.env` automatically before running this file).
import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/modules/identity/identity.service";

const prisma = new PrismaClient();

// resource:action — see docs/architecture/05-auth-and-security.md. This
// list is the single source of truth for permission keys; the
// `identity.permissions` table is derived from it, not the other way round.
const PERMISSION_CATALOG = [
  "user:create",
  "user:read",
  "user:update",
  "user:reassign",
  "user:reset-password",
  "role:read",
  "role:create",
  "role:update",
  "role:assign-permissions",
  "permission:read",
  "branch:read",
  "branch:update",
  "department:create",
  "department:update",
  "customer:create",
  "customer:read",
  "customer:update",
  "ticket:create",
  "ticket:read",
  "ticket:update",
  "sla:create",
  "sla:read",
  "sla:update",
  "notification:read",
  "notification:create",
  "notification:update",
  "audit:read",
  "kb:create",
  "kb:read",
  "kb:update",
  "report:read",
  "automation:create",
  "automation:read",
  "automation:update",
  "branding:read",
  "branding:update",
] as const;

// No ticketing/customer/etc. permissions yet — those land with the stories
// that introduce those domains. `Agent` exists as a baseline non-admin role
// so the permission model has more than one role to distinguish from day one.
const ROLE_GRANTS: Record<string, readonly string[]> = {
  SuperAdmin: PERMISSION_CATALOG,
  Agent: [],
};

const DEFAULT_ORGANIZATION_NAME = "Default Organization";
const DEFAULT_BRANCH_NAME = "Main Branch";
const DEFAULT_BRANCH_TIMEZONE = "UTC";
const DEFAULT_DEPARTMENT_NAME = "General";
const ADMIN_ROLE_NAME = "SuperAdmin";

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must both be set (see .env.example) — refusing to seed with a default/hardcoded admin password.",
    );
  }

  // 1. Organization — this is a single-company platform (see
  //    docs/architecture/04-data-and-multitenancy.md), so there is only
  //    ever one row; `Organization.name` has no unique constraint, so we
  //    findFirst rather than upsert.
  const organization =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: DEFAULT_ORGANIZATION_NAME } }));

  // 2. Branch — a `@@unique([organizationId, name])` constraint exists, but we
  //    still findFirst-then-create here rather than upsert, to avoid asserting
  //    an `isActive`/`timezone` update on every re-run.
  const branch =
    (await prisma.branch.findFirst({
      where: { organizationId: organization.id, name: DEFAULT_BRANCH_NAME },
    })) ??
    (await prisma.branch.create({
      data: {
        organizationId: organization.id,
        name: DEFAULT_BRANCH_NAME,
        timezone: DEFAULT_BRANCH_TIMEZONE,
      },
    }));

  // 3. Department — this one DOES have a real `@@unique([branchId, name])`
  //    constraint, so a real upsert works.
  const department = await prisma.department.upsert({
    where: { branchId_name: { branchId: branch.id, name: DEFAULT_DEPARTMENT_NAME } },
    update: {},
    create: { branchId: branch.id, name: DEFAULT_DEPARTMENT_NAME },
  });

  // 4. Permission catalog.
  const permissions = await Promise.all(
    PERMISSION_CATALOG.map((key) =>
      prisma.permission.upsert({ where: { key }, update: {}, create: { key } }),
    ),
  );
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  // 5. Roles + their permission grants — reconciled to exactly match
  //    ROLE_GRANTS on every run (delete then recreate the grant rows for
  //    each role, inside one transaction per role).
  const roleByName = new Map<string, { id: string; name: string }>();
  for (const [roleName, grantedKeys] of Object.entries(ROLE_GRANTS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    roleByName.set(roleName, role);

    const grantedPermissionIds = grantedKeys.map((key) => {
      const id = permissionIdByKey.get(key);
      if (!id) {
        throw new Error(`Role "${roleName}" grants unknown permission "${key}"`);
      }
      return id;
    });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      ...(grantedPermissionIds.length > 0
        ? [
            prisma.rolePermission.createMany({
              data: grantedPermissionIds.map((permissionId) => ({
                roleId: role.id,
                permissionId,
              })),
            }),
          ]
        : []),
    ]);
  }

  // 6. Bootstrap admin user, assigned SuperAdmin in the seeded branch/department.
  const adminRole = roleByName.get(ADMIN_ROLE_NAME);
  if (!adminRole) {
    throw new Error(`Expected "${ADMIN_ROLE_NAME}" to have been seeded as a role above`);
  }

  const passwordHash = await hashPassword(adminPassword);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash, fullName: "Seed Administrator" },
  });

  await prisma.userBranchRole.upsert({
    where: {
      userId_branchId_departmentId_roleId: {
        userId: adminUser.id,
        branchId: branch.id,
        departmentId: department.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      branchId: branch.id,
      departmentId: department.id,
      roleId: adminRole.id,
    },
  });

  console.log(
    [
      "Seed complete:",
      `  organization: ${organization.id} (${organization.name})`,
      `  branch:       ${branch.id} (${branch.name})`,
      `  department:   ${department.id} (${department.name})`,
      `  admin user:   ${adminUser.id} (${adminUser.email})`,
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
