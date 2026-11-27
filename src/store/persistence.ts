export type PersistenceStatus = 'granted' | 'denied' | 'unsupported'

function storage(): StorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

// Asks the browser to keep the data even when disk space runs low.
export async function requestPersistentStorage(): Promise<PersistenceStatus> {
  const s = storage()
  if (!s?.persisted || !s.persist) return 'unsupported'
  try {
    if (await s.persisted()) return 'granted'
    return (await s.persist()) ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

export async function persistenceStatus(): Promise<PersistenceStatus> {
  const s = storage()
  if (!s?.persisted) return 'unsupported'
  try {
    return (await s.persisted()) ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}
