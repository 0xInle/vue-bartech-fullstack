import { Module } from "@nestjs/common";
import { OrganizationLifecycleModule } from "../organizations/organization-lifecycle.module.js";
import { CompanyLifecycleWorker } from "./company-lifecycle.worker.js";

@Module({
  imports: [OrganizationLifecycleModule],
  providers: [CompanyLifecycleWorker],
})
export class CompanyLifecycleWorkerModule {}
