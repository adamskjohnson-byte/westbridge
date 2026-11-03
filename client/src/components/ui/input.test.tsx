// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Input } from './input'

beforeEach(() => {
  document.documentElement.dir = 'rtl'
})

afterEach(() => {
  cleanup()
  document.documentElement.dir = 'ltr'
})

describe('Input', () => {
  it.each(['email', 'tel', 'url', 'number'])('keeps %s fields LTR and logically start-aligned', (type) => {
    const { container } = render(<Input aria-label="value" type={type} />)
    const input = container.querySelector('input')!

    expect(input.getAttribute('dir')).toBe('ltr')
    expect(input.classList.contains('text-start')).toBe(true)
  })
})