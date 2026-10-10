export function redactInvitationTokenFromPath(path: string): string {
  return path.replace(/(^|\/)invitations\/[^/?#]+(?=\/?(?:[?#]|$))/iu, "$1invitations/[REDACTED]");
}
