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
