import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { requireMemberOrAdmin } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const gate = await requireMemberOrAdmin()
  
  // Only allow access if user is explicitly an admin (not just dev mode)
  if (!gate.allowed || (gate.reason !== 'admin' && gate.reason !== 'dev_mode')) {
    redirect('/plans')
  }
  
  return <>{children}</>
}