"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cache "hiện cũ trước, làm mới ngầm" cho các lượt đọc danh sách.
 *
 * Mỗi lần chuyển trang, sidebar gọi lại danh sách tin, dashboard gọi lại hồ
 * sơ… và người dùng nhìn vòng xoay dù dữ liệu vừa có 10 giây trước. Ở đây:
 * có bản cache thì hiện ngay, đồng thời tải lại ngầm và thay vào khi về.
 * Cache sống trong bộ nhớ của tab, xoá khi đăng xuất (`clearQueryCache`),
 * và các thao tác ghi gọi `invalidateQueries` / `setQueryData` để không hiện
 * dữ liệu đã lỗi thời.
 */
/** Key dùng chung để các màn hình làm mới đúng cache của nhau. */
export const JOB_POSTINGS_QUERY = "catalog:job-postings";
export const DASHBOARD_QUERY = "catalog:dashboard";
export const ANALYTICS_QUERY = "catalog:analytics";
export const CANDIDATE_OPTIONS_QUERY = "catalog:candidate-options";

interface Entry<T> {
  data: T;
  at: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

export function getQueryData<T>(key: string): T | undefined {
  return store.get(key)?.data as T | undefined;
}

export function setQueryData<T>(key: string, updater: T | ((prev: T | undefined) => T)): void {
  const prev = store.get(key)?.data as T | undefined;
  const next = typeof updater === "function" ? (updater as (p: T | undefined) => T)(prev) : updater;
  store.set(key, { data: next, at: Date.now() });
  notify(key);
}

/** Bỏ cache của mọi key bắt đầu bằng `prefix`; hook đang mở sẽ tải lại. */
export function invalidateQueries(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      notify(key);
    }
  }
}

export function clearQueryCache(): void {
  store.clear();
  inflight.clear();
  listeners.forEach((set) => set.forEach((fn) => fn()));
}

/** Tải (dùng chung một promise nếu nhiều nơi cùng hỏi một key). */
export function fetchQuery<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = fetcher()
    .then((data) => {
      store.set(key, { data, at: Date.now() });
      notify(key);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export interface CachedQuery<T> {
  data: T | undefined;
  /** Đang tải LẦN ĐẦU (chưa có gì để hiện). Làm mới ngầm không bật cờ này. */
  loading: boolean;
  /** Đang làm mới ngầm khi đã có dữ liệu. */
  refreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { staleMs?: number; enabled?: boolean } = {},
): CachedQuery<T> {
  const { staleMs = 0, enabled = true } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | undefined>(() => (key ? getQueryData<T>(key) : undefined));
  const [loading, setLoading] = useState<boolean>(() => Boolean(key && enabled && getQueryData(key) === undefined));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!key) return;
    const had = getQueryData<T>(key) !== undefined;
    if (had) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await fetchQuery(key, fetcherRef.current);
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [key]);

  useEffect(() => {
    if (!key || !enabled) return;
    const onChange = () => {
      const entry = store.get(key) as Entry<T> | undefined;
      if (entry) setData(entry.data);
      else void load();
    };
    const set = listeners.get(key) ?? new Set();
    set.add(onChange);
    listeners.set(key, set);

    const entry = store.get(key) as Entry<T> | undefined;
    if (entry) {
      setData(entry.data);
      setLoading(false);
      if (Date.now() - entry.at > staleMs) void load();
    } else {
      void load();
    }
    return () => {
      set.delete(onChange);
    };
  }, [key, enabled, staleMs, load]);

  return { data, loading, refreshing, error, refresh: load };
}
