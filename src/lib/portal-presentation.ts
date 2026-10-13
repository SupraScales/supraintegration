export function formatPortalOrganizationName(name: string) {
  return name.replace(/\s*\(demo\)\s*$/i, "").trim();
}
