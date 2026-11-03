import { useEffect } from 'react'

const siteName = 'Westbridge National Bank'

export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = `${title} | ${siteName}`
    if (description) {
      const metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (metaDescription) metaDescription.content = description
    }
  }, [title, description])
}