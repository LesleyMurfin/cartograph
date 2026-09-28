import { auth } from "@clerk/nextjs/server";

export default async function WorkspacePage() {
  const { orgId, sessionClaims } = await auth();

  // Read off the token, never fetched from Clerk. If the claim is missing the
  // session token hasn't been customised yet, and that should be obvious.
  const orgName = sessionClaims?.org_name;
  if (!orgName) {
    throw new Error(
      'Session token has no org_name claim. Add "org_name": "{{org.name}}" in Clerk → Sessions → Customize session token.',
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="text-xs text-fg-muted">Organization</div>
      <div className="font-medium">{orgName}</div>
      <div className="font-mono text-[11px] text-fg-muted">{orgId}</div>
    </div>
  );
}
