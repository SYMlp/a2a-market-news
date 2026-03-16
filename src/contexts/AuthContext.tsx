'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface UserInfo {
  id: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  isDeveloper: boolean
  developerName: string | null
}

interface AuthContextValue {
  user: UserInfo | null
  loading: boolean
  mutate: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  mutate: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return (
    <AuthContext.Provider value={{ user, loading, mutate: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
