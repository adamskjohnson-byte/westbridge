export type ImageSlot = {
  src: string
  alt: string
  width: number
  height: number
}

export const imageSlots = {
  products: {
    checking: {
      src: '/images/products/checking.jpg',
      alt: '',
      width: 800,
      height: 600,
    },
    savings: {
      src: '/images/products/savings.jpg',
      alt: '',
      width: 800,
      height: 600,
    },
    'credit-cards': {
      src: '/images/products/credit-cards.jpg',
      alt: '',
      width: 800,
      height: 600,
    },
    loans: {
      src: '/images/products/loans.jpg',
      alt: '',
      width: 800,
      height: 600,
    },
    mortgages: {
      src: '/images/products/mortgages.jpg',
      alt: '',
      width: 800,
      height: 600,
    },
  },
  sections: {
    support: {
      src: '/images/sections/support.jpg',
      alt: '',
      width: 800,
      height: 1000,
    },
    security: {
      src: '/images/sections/security.jpg',
      alt: '',
      width: 1200,
      height: 800,
    },
    'cta-banner': {
      src: '/images/sections/cta-banner.jpg',
      alt: '',
      width: 1920,
      height: 820,
    },
    branch: {
      src: '/images/sections/branch.jpg',
      alt: '',
      width: 1200,
      height: 800,
    },
  },
  blog: {
    'tip-1': {
      src: '/images/blog/tip-1.jpg',
      alt: '',
      width: 800,
      height: 450,
    },
    'tip-2': {
      src: '/images/blog/tip-2.jpg',
      alt: '',
      width: 800,
      height: 450,
    },
    'tip-3': {
      src: '/images/blog/tip-3.jpg',
      alt: '',
      width: 800,
      height: 450,
    },
  },
  about: {
    team: {
      src: '/images/about/team.jpg',
      alt: '',
      width: 1200,
      height: 800,
    },
    headquarters: {
      src: '/images/about/headquarters.jpg',
      alt: '',
      width: 1200,
      height: 800,
    },
  },
} as const

export const allImageSlots: ImageSlot[] = Object.values(imageSlots)
  .flatMap((group) => Object.values(group))
