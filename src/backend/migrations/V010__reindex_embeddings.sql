-- V010: RPC `reindex_embeddings` cho nút "Vector re-index" ở trang admin.
--
-- Admin service đã gọi RPC này từ lâu nhưng hàm chưa từng tồn tại trên
-- Supabase; service nuốt lỗi và báo "Simulated index rebuild" — xanh giả.
-- Từ V010 service trả 503 khi RPC thiếu; chạy file này để nút hoạt động thật.
--
-- REINDEX TABLE dựng lại MỌI chỉ mục của bảng (gồm chỉ mục ivfflat/hnsw
-- trên cột `embedding`) và chạy được trong transaction, nên gói vào hàm
-- plpgsql là hợp lệ. SECURITY DEFINER để service-role gọi được dù owner
-- bảng là postgres.

CREATE OR REPLACE FUNCTION public.reindex_embeddings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REINDEX TABLE public.embeddings;
  REINDEX TABLE public.job_embeddings;
END;
$$;

REVOKE ALL ON FUNCTION public.reindex_embeddings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reindex_embeddings() TO service_role;
