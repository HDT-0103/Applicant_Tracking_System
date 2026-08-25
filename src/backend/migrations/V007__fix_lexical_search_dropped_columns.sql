-- =========================================================================
--  V007: Sửa `search_profiles_lexically` sau khi enrichment_profiles bỏ cột
--
--  TRIỆU CHỨNG
--      postgrest.exceptions.APIError:
--          {'message': 'column p.github does not exist', 'code': '42703'}
--
--  NGUYÊN NHÂN
--      Hàm còn quét `p.github` / `p.linkedin` trên `enrichment_profiles`. Hai
--      cột này đã chuyển sang `candidates.github_url` / `candidates.linkedin_url`
--      khi schema được chuẩn hoá, nhưng hàm chưa cập nhật theo. Mọi lượt tìm
--      kiếm lexical vì thế đều lỗi — U003 đang hỏng với người dùng thật, không
--      riêng gì test.
--
--  PHẠM VI THAY ĐỔI: hẹp nhất có thể.
--      Chỉ bỏ hai vế `coalesce(p.github, '')` và `coalesce(p.linkedin, '')`
--      khỏi tsvector (cả ở SELECT lẫn WHERE). Giữ nguyên mọi thứ còn lại:
--
--      * chữ ký `(text, integer, text[])` — KHÔNG đổi sang uuid[], vì
--        `enrichment_profiles.candidate_uuid` là varchar(36);
--      * `LANGUAGE plpgsql`, `STABLE`;
--      * dictionary 'simple' — cố ý, vì 'english' sẽ stem sai tiếng Việt;
--      * `matched_fields` vẫn là summary || ' ' || experience. Tên gọi dễ gây
--        hiểu nhầm nhưng đây là hợp đồng hiện hành, đổi sẽ vỡ caller.
--
--      Không thêm `p.skills` vào tsvector: đó là thay đổi hành vi tìm kiếm,
--      cần đo lường riêng, và `get_candidate_ids_by_skills` đã lo phần skill.
--
--      Vì chữ ký không đổi nên dùng CREATE OR REPLACE, không DROP — tránh
--      khoảng thời gian hàm biến mất và tránh tạo hàm nạp chồng mồ côi.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.search_profiles_lexically(
    query text,
    top_k integer DEFAULT 10,
    candidate_ids text[] DEFAULT NULL::text[]
)
 RETURNS TABLE(
    candidate_uuid text,
    enrichment_profile_id uuid,
    lexical_score double precision,
    matched_fields text
 )
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    parsed_query tsquery;
BEGIN
    -- Parse câu truy vấn bằng simple dictionary (hỗ trợ cả Việt/Anh)
    parsed_query := plainto_tsquery('simple', query);

    RETURN QUERY
    SELECT
        p.candidate_uuid::text, -- Ép kiểu từ varchar(36) sang text
        p.id AS enrichment_profile_id,
        ts_rank_cd(
            to_tsvector(
                'simple',
                coalesce(p.summary, '') || ' ' ||
                coalesce(p.experience, '')
            ),
            parsed_query
        )::float AS lexical_score,
        (coalesce(p.summary, '') || ' ' || coalesce(p.experience, '')) AS matched_fields
    FROM public.enrichment_profiles p
    WHERE
        to_tsvector(
            'simple',
            coalesce(p.summary, '') || ' ' ||
            coalesce(p.experience, '')
        ) @@ parsed_query
        AND (candidate_ids IS NULL OR p.candidate_uuid = ANY(candidate_ids))
    ORDER BY lexical_score DESC
    LIMIT top_k;
END;
$function$;

-- Kiểm tra sau khi chạy — phải trả về 0 hàng, không được ném lỗi 42703:
--   SELECT * FROM search_profiles_lexically('zzz_khong_ton_tai', 10, NULL);
