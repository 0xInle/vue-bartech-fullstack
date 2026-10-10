import { Module } from "@nestjs/common";
import { OrganizationsModule } from "@bartech/backend-organizations";
import { IdentityController } from "./identity.controller.js";
import { AuthenticationService } from "./authentication.service.js";
import { RegistrationService } from "./registration.service.js";
import { IdentityChallengeService } from "./identity-challenge.service.js";
import { InvitationAcceptanceService } from "./invitation-acceptance.service.js";
import { InvitationIssuanceService } from "./invitation-issuance.service.js";
import { ExpiredDataCleanupService } from "../outbox/expired-data-cleanup.service.js";
import { SessionGuard } from "./session.guard.js";
import { OutboxModule } from "../outbox/outbox.module.js";

@Module({
  imports: [OrganizationsModule, OutboxModule],
  controllers: [IdentityController],
  providers: [
    AuthenticationService,
    RegistrationService,
    IdentityChallengeService,
    InvitationAcceptanceService,
    InvitationIssuanceService,
    ExpiredDataCleanupService,
    SessionGuard,
  ],
  exports: [
    InvitationAcceptanceService,
    InvitationIssuanceService,
    ExpiredDataCleanupService,
    SessionGuard,
  ],
})
export class IdentityModule {}
