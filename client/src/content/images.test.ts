import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { allImageSlots } from '@/content/images'

describe('image slots', () => {
  it('every registered image exists in public/images', () => {
    for (const slot of allImageSlots) {
      const absolutePath = path.resolve(process.cwd(), 'public', slot.src.replace(/^\//, ''))
      expect(fs.existsSync(absolutePath)).toBe(true)
    }
  })
})
