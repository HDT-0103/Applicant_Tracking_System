/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  clearQueryCache,
  fetchQuery,
  getQueryData,
  invalidateQueries,
  setQueryData,
  useCachedQuery,
} from "../queryCache";

afterEach(() => clearQueryCache());

describe("useCachedQuery — hiện cũ trước, làm mới ngầm", () => {
  it("lần đầu: loading rồi có dữ liệu", async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2]);
    const { result } = renderHook(() => useCachedQuery("k", fetcher));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    expect(result.current.loading).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("lần sau: dữ liệu cache hiện NGAY (không loading) và vẫn tải lại ngầm", async () => {
    setQueryData("k", ["old"]);
    const fetcher = vi.fn().mockResolvedValue(["new"]);
    const { result } = renderHook(() => useCachedQuery("k", fetcher));
    // Không có vòng xoay: đây là toàn bộ lý do cache tồn tại.
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(["old"]);
    await waitFor(() => expect(result.current.data).toEqual(["new"]));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("invalidateQueries làm hook đang mở tải lại", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    const { result } = renderHook(() => useCachedQuery("jobs", fetcher));
    await waitFor(() => expect(result.current.data).toBe("a"));
    act(() => invalidateQueries("jobs"));
    await waitFor(() => expect(result.current.data).toBe("b"));
  });

  it("setQueryData cập nhật tại chỗ, không gọi mạng", async () => {
    const fetcher = vi.fn().mockResolvedValue(["a"]);
    const { result } = renderHook(() => useCachedQuery<string[]>("jobs", fetcher));
    await waitFor(() => expect(result.current.data).toEqual(["a"]));
    act(() => setQueryData<string[]>("jobs", (prev) => [...(prev ?? []), "b"]));
    expect(result.current.data).toEqual(["a", "b"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("hai nơi cùng hỏi một key thì chỉ có một request", async () => {
    const fetcher = vi.fn().mockResolvedValue(1);
    await Promise.all([fetchQuery("x", fetcher), fetchQuery("x", fetcher)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getQueryData("x")).toBe(1);
  });
});
