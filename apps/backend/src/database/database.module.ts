import { Global, Module } from "@nestjs/common";
import { DATABASE_CLIENT, REDIS_CLIENT } from "@bartech/database";
import { PrismaService } from "./prisma.service.js";
import { RedisService } from "./redis.service.js";

@Global()
@Module({
  providers: [
    PrismaService,
    RedisService,
    { provide: DATABASE_CLIENT, useExisting: PrismaService },
    {
      provide: REDIS_CLIENT,
      useFactory: (redis: RedisService) => redis.client,
      inject: [RedisService],
    },
  ],
  exports: [PrismaService, RedisService, DATABASE_CLIENT, REDIS_CLIENT],
})
export class DatabaseModule {}
