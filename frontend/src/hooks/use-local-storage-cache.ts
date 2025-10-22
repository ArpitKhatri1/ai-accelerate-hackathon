'use client'

import { useEffect, useMemo, useState } from 'react'

export type CacheEntry<T> = {
  v: T // value
  t: number // timestamp (ms since epoch)
}

/**
 * useLocalStorageCache
 * - Stores { v: value, t: timestamp } in localStorage
 * - Reads and writes under the given key
 * - Exposes isHydrated and isFresh (based on ttlMs)
 */
export function useLocalStorageCache<T>(key: string, initialValue: T, ttlMs: number) {
  const [entry, setEntry] = useState<CacheEntry<T> | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>
        setEntry(parsed)
      } else {
        setEntry({ v: initialValue, t: 0 })
      }
    } catch (e) {
      console.warn(`[useLocalStorageCache] read failed for ${key}`, e)
      setEntry({ v: initialValue, t: 0 })
    } finally {
      setIsHydrated(true)
    }
  }, [key]) // Removed initialValue from dependencies

  const isFresh = useMemo(() => {
    if (!entry) return false
    const now = Date.now()
    return entry.t > 0 && now - entry.t < ttlMs
  }, [entry, ttlMs])

  const setValue = (value: T) => {
    const next = { v: value, t: Date.now() } as CacheEntry<T>
    setEntry(next)
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch (e) {
      console.warn(`[useLocalStorageCache] write failed for ${key}`, e)
    }
  }

  return [entry?.v ?? initialValue, setValue, isHydrated, isFresh] as const
}
