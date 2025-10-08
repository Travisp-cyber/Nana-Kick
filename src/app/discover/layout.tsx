import { ReactNode } from 'react'

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  // Make discover page publicly accessible - it's a landing page
  // Auth is enforced in the actual app routes (experiences, dashboard)
  return <>{children}</>
}
