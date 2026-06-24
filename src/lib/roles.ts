// ─── Role constants ───────────────────────────────────────────────────────────

export const USER_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  USER:        "USER",
} as const
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

export const ORG_ROLES = {
  OWNER:  "OWNER",   // CLIENT_CORPORATE
  MEMBER: "MEMBER",
} as const
export type OrgRole = typeof ORG_ROLES[keyof typeof ORG_ROLES]

export const ASOC_ROLES = {
  PRESEDINTE: "PRESEDINTE",
  CENZOR:     "CENZOR",
  PROPRIETAR: "PROPRIETAR",
} as const
export type AsocRole = typeof ASOC_ROLES[keyof typeof ASOC_ROLES]

export const ASOC_ROLE_LABELS: Record<AsocRole, string> = {
  PRESEDINTE: "Președinte",
  CENZOR:     "Cenzor",
  PROPRIETAR: "Proprietar",
}

// ─── Guards ───────────────────────────────────────────────────────────────────

export function isSuperAdmin(role: string | null | undefined) {
  return role === USER_ROLES.SUPER_ADMIN
}

export function isOwner(orgRole: string | null | undefined) {
  return orgRole === ORG_ROLES.OWNER
}

export function canManageOrg(userRole: string, orgRole?: string | null) {
  return isSuperAdmin(userRole) || isOwner(orgRole)
}

export function canReadOnly(asocRole: string | null | undefined) {
  return (
    asocRole === ASOC_ROLES.PRESEDINTE ||
    asocRole === ASOC_ROLES.CENZOR     ||
    asocRole === ASOC_ROLES.PROPRIETAR
  )
}

// Invitation expires after 7 days
export function invitationExpiresAt() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d
}
