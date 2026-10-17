export { PrismaClient } from "./generated/client/client.js";
export { Prisma } from "./generated/client/client.js";
export * from "./generated/client/enums.js";

export const DATABASE_CLIENT = Symbol.for("@bartech/database/client");
export const REDIS_CLIENT = Symbol.for("@bartech/database/redis");
