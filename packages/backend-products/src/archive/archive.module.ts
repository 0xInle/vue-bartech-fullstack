import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { ArchiveReadRepository } from "./archive-read.repository.js";
import { ArchiveReadService } from "./archive-read.service.js";
import { ArchiveMutationRepository } from "./archive-mutation.repository.js";
import { ArchiveMutationService } from "./archive-mutation.service.js";

@Module({
  imports: [OrganizationsModule],
  providers: [
    ArchiveReadRepository,
    ArchiveReadService,
    ArchiveMutationRepository,
    ArchiveMutationService,
  ],
  exports: [ArchiveReadService, ArchiveMutationService],
})
export class ArchiveModule {}
