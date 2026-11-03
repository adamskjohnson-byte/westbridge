import { forwardRef, useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'>

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(props, ref) {
  const { t } = useTranslation('common')
  const [visible, setVisible] = useState(false)
  const label = visible ? t('auth.hidePassword') : t('auth.showPassword')

  return (
    <div className="relative">
      <Input {...props} dir="ltr" ref={ref} type={visible ? 'text' : 'password'} className="pe-12 text-start" />
      <Button
        aria-label={label}
        aria-pressed={visible}
        className="absolute end-1 top-1 h-8 w-9"
        onClick={() => setVisible((current) => !current)}
        size="icon"
        type="button"
        variant="ghost"
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  )
})