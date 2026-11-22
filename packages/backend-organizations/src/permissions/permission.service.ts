import { Injectable } from "@nestjs/common";

export const permissionCatalog = {
  view_products: "Просмотр продукции",
  view_archive: "Просмотр архива",
  view_team: "Просмотр команды",
  manage_products: "Управление продукцией",
  manage_product_archive: "Управление архивом продукции",
  delete_products_permanently: "Безвозвратное удаление продукции",
  export_data: "Выгрузка данных",
  invite_employees: "Приглашение сотрудников",
  invite_bar_manager: "Приглашение бар-менеджера",
  invite_chef_bartender: "Приглашение шеф-бармена",
  manage_team: "Управление командой",
  manage_delegated_permissions: "Управление делегированными правами",
  create_venues: "Создание заведений",
  manage_venue: "Управление своим заведением",
  manage_venues: "Управление заведениями компании",
  manage_company: "Управление компанией",
  view_history: "Просмотр истории действий",
  view_schedule: "Просмотр графика сотрудников",
  manage_schedule: "Управление графиком сотрудников",
} as const;

export type PermissionCode = keyof typeof permissionCatalog;
export type WorkspaceRole = "bartender" | "senior_bartender" | "bar_manager" | "chef_bartender";

export const VENUE_PERMISSION_CODES = [
  "view_products",
  "view_archive",
  "view_team",
  "manage_products",
  "manage_product_archive",
  "delete_products_permanently",
  "export_data",
  "invite_employees",
  "invite_bar_manager",
  "manage_team",
  "manage_delegated_permissions",
  "manage_venue",
  "view_schedule",
  "manage_schedule",
] as const satisfies readonly PermissionCode[];

export const DELEGATABLE_PERMISSION_CODES = [
  "manage_products",
  "manage_product_archive",
  "delete_products_permanently",
  "export_data",
  "invite_employees",
  "manage_schedule",
] as const satisfies readonly PermissionCode[];

const READ_PERMISSIONS: PermissionCode[] = [
  "view_products",
  "view_archive",
  "view_team",
  "view_schedule",
];
export const FULL_VENUE_MANAGEMENT_PERMISSIONS: PermissionCode[] = [
  ...READ_PERMISSIONS,
  "manage_products",
  "manage_product_archive",
  "delete_products_permanently",
  "export_data",
  "invite_employees",
  "invite_bar_manager",
  "manage_team",
  "manage_delegated_permissions",
  "create_venues",
  "manage_venue",
  "manage_schedule",
];
export const BAR_MANAGER_PERMISSIONS: PermissionCode[] = [
  ...FULL_VENUE_MANAGEMENT_PERMISSIONS,
  "view_history",
  "invite_chef_bartender",
];
const CHEF_BARTENDER_PERMISSIONS: PermissionCode[] = [
  "invite_chef_bartender",
  "manage_venues",
  "manage_company",
  "view_history",
];

export type PermissionEvaluationInput = {
  role: WorkspaceRole;
  permissionOverrides?: Array<{ code: string; enabled: boolean }>;
  fullVenueManagement?: boolean;
  hasBarManager?: boolean;
  hasChefBartender?: boolean;
};

@Injectable()
export class PermissionService {
  evaluate(input: PermissionEvaluationInput): PermissionCode[] {
    const permissions = new Set<PermissionCode>(READ_PERMISSIONS);

    if (input.role === "bar_manager") {
      BAR_MANAGER_PERMISSIONS.forEach((permission) => permissions.add(permission));
      return permissionsArray(permissions);
    }

    if (input.role === "chef_bartender") {
      CHEF_BARTENDER_PERMISSIONS.forEach((permission) => permissions.add(permission));
      FULL_VENUE_MANAGEMENT_PERMISSIONS.forEach((permission) => permissions.add(permission));
      return permissionsArray(permissions);
    }

    if (input.fullVenueManagement) {
      FULL_VENUE_MANAGEMENT_PERMISSIONS.forEach((permission) => permissions.add(permission));
      return permissionsArray(permissions);
    }

    return applyOverrides(permissions, input.permissionOverrides);
  }
}

function permissionsArray(permissions: Set<PermissionCode>): PermissionCode[] {
  return [...permissions];
}

function applyOverrides(
  defaults: Set<PermissionCode>,
  overrides: PermissionEvaluationInput["permissionOverrides"],
): PermissionCode[] {
  for (const override of overrides ?? []) {
    if (!isPermissionCode(override.code)) continue;
    if (!isVenuePermission(override.code)) continue;
    if (override.enabled) defaults.add(override.code);
    else defaults.delete(override.code);
  }
  return [...defaults];
}

function isPermissionCode(value: string): value is PermissionCode {
  return Object.hasOwn(permissionCatalog, value);
}

export function isVenuePermission(permission: PermissionCode): boolean {
  return VENUE_PERMISSION_CODES.includes(permission as (typeof VENUE_PERMISSION_CODES)[number]);
}
