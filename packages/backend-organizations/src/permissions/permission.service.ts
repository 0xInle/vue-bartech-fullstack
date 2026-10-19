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
const TEMPORARY_OPERATIONAL_PERMISSIONS: PermissionCode[] = [
  "manage_products",
  "manage_product_archive",
  "invite_employees",
  "invite_bar_manager",
  "manage_team",
  "manage_delegated_permissions",
  "manage_schedule",
];
const BAR_MANAGER_PERMISSIONS: PermissionCode[] = [
  ...READ_PERMISSIONS,
  "manage_products",
  "manage_product_archive",
  "delete_products_permanently",
  "export_data",
  "invite_employees",
  "invite_bar_manager",
  "invite_chef_bartender",
  "create_venues",
  "manage_team",
  "manage_delegated_permissions",
  "manage_venue",
  "view_history",
  "manage_schedule",
];
const CHEF_BARTENDER_PERMISSIONS: PermissionCode[] = [
  ...READ_PERMISSIONS,
  "export_data",
  "invite_employees",
  "invite_bar_manager",
  "invite_chef_bartender",
  "manage_team",
  "manage_venues",
  "manage_company",
  "view_history",
];

export type PermissionEvaluationInput = {
  role: WorkspaceRole;
  delegatedPermissions?: string[];
  temporaryResponsibility?: boolean;
  hasBarManager?: boolean;
  hasChefBartender?: boolean;
};

@Injectable()
export class PermissionService {
  evaluate(input: PermissionEvaluationInput): PermissionCode[] {
    const permissions = new Set<PermissionCode>(READ_PERMISSIONS);

    if (input.role === "bar_manager") {
      BAR_MANAGER_PERMISSIONS.forEach((permission) => permissions.add(permission));
      if (!input.hasChefBartender) permissions.add("manage_company");
      return [...permissions];
    }

    if (input.role === "chef_bartender") {
      CHEF_BARTENDER_PERMISSIONS.forEach((permission) => permissions.add(permission));
      if (!input.hasBarManager) {
        TEMPORARY_OPERATIONAL_PERMISSIONS.forEach((permission) => permissions.add(permission));
      }
      return [...permissions];
    }

    for (const permission of input.delegatedPermissions ?? []) {
      if (isPermissionCode(permission) && isDelegatablePermission(permission)) {
        permissions.add(permission);
      }
    }

    if (input.temporaryResponsibility && !input.hasBarManager && !input.hasChefBartender) {
      TEMPORARY_OPERATIONAL_PERMISSIONS.forEach((permission) => permissions.add(permission));
    }

    return [...permissions];
  }
}

function isPermissionCode(value: string): value is PermissionCode {
  return Object.hasOwn(permissionCatalog, value);
}

function isDelegatablePermission(permission: PermissionCode): boolean {
  return DELEGATABLE_PERMISSION_CODES.includes(
    permission as (typeof DELEGATABLE_PERMISSION_CODES)[number],
  );
}
