export type VenueOpeningAuthority = {
  userId: string;
  company: {
    initialCreatorUserId: string | null;
    authorityHistoryKnown: boolean;
    managementRoleEverPresent: boolean;
    authorityTransferredEver: boolean;
    memberships: Array<{ userId: string; companyRole: string | null }>;
    venues: Array<{
      memberships: Array<{
        userId: string;
        role: string;
        hasFullManagementPackage: boolean;
      }>;
    }>;
  };
};

export function canOpenAdditionalVenue({ userId, company }: VenueOpeningAuthority): boolean {
  if (
    company.memberships.some(
      (membership) => membership.userId === userId && membership.companyRole === "CHEF_BARTENDER",
    )
  ) {
    return true;
  }

  const memberships = company.venues.flatMap((venue) => venue.memberships);
  if (
    memberships.some(
      (membership) =>
        membership.userId === userId &&
        (membership.role === "BAR_MANAGER" || membership.hasFullManagementPackage),
    )
  ) {
    return true;
  }

  if (
    !company.authorityHistoryKnown ||
    company.managementRoleEverPresent ||
    company.authorityTransferredEver ||
    company.initialCreatorUserId !== userId
  ) {
    return false;
  }

  const ownRoles = memberships
    .filter(({ userId: memberId }) => memberId === userId)
    .map(({ role }) => role);
  const hasSeniorRole = ownRoles.includes("SENIOR_BARTENDER");
  const hasBartenderRole = ownRoles.includes("BARTENDER");
  const companyHasSenior = memberships.some(({ role }) => role === "SENIOR_BARTENDER");
  return hasSeniorRole || (hasBartenderRole && !companyHasSenior);
}
