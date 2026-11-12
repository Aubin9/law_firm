import { describe, it, expect } from "vitest";
import {
  ROLES,
  ROLE_DEFINITIONS,
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSIONS_MATRIX,
  getPermissionsForRole,
  hasRolePermission,
} from "@/server/auth/permission-matrix";

describe("Permission Matrix & Canonical Roles (PERMISSIONS.md)", () => {
  it("defines exactly the 7 required canonical roles", () => {
    expect(ROLES).toHaveLength(7);
    expect(ROLES).toContain("PARTNER");
    expect(ROLES).toContain("LEAD_LAWYER");
    expect(ROLES).toContain("ASSOCIATE_LAWYER");
    expect(ROLES).toContain("SECRETARY");
    expect(ROLES).toContain("ACCOUNTANT");
    expect(ROLES).toContain("FUNCTIONAL_ADMIN");
    expect(ROLES).toContain("TECHNICAL_ADMIN");

    for (const roleKey of ROLES) {
      expect(ROLE_DEFINITIONS[roleKey]).toBeDefined();
      expect(ROLE_DEFINITIONS[roleKey].nameFr).toBeTruthy();
      expect(ROLE_DEFINITIONS[roleKey].nameEn).toBeTruthy();
    }
  });

  it("has unique permission keys across all definitions", () => {
    const keys = PERMISSION_DEFINITIONS.map((p) => p.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it("ensures all role-assigned permissions exist in PERMISSION_DEFINITIONS", () => {
    const validPermKeys = new Set(PERMISSION_DEFINITIONS.map((p) => p.key));

    for (const [roleKey, assignedKeys] of Object.entries(ROLE_PERMISSIONS_MATRIX)) {
      for (const key of assignedKeys) {
        expect(
          validPermKeys.has(key),
          `Role ${roleKey} references undefined permission key "${key}"`
        ).toBe(true);
      }
    }
  });

  it("enforces critical role boundaries from PERMISSIONS.md", () => {
    // Only PARTNER can waive conflicts
    expect(hasRolePermission("PARTNER", "conflict.waive")).toBe(true);
    expect(hasRolePermission("LEAD_LAWYER", "conflict.waive")).toBe(false);
    expect(hasRolePermission("ASSOCIATE_LAWYER", "conflict.waive")).toBe(false);
    expect(hasRolePermission("SECRETARY", "conflict.waive")).toBe(false);
    expect(hasRolePermission("ACCOUNTANT", "conflict.waive")).toBe(false);
    expect(hasRolePermission("FUNCTIONAL_ADMIN", "conflict.waive")).toBe(false);
    expect(hasRolePermission("TECHNICAL_ADMIN", "conflict.waive")).toBe(false);

    // Only lawyers can validate procedural deadlines
    expect(hasRolePermission("PARTNER", "deadline.validate")).toBe(true);
    expect(hasRolePermission("LEAD_LAWYER", "deadline.validate")).toBe(true);
    expect(hasRolePermission("ASSOCIATE_LAWYER", "deadline.validate")).toBe(true);
    expect(hasRolePermission("SECRETARY", "deadline.validate")).toBe(false);
    expect(hasRolePermission("ACCOUNTANT", "deadline.validate")).toBe(false);

    // Only TECHNICAL_ADMIN can manage backups directly
    expect(hasRolePermission("TECHNICAL_ADMIN", "backup.run")).toBe(true);
    expect(hasRolePermission("PARTNER", "backup.run")).toBe(false);
    expect(hasRolePermission("FUNCTIONAL_ADMIN", "backup.run")).toBe(false);

    // Accountant has invoice & fee management, but no matter creation
    expect(hasRolePermission("ACCOUNTANT", "invoice.create")).toBe(true);
    expect(hasRolePermission("ACCOUNTANT", "payment.validate")).toBe(true);
    expect(hasRolePermission("ACCOUNTANT", "matter.create")).toBe(false);

    // Functional admin manages workflows and references
    expect(hasRolePermission("FUNCTIONAL_ADMIN", "workflow.edit")).toBe(true);
    expect(hasRolePermission("FUNCTIONAL_ADMIN", "reference.edit")).toBe(true);
    expect(hasRolePermission("ASSOCIATE_LAWYER", "workflow.edit")).toBe(false);
  });

  it("properly retrieves assigned keys via getPermissionsForRole", () => {
    const partnerPerms = getPermissionsForRole("PARTNER");
    expect(partnerPerms.length).toBeGreaterThan(50);
    expect(partnerPerms).toContain("transfer.approve");
    expect(partnerPerms).toContain("matter.validate_closure");
  });
});

