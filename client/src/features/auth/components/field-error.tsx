export function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p className="min-h-5 pt-1 text-xs text-destructive" id={id}>
      {message ?? ''}
    </p>
  )
}