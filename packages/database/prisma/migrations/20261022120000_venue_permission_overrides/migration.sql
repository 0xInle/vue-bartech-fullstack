ALTER TYPE "DelegatedPermissionCode" RENAME TO "PermissionCode";
ALTER TYPE "PermissionCode" ADD VALUE 'VIEW_PRODUCTS';
ALTER TYPE "PermissionCode" ADD VALUE 'VIEW_ARCHIVE';
ALTER TYPE "PermissionCode" ADD VALUE 'VIEW_TEAM';
ALTER TYPE "PermissionCode" ADD VALUE 'INVITE_BAR_MANAGER';
ALTER TYPE "PermissionCode" ADD VALUE 'INVITE_CHEF_BARTENDER';
ALTER TYPE "PermissionCode" ADD VALUE 'MANAGE_TEAM';
ALTER TYPE "PermissionCode" ADD VALUE 'MANAGE_DELEGATED_PERMISSIONS';
ALTER TYPE "PermissionCode" ADD VALUE 'CREATE_VENUES';
ALTER TYPE "PermissionCode" ADD VALUE 'MANAGE_VENUE';
ALTER TYPE "PermissionCode" ADD VALUE 'MANAGE_VENUES';
ALTER TYPE "PermissionCode" ADD VALUE 'MANAGE_COMPANY';
ALTER TYPE "PermissionCode" ADD VALUE 'VIEW_HISTORY';
ALTER TYPE "PermissionCode" ADD VALUE 'VIEW_SCHEDULE';

ALTER TABLE "delegated_permissions" RENAME TO "venue_permission_overrides";
ALTER TABLE "venue_permission_overrides" RENAME COLUMN "grantedByUserId" TO "changedByUserId";
ALTER TABLE "venue_permission_overrides" RENAME COLUMN "grantedAt" TO "changedAt";
ALTER TABLE "venue_permission_overrides" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "venue_permission_overrides" RENAME CONSTRAINT "delegated_permissions_venueMembershipId_fkey"
  TO "venue_permission_overrides_venueMembershipId_fkey";
ALTER TABLE "venue_permission_overrides" RENAME CONSTRAINT "delegated_permissions_grantedByUserId_fkey"
  TO "venue_permission_overrides_changedByUserId_fkey";
ALTER INDEX "delegated_permissions_membership_code_key" RENAME TO "venue_permission_overrides_membership_code_key";
ALTER INDEX "delegated_permissions_granted_by_idx" RENAME TO "venue_permission_overrides_changed_by_idx";
