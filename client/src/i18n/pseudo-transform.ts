export function pseudoTransformText(value: string): string {
  return value.replace(/(\{\{[^}]+\}\}|<[^>]+>|[^<>]+)/g, (part) => {
    if (part.startsWith('{{') || part.startsWith('<')) return part

    const transformed = part.replace(/[A-Za-z]/g, (character) => {
      const accented: Record<string, string> = {
        a: 'á', e: 'ë', i: 'ï', o: 'ö', u: 'ü',
        A: 'Á', E: 'Ë', I: 'Ï', O: 'Ö', U: 'Ü',
      }
      return accented[character] ?? character
    })
    const extraLength = Math.ceil(transformed.length * 0.3)
    const padding = transformed.replace(/[^A-Za-z]/g, '').slice(0, extraLength)
    return `⟦${transformed}${padding}⟧`
  })
}