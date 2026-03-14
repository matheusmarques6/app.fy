import { create } from 'zustand'
import type { MembershipRole } from '@appfy/shared'

interface UserInfo {
  id: string
  email: string
  name: string
}

interface AuthState {
  user: UserInfo | null
  role: MembershipRole | null
  isAuthenticated: boolean
  setUser: (user: UserInfo | null, role: MembershipRole | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  setUser: (user, role) =>
    set({
      user,
      role,
      isAuthenticated: user !== null,
    }),
  logout: () =>
    set({
      user: null,
      role: null,
      isAuthenticated: false,
    }),
}))
