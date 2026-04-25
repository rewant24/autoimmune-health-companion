/**
 * /welcome — visual welcome moment between Setup B and the home page.
 *
 * Onboarding Shell cycle, Chunk C, Welcome.US-1.
 *
 * Q7: the screen IS the welcome — no email send, no toast about an email.
 * Auth + real email send are deferred to the final Auth cycle.
 */

import { WelcomeScreen } from '@/components/welcome/WelcomeScreen'

export default function WelcomePage(): React.JSX.Element {
  return <WelcomeScreen />
}
