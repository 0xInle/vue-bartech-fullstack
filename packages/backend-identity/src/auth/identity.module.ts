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
import { InternalAuthController } from "../internal-auth/internal-auth.controller.js";
import { InternalAuthService } from "../internal-auth/internal-auth.service.js";
import { InternalSessionGuard } from "../internal-auth/internal-session.guard.js";

@Module({
  imports: [OrganizationsModule, OutboxModule],
  controllers: [IdentityController, InternalAuthController],
  providers: [
    AuthenticationService,
    RegistrationService,
    IdentityChallengeService,
    InvitationAcceptanceService,
    InvitationIssuanceService,
    ExpiredDataCleanupService,
    SessionGuard,
    InternalAuthService,
    InternalSessionGuard,
  ],
  exports: [
    InvitationAcceptanceService,
    InvitationIssuanceService,
    ExpiredDataCleanupService,
    SessionGuard,
    InternalAuthService,
    InternalSessionGuard,
  ],
})
export class IdentityModule {}
