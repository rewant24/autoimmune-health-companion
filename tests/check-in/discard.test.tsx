/**
 * <DiscardConfirm /> tests (US-1.F.3).
 *
 * Copy is verbatim from the spec:
 *   heading: "Discard this one?"
 *   body:    "Nothing will be saved."
 *   primary: "Discard"
 *   secondary: "Keep editing"
 *
 * Behaviour:
 *   - Modal with backdrop, role="dialog", aria-modal="true".
 *   - Discard fires onDiscard().
 *   - Keep editing fires onCancel().
 *   - Esc fires onCancel().
 *   - On mount, history.pushState is called so a Browser Back press
 *     fires popstate which the component handles by firing onCancel
 *     (i.e. closing the modal, NOT navigating away).
 *   - On unmount the popstate listener is removed.
 */

import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DiscardConfirm } from '@/components/check-in/DiscardConfirm'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('<DiscardConfirm />', () => {
  it('renders nothing when open is false', () => {
    render(
      <DiscardConfirm open={false} onDiscard={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the locked verbatim copy when open', () => {
    render(
      <DiscardConfirm open={true} onDiscard={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText('Discard this one?')).toBeInTheDocument()
    expect(screen.getByText('Nothing will be saved.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Discard' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Keep editing' }),
    ).toBeInTheDocument()
  })

  it('uses dialog semantics (role + aria-modal)', () => {
    render(
      <DiscardConfirm open={true} onDiscard={() => {}} onCancel={() => {}} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('Discard click fires onDiscard', async () => {
    const onDiscard = vi.fn()
    render(
      <DiscardConfirm open={true} onDiscard={onDiscard} onCancel={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('Keep editing click fires onCancel', async () => {
    const onCancel = vi.fn()
    render(
      <DiscardConfirm open={true} onDiscard={() => {}} onCancel={onCancel} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Esc fires onCancel', async () => {
    const onCancel = vi.fn()
    render(
      <DiscardConfirm open={true} onDiscard={() => {}} onCancel={onCancel} />,
    )
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pushes a history state on open so back-button can be intercepted', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState')
    render(
      <DiscardConfirm open={true} onDiscard={() => {}} onCancel={() => {}} />,
    )
    expect(pushSpy).toHaveBeenCalled()
  })

  it('popstate fires onCancel (browser-back closes modal, does not navigate)', () => {
    const onCancel = vi.fn()
    render(
      <DiscardConfirm open={true} onDiscard={() => {}} onCancel={onCancel} />,
    )
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(onCancel).toHaveBeenCalled()
  })
})
