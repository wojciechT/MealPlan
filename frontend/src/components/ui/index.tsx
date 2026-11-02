import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useEffect, useRef } from 'react'
import { ApiError } from '../../api/client'

export const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:brightness-110',
  secondary: 'bg-surface border border-line text-ink hover:bg-surface-sunken',
  ghost: 'text-ink-soft hover:bg-surface-sunken hover:text-ink',
  danger: 'text-danger hover:bg-danger-soft',
}

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
        'transition-colors disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  )
}

const fieldStyles =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink ' +
  'placeholder:text-ink-soft/60 focus:border-accent focus:outline-none ' +
  'focus:ring-2 focus:ring-accent/20 disabled:opacity-50'

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cx(fieldStyles, className)} {...props} />
)

export const Select = ({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cx(fieldStyles, className)} {...props} />
)

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium tracking-wide text-ink-soft uppercase">{label}</span>
      {children}
    </label>
  )
}

export const Spinner = () => (
  <div className="flex justify-center py-12" role="status" aria-label="Loading">
    <div className="size-6 animate-spin rounded-full border-2 border-line border-t-accent" />
  </div>
)

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children !== undefined && <div className="mt-2 text-sm text-ink-soft">{children}</div>}
    </div>
  )
}

/**
 * Renders whatever the backend said. Validation failures arrive as a list of
 * messages the domain wrote itself, so they are shown verbatim rather than
 * translated into something this layer invented.
 */
export function ErrorBanner({ error }: { error: unknown }) {
  if (error === null || error === undefined) {
    return null
  }

  const messages =
    error instanceof ApiError
      ? error.messages
      : [error instanceof Error ? error.message : 'Something went wrong.']

  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {messages.length === 1 ? (
        messages[0]
      ) : (
        <ul className="list-inside list-disc space-y-0.5">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  // <dialog> only gets its focus trap and backdrop from the imperative calls,
  // so the open prop is mirrored onto the element rather than rendered.
  useEffect(() => {
    const dialog = ref.current

    if (dialog === null) {
      return
    }

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // A click landing on the dialog itself is a click on the backdrop;
        // anything inside the content div stops before it gets here.
        if (event.target === ref.current) {
          onClose()
        }
      }}
      className="m-auto w-full max-w-lg rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close">
          ✕
        </Button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  )
}
