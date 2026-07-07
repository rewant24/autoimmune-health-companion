'use client'

/**
 * DeleteConfirmDialog — shared destructive-action confirm (W2-3, Lane 1D).
 * Replaces the two copy-pasted `DeleteConfirm` implementations in the
 * visits and blood-work detail pages. Locked F02 copy shape:
 * "Delete this …? You can't undo this."
 *
 * Deliberately NOT merged with check-in's `DiscardConfirm` — that dialog
 * abandons an in-progress flow (different semantics and copy), this one
 * deletes saved data.
 */

export interface DeleteConfirmDialogProps {
  /** Full title line, e.g. "Delete this doctor visit? You can't undo this." */
  title: string
  /** data-testid prefix — `{testId}` on the dialog, `{testId}-submit` on Delete. */
  testId: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({
  title,
  testId,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid={testId}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(20, 24, 26, 0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--rule)',
          color: 'var(--ink)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: '1.25rem',
            lineHeight: 1.2,
            fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          }}
        >
          {title}
        </h2>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-full px-5 text-[15px] font-medium"
            style={{
              background: 'transparent',
              color: 'var(--ink-muted)',
              border: '1px solid var(--rule)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid={`${testId}-submit`}
            className="min-h-12 rounded-full px-6 text-[15px] font-medium"
            style={{
              background: 'var(--terracotta)',
              color: 'var(--bg-elevated)',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
