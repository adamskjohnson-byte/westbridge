export function safeRedirect(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return '/dashboard'
  if (candidate.includes('\\') || /^[a-z][a-z\d+.-]*:/i.test(candidate)) return '/dashboard'

  return candidate
}