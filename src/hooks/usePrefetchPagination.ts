import { useState, useEffect, useRef, useCallback } from 'react';

export interface PaginationResult<T> {
  items: T[];
  hasMore: boolean;
  totalCount?: number;
}

export interface UsePrefetchPaginationOptions<T> {
  fetchPage: (page: number, signal?: AbortSignal) => Promise<PaginationResult<T>>;
  pageSize?: number;
  refreshTrigger?: any;
}

export function usePrefetchPagination<T>({
  fetchPage,
  pageSize = 10,
  refreshTrigger,
}: UsePrefetchPaginationOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // 다음 페이지 프리페치 버퍼 및 진행 중인 요청 참조
  const prefetchBufferRef = useRef<{ page: number; result: PaginationResult<T> } | null>(null);
  const inFlightPrefetchRef = useRef<{ page: number; promise: Promise<PaginationResult<T>> } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 백그라운드 프리페치 실행
  const prefetchNextPage = useCallback(
    (targetPage: number) => {
      // 이미 버퍼에 있거나 현재 프리페치 중이면 중복 요청 방지
      if (
        prefetchBufferRef.current?.page === targetPage ||
        inFlightPrefetchRef.current?.page === targetPage
      ) {
        return;
      }

      const promise = fetchPage(targetPage)
        .then((res) => {
          prefetchBufferRef.current = { page: targetPage, result: res };
          return res;
        })
        .catch((err) => {
          console.warn(`[Prefetch] Failed to prefetch page ${targetPage}:`, err);
          return { items: [], hasMore: false, totalCount: 0 };
        })
        .finally(() => {
          inFlightPrefetchRef.current = null;
        });

      inFlightPrefetchRef.current = { page: targetPage, promise };
    },
    [fetchPage]
  );

  // 초기 1페이지 로드 및 2페이지 프리페치 가동
  const loadInitial = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      prefetchBufferRef.current = null;
      inFlightPrefetchRef.current = null;

      try {
        const page1 = await fetchPage(1, signal);
        if (signal?.aborted) return;

        setItems(page1.items);
        setCurrentPage(1);
        setHasMore(page1.hasMore);
        setTotalCount(page1.totalCount || 0);

        // 1페이지 로드 완료 즉시 2페이지 백그라운드 프리페치 실행
        if (page1.hasMore) {
          prefetchNextPage(2);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to load initial page:', err);
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [fetchPage, prefetchNextPage]
  );

  // refreshTrigger 변경 또는 마운트 시 리셋
  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    loadInitial(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadInitial, refreshTrigger]);

  // 더보기 클릭 시 (프리페치 버퍼에서 0초 즉시 반영 + 다음 페이지 백그라운드 프리페치)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || isLoadingMore) return;

    const nextPage = currentPage + 1;

    // 1. 프리페치 버퍼에 이미 다음 페이지 데이터가 도착해 있는 경우 -> 즉시 병합 (0ms 지연)
    if (prefetchBufferRef.current && prefetchBufferRef.current.page === nextPage) {
      const buffered = prefetchBufferRef.current.result;
      prefetchBufferRef.current = null;

      setItems((prev) => [...prev, ...buffered.items]);
      setCurrentPage(nextPage);
      setHasMore(buffered.hasMore);

      // 다음-다음 페이지가 있다면 다시 백그라운드 프리페치 시작
      if (buffered.hasMore) {
        prefetchNextPage(nextPage + 1);
      }
      return;
    }

    // 2. 사용자가 프리페치 완료 전에 더보기를 누른 경우 -> 진행 중인 프로미스 대기
    setIsLoadingMore(true);
    try {
      let pageData: PaginationResult<T>;
      if (inFlightPrefetchRef.current && inFlightPrefetchRef.current.page === nextPage) {
        pageData = await inFlightPrefetchRef.current.promise;
      } else {
        pageData = await fetchPage(nextPage);
      }

      setItems((prev) => [...prev, ...pageData.items]);
      setCurrentPage(nextPage);
      setHasMore(pageData.hasMore);

      // 다음 페이지 프리페치
      if (pageData.hasMore) {
        prefetchNextPage(nextPage + 1);
      }
    } catch (err) {
      console.error('Failed to load more page:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoading, isLoadingMore, currentPage, fetchPage, prefetchNextPage]);

  return {
    items,
    currentPage,
    hasMore,
    totalCount,
    pageSize,
    isLoading,
    isLoadingMore,
    loadMore,
    refresh: () => loadInitial(),
  };
}
