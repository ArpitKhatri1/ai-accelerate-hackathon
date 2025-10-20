'use client'

import { useEffect, useState } from 'react'

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(key)
      if (storedValue) {
        setValue(JSON.parse(storedValue) as T)
      }
    } catch (error) {
      console.warn(`Failed to parse localStorage key "${key}"`, error)
    } finally {
      setIsHydrated(true)
    }
  }, [key])

  useEffect(() => {
    if (!isHydrated) return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn(`Failed to write localStorage key "${key}"`, error)
    }
  }, [key, value, isHydrated])

  return [value, setValue, isHydrated] as const
}
