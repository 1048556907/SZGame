import { useEffect, useState } from 'react'

/**
 * 简单的 debounce hook —— 输入变更后延迟 ms 才更新值
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
