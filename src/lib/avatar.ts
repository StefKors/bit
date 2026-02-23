/**
 * Resolves avatar URL for a user, matching the profile page logic.
 * Falls back to GitHub's predictable avatar URL when avatarUrl is missing.
 */
export function resolveUserAvatarUrl(
  user: { avatarUrl?: string; login?: string; email?: string } | null,
): string | undefined {
  if (!user) return undefined
  if (user.avatarUrl) return user.avatarUrl
  const owner = user.login ?? user.email?.split("@")[0]
  return owner ? `https://github.com/${owner}.png?size=128` : undefined
}

/**
 * Resolves avatar URL for an owner (login or org name), matching the profile page.
 * Always returns a URL when owner is provided — falls back to GitHub's predictable avatar.
 */
export function resolveOwnerAvatarUrl(owner: string, avatarUrl?: string | null): string {
  return avatarUrl || `https://github.com/${owner}.png?size=128`
}
