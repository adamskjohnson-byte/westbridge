export const landingContent = {
  hero: {
    eyebrow: '',
    headline: '',
    subheadline: '',
    primaryCta: '',
    secondaryCta: '',
    secondaryCtaHref: '#how-it-works',
    card: {
      bankName: 'WESTBRIDGE NATIONAL BANK',
      number: '6248 0000 0000 2105',
      holder: '',
      expires: '******',
    },
  },
  videoShowcase: {
    src: '/videos/demo.mp4',
    poster: undefined as string | undefined,
    captionsSrc: undefined as string | undefined,
    captionsLabel: 'English',
    eyebrow: '',
    heading: '',
    description: '',
  },
  trust: {
    title: '',
    stats: [
      { value: '18K+', label: '', note: '' },
      { value: '42', label: '', note: '' },
      { value: '99.98%', label: '', note: '' },
      { value: '14', label: '', note: '' },
    ],
    note: '',
  },
  products: {
    eyebrow: '',
    title: '',
    items: [
      {
        slug: 'checking',
        title: '',
        description: '',
      },
      {
        slug: 'savings',
        title: '',
        description: '',
      },
      {
        slug: 'credit-cards',
        title: '',
        description: '',
      },
      {
        slug: 'loans',
        title: '',
        description: '',
      },
      {
        slug: 'mortgages',
        title: '',
        description: '',
      },
    ],
  },
  whyWestbridge: {
    eyebrow: '',
    title: '',
    items: [
      {
        title: '',
        description: '',
      },
      {
        title: '',
        description: '',
      },
      {
        title: '',
        description: '',
      },
      {
        title: '',
        description: '',
      },
      {
        title: '',
        description: '',
      },
      {
        title: '',
        description: '',
      },
    ],
  },
  dashboardPreview: {
    eyebrow: '',
    heading: '',
    description: '',
    benefits: [
      '', '', '', '',
    ],
    account: {
      label: '',
      balance: '$28,460.75',
      account: '',
    },
    stats: [
      { label: '', value: '$7,820' },
      { label: '', value: '$3,140' },
    ],
    activityLabel: '',
    activityPeriod: '',
    transactions: [
      { name: 'Marketplace', detail: '', amount: '-$68.40' },
      { name: 'Payroll', detail: '', amount: '+$2,450.00' },
      { name: 'Groceries', detail: '', amount: '-$86.25' },
    ],
    cashFlow: '',
    cashFlowChange: '+18.4%',
    notification: '',
    securityNotice: '',
    caption: '',
    cta: '',
  },
  steps: {
    eyebrow: '',
    title: '',
    items: [
      {
        number: '01',
        title: '',
        description: '',
      },
      {
        number: '02',
        title: '',
        description: '',
      },
      {
        number: '03',
        title: '',
        description: '',
      },
    ],
  },
  calculators: {
    eyebrow: '',
    title: '',
    note: '',
    loan: {
      label: '',
      amountLabel: '',
      rateLabel: '',
      termLabel: '',
    },
    savings: {
      label: '',
      initialLabel: '',
      contributionLabel: '',
      rateLabel: '',
      yearsLabel: '',
    },
  },
  rates: {
    eyebrow: '',
    title: '',
    tabs: [
      {
        id: 'savings',
        label: '',
        rows: [
          { product: '', rate: '4.10%', feature: '' },
          { product: '', rate: '4.40%', feature: '' },
          { product: '', rate: '4.15%', feature: '' },
        ],
      },
      {
        id: 'loans',
        label: '',
        rows: [
          { product: '', rate: '7.25%', feature: '' },
          { product: '', rate: '6.95%', feature: '' },
          { product: '', rate: '6.80%', feature: '' },
        ],
      },
      {
        id: 'mortgages',
        label: '',
        rows: [
          { product: '', rate: '6.35%', feature: '' },
          { product: '', rate: '5.85%', feature: '' },
          { product: '', rate: '5.90%', feature: '' },
        ],
      },
    ],
  },
  security: {
    eyebrow: '',
    title: '',
    items: [
      '', '', '', '', '', '',
    ],
  },
  mobileApp: {
    eyebrow: '',
    title: '',
    description: '',
    features: ['', '', ''],
    storeButtons: [
      { label: '', meta: '' },
      { label: '', meta: '' },
    ],
  },
  testimonials: {
    eyebrow: '',
    title: '',
    items: [
      {
        initials: 'AR',
        name: 'Alicia R.',
        role: '',
        quote: '',
      },
      {
        initials: 'JL',
        name: 'Jordan L.',
        role: '',
        quote: '',
      },
      {
        initials: 'MP',
        name: 'Maya P.',
        role: '',
        quote: '',
      },
      {
        initials: 'TN',
        name: 'Theo N.',
        role: '',
        quote: '',
      },
      {
        initials: 'SK',
        name: 'Sofia K.',
        role: '',
        quote: '',
      },
      {
        initials: 'DB',
        name: 'Daniel B.',
        role: '',
        quote: '',
      },
    ],
  },
  blog: {
    eyebrow: '',
    title: '',
    posts: [
      {
        slug: 'building-a-better-savings-routine',
        category: '',
        title: '',
        excerpt: '',
        readTime: '',
      },
      {
        slug: 'when-to-refinance-a-loan',
        category: '',
        title: '',
        excerpt: '',
        readTime: '',
      },
      {
        slug: 'money-habits-for-new-homeowners',
        category: '',
        title: '',
        excerpt: '',
        readTime: '',
      },
    ],
  },
  faq: {
    eyebrow: '',
    title: '',
    items: [
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
    ],
  },
  contact: {
    eyebrow: '',
    title: '',
    description: '',
    form: {
      name: '',
      email: '',
      subject: '',
      message: '',
      submit: '',
    },
    branches: [
      { city: '', address: '', hours: '' },
      { city: '', address: '', hours: '' },
      { city: '', address: '', hours: '' },
      { city: '', address: '', hours: '' },
    ],
  },
  newsletter: {
    eyebrow: '',
    title: '',
    placeholder: '',
    cta: '',
  },
} as const
