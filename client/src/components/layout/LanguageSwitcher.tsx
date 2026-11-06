import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Globe, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { languages, resolveLanguage } from '@/i18n/languages'
import { useAuth } from '@/features/auth/auth-provider'
import { updatePreferences } from '@/features/dashboard/settings-api'
import { toast } from 'sonner'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('common')
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const current = resolveLanguage(i18n.resolvedLanguage ?? i18n.language)

  const filteredLanguages = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    if (!search) return languages
    return languages.filter((language) => [language.nativeName, language.englishName, language.code]
      .some((value) => value.toLocaleLowerCase().includes(search)))
  }, [query])

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus())
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const searchHasFocus = event.target === searchRef.current
        if (!searchHasFocus) {
          event.preventDefault()
          searchRef.current?.focus()
        }
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function selectLanguage(code: string) {
    await i18n.changeLanguage(code)
    if (isAuthenticated) {
      void updatePreferences({ locale: code }).catch(() => toast.error(t('dashboard.settings.preferenceSaveError')))
    }
    setQuery('')
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(filteredLanguages.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(0, filteredLanguages.length - 1))
    } else if (event.key === 'Enter' && filteredLanguages[activeIndex]) {
      event.preventDefault()
      void selectLanguage(filteredLanguages[activeIndex].code)
    } else if (event.key.length === 1 && /[\p{L}\p{N}]/u.test(event.key)) {
      const startIndex = (activeIndex + 1) % Math.max(filteredLanguages.length, 1)
      const ordered = [...filteredLanguages.slice(startIndex), ...filteredLanguages.slice(0, startIndex)]
      const match = ordered.findIndex((language) => language.nativeName.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()))
      if (match >= 0) setActiveIndex((startIndex + match) % filteredLanguages.length)
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('languageSwitcher.triggerLabel', { language: current.nativeName })}
        className="gap-1.5 px-2.5"
        onClick={() => setOpen((value) => !value)}
        type="button"
        variant="outline"
      >
        <Globe aria-hidden="true" />
        <span className="text-xs font-bold">{current.code.split('-')[0].toUpperCase()}</span>
      </Button>

      {open && (
        <div className="language-switcher-popover absolute end-0 top-full z-[60] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search aria-hidden="true" className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-activedescendant={filteredLanguages[activeIndex] ? `language-option-${filteredLanguages[activeIndex].code}` : undefined}
                aria-controls="language-options"
                aria-expanded={open}
                aria-label={t('languageSwitcher.searchLabel')}
                autoComplete="off"
                className="ps-9"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('languageSwitcher.searchPlaceholder')}
                ref={searchRef}
                role="combobox"
                value={query}
              />
            </div>
          </div>
          <div aria-label={t('languageSwitcher.listLabel')} className="max-h-80 overflow-y-auto p-1" id="language-options" role="listbox">
            {filteredLanguages.map((language, index) => {
              const selected = language.code === current.code
              return (
                <button
                  aria-selected={selected}
                  aria-label={`${language.nativeName}, ${language.englishName}, ${language.code}`}
                  className={cn('flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-start hover:bg-accent focus-visible:bg-accent', activeIndex === index && 'bg-accent')}
                  id={`language-option-${language.code}`}
                  key={language.code}
                  onClick={() => void selectLanguage(language.code)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  tabIndex={-1}
                  type="button"
                >
                  <span className="grid size-5 shrink-0 place-items-center">
                    {selected && <Check aria-hidden="true" className="size-4 text-primary" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{language.nativeName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{language.englishName}</span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{language.code}</span>
                </button>
              )
            })}
            {filteredLanguages.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">{t('languageSwitcher.noResults')}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
