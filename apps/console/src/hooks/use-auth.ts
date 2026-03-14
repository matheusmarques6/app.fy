'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'

export function useAuth() {
  const router = useRouter()
  const { user, role, isAuthenticated, setUser, logout: storeLogout } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(
          {
            id: session.user.id,
            email: session.user.email ?? '',
            name: session.user.user_metadata?.['name'] as string ?? '',
          },
          null,
        )
      } else {
        storeLogout()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, setUser, storeLogout])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    storeLogout()
    router.push('/login')
  }, [supabase.auth, storeLogout, router])

  return {
    user,
    role,
    isAuthenticated,
    logout,
    supabase,
  }
}
