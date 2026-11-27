import { expect, test } from 'vitest'
import { persistenceStatus, requestPersistentStorage } from './persistence'

test('reports unsupported when navigator.storage is missing', async () => {
  expect(await persistenceStatus()).toBe('unsupported')
  expect(await requestPersistentStorage()).toBe('unsupported')
})
