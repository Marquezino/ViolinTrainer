import { createContext, useContext, type ReactNode } from 'react'
import type { VtDatabase } from '../store/db'

interface DbContextValue {
  db: VtDatabase
  /** False when IndexedDB was unavailable and the data lives only in memory (§10 of the v1 spec). */
  storageAvailable: boolean
}

const DbContext = createContext<DbContextValue | null>(null)

export function DbProvider(props: { db: VtDatabase; storageAvailable: boolean; children: ReactNode }) {
  const { db, storageAvailable, children } = props
  return <DbContext.Provider value={{ db, storageAvailable }}>{children}</DbContext.Provider>
}

function useDbContext(): DbContextValue {
  const value = useContext(DbContext)
  if (!value) throw new Error('useDb must be used inside DbProvider')
  return value
}

export function useDb(): VtDatabase {
  return useDbContext().db
}

export function useStorageAvailable(): boolean {
  return useDbContext().storageAvailable
}
