interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const memoryFallback = new Map<string, CacheEntry<any>>();

export function getClientCache<T>(key: string, ttlMs = 15000): T | null {
  const now = Date.now();

  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (now - entry.timestamp < ttlMs) {
        return entry.data;
      }
      sessionStorage.removeItem(key);
    }
  } catch {
    // sessionStorage 비활성화 또는 시크릿 모드 예외 시 fallback 확인
  }

  const memEntry = memoryFallback.get(key);
  if (memEntry) {
    if (now - memEntry.timestamp < ttlMs) {
      return memEntry.data as T;
    }
    memoryFallback.delete(key);
  }

  return null;
}

export function setClientCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = {
    timestamp: Date.now(),
    data,
  };

  memoryFallback.set(key, entry);

  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // 스토리지 제한 초과 or 보안 에러 무시 (메모리 캐시로 대체)
  }
}

export function clearClientCache(prefix?: string): void {
  // 메모리 캐시 정리
  if (!prefix) {
    memoryFallback.clear();
  } else {
    for (const k of memoryFallback.keys()) {
      if (k.startsWith(prefix)) memoryFallback.delete(k);
    }
  }

  // sessionStorage 정리
  try {
    if (!prefix) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('nummo_')) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(prefix)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    }
  } catch {
    // ignore
  }
}
