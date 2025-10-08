import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { requireMemberOrAdmin } from '@/lib/auth'

export default async function ExperiencesLayout({ children }: { children: ReactNode }) {
  const gate = await requireMemberOrAdmin()
  if (!gate.allowed) {
    redirect('/plans')
  }
  return <>{children}</>
}
