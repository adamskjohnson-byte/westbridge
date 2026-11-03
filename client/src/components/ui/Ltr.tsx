import type { PropsWithChildren } from 'react'

export function Ltr({ children }: PropsWithChildren) {
  return <bdi dir="ltr">{children}</bdi>
}

const tokenPattern = /(Westbridge(?: National Bank)?|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/[^\s,;]+|\$\s?[0-9][0-9,]*(?:\.[0-9]{2})?|(?:\+?[0-9][0-9(). -]{6,}[0-9])|(?:[0-9][ -]?){13,19})/giu
const tokenOnlyPattern = /^(?:Westbridge(?: National Bank)?|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/[^\s,;]+|\$\s?[0-9][0-9,]*(?:\.[0-9]{2})?|(?:\+?[0-9][0-9(). -]{6,}[0-9])|(?:[0-9][ -]?){13,19})$/iu

export function BidiText({ text }: { text: string }) {
  return (
    <>
      {text.split(tokenPattern).map((part, index) => tokenOnlyPattern.test(part)
        ? <Ltr key={`${part}-${index}`}>{part}</Ltr>
        : part)}
    </>
  )
}