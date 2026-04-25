import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Tests render client components that call `useMutation` / `useQuery`
// from convex/react at module top-level. Without a ConvexProvider in the
// test tree these hooks throw "Could not find Convex client". We don't
// exercise Convex behaviour from page tests (those live in
// tests/check-in/convex-checkins.test.ts via the extracted handlers), so
// returning a no-op mutator + undefined query result keeps the page
// renderable and the existing tests untouched.
vi.mock('convex/react', () => ({
  useMutation: () => async () => undefined,
  useQuery: () => undefined,
  ConvexProvider: ({ children }: { children: unknown }) => children,
  ConvexReactClient: class {},
}))
