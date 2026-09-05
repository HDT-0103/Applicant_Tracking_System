"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Sparkles, X } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { D, tint } from "../../lib/shared";
import {
  MAX_TOP_K,
  findCandidates,
  type FindCandidateResult,
} from "../../services/searchService";
import { anonymousCandidateLabel, isMasked } from "../../lib/candidateLabel";
import { useT } from "../../lib/i18n";

/**
 * Screen 3 — Semantic Ranking Results (Design §5.2.3).
 *
 * HR mô tả vị trí bằng câu chữ bình thường; backend nhúng câu đó thành vector,
 * so với hồ sơ ứng viên qua pgvector, và trả về danh sách đã xếp hạng.
 *
 * Hai điều màn hình này cố ý làm khác một ô tìm kiếm thông thường:
 *
 * * **Kỹ năng bắt buộc là bộ lọc CỨNG.** Thiếu là loại, bất kể điểm ngữ nghĩa
 *   cao đến đâu. Trộn nó vào phần chấm điểm sẽ cho ra ứng viên "gần đúng" ở
 *   những thứ không được phép gần đúng.
 * * **Thanh ngưỡng lọc lại tại chỗ, không gọi lại server.** Điểm đã có sẵn
 *   trong kết quả, nên kéo thanh trượt phản hồi tức thì thay vì chờ một vòng
 *   nhúng vector nữa.
 */
export default function SearchPage() {
  const router = useRouter();
  const t = useT();

  const [summary, setSummary] = useState("");
  const [experience, setExperience] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [topK, setTopK] = useState(10);

  const [results, setResults] = useState<FindCandidateResult[] | null>(null);
  const [threshold, setThreshold] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSkill = () => {
    const value = skillInput.trim();
    if (value && !skills.includes(value)) setSkills([...skills, value]);
    setSkillInput("");
  };

  const runSearch = async () => {
    if (!summary.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const body = await findCandidates({
        role_description: summary.trim(),
        experience_expectations: experience.trim() || undefined,
        must_have_skills: skills,
        top_k: topK,
      });
      setResults(body);
      // Ngưỡng về 0 sau mỗi lần tìm mới: giữ lại mức của truy vấn trước có thể
      // ẩn sạch kết quả mới, và trông y như "không tìm thấy ai".
      setThreshold(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("search.error"));
    } finally {
      setSearching(false);
    }
  };

  const visible = (results ?? []).filter((r) => r.overall_score >= threshold);

  const field: React.CSSProperties = {
    width: "100%",
    padding: "9px 11px",
    border: `1px solid ${D.line}`,
    borderRadius: 6,
    background: D.canvas,
    color: D.ink,
    fontSize: 13,
    fontFamily: D.font,
    outline: "none",
  };

  return (
    <AppShell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: D.ink, marginBottom: 6 }}>
          {t("search.title")}
        </h1>
        <p style={{ fontSize: 13.5, color: D.muted, margin: 0 }}>
          {t("search.subtitle")}
        </p>
      </div>

      <div
        style={{
          background: D.canvas,
          border: `1px solid ${D.line}`,
          borderRadius: 12,
          padding: 20,
          marginBottom: 28,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: D.ink }}>
            {t("search.summaryLabel")}
          </span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t("search.summaryPlaceholder")}
            style={{ ...field, minHeight: 76, resize: "vertical" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: D.ink }}>
            {t("search.experienceLabel")}
          </span>
          <input
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder={t("search.experiencePlaceholder")}
            style={field}
          />
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: D.ink }}>
            {t("search.mustHaveLabel")}
          </span>
          <span style={{ fontSize: 11, color: D.muted, marginTop: -4 }}>
            {t("search.mustHaveHint")}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder={t("search.skillPlaceholder")}
              style={{ ...field, flex: 1 }}
            />
            <button
              type="button"
              onClick={addSkill}
              style={{
                padding: "0 16px",
                border: `1px solid ${D.line}`,
                borderRadius: 6,
                background: D.surface,
                color: D.sub,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("search.add")}
            </button>
          </div>
          {skills.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              {skills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    borderRadius: 99,
                    background: D.blueSoft,
                    color: D.blue,
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  {skill}
                  <button
                    type="button"
                    aria-label={t("search.removeSkill", { skill })}
                    onClick={() => setSkills(skills.filter((s) => s !== skill))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, display: "flex" }}
                  >
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: D.ink }}>
              {t("search.resultsLabel")}
            </span>
            <input
              type="number"
              min={1}
              max={MAX_TOP_K}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              style={{ ...field, width: 90 }}
            />
          </label>

          <span style={{ flex: 1 }} />

          <button
            type="button"
            onClick={runSearch}
            disabled={!summary.trim() || searching}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 20px",
              border: "none",
              borderRadius: 7,
              background: D.blue,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: !summary.trim() || searching ? "default" : "pointer",
              opacity: !summary.trim() || searching ? 0.55 : 1,
            }}
          >
            {searching ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Search size={14} strokeWidth={2} />
            )}
            {searching ? t("search.searching") : t("search.search")}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "9px 12px",
              borderRadius: 6,
              background: `${tint("red", "0D")}`,
              border: `1px solid ${tint("red", "28")}`,
              color: D.red,
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {results !== null && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 600, color: D.ink, margin: 0 }}>
              {t("search.countOf", { visible: visible.length, total: results.length })}
            </h2>
            <span style={{ flex: 1 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: D.muted, whiteSpace: "nowrap" }}>
                {t("search.minMatch")}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(threshold * 100)}
                onChange={(e) => setThreshold(Number(e.target.value) / 100)}
                aria-label={t("search.minMatchAria")}
                style={{ width: 180, accentColor: D.blue }}
              />
              <span
                style={{
                  fontFamily: D.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: D.blue,
                  minWidth: 38,
                }}
              >
                {Math.round(threshold * 100)}%
              </span>
            </label>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visible.length === 0 && (
              <div
                style={{
                  padding: 28,
                  textAlign: "center",
                  color: D.muted,
                  fontSize: 13,
                  background: D.canvas,
                  border: `1px solid ${D.line}`,
                  borderRadius: 10,
                }}
              >
                {results.length === 0
                  ? t("search.noMatch")
                  : t("search.noneAbove", { pct: Math.round(threshold * 100) })}
              </div>
            )}

            {visible.map((r) => (
              <ResultCard
                key={r.candidate_uuid}
                result={r}
                onOpen={() =>
                  router.push(`/candidate-profile/enriched?uuid=${r.candidate_uuid}`)
                }
              />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

function ResultCard({
  result,
  onOpen,
}: {
  result: FindCandidateResult;
  onOpen: () => void;
}) {
  const t = useT();
  const percent = Math.round(result.overall_score * 100);
  const contact = [result.email, result.phone].filter(
    (value): value is string => Boolean(value) && !isMasked(value),
  );

  return (
    <div
      onClick={onOpen}
      style={{
        background: D.canvas,
        border: `1px solid ${D.line}`,
        borderRadius: 10,
        padding: 16,
        cursor: "pointer",
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <div
        title={t("search.relevanceTitle", { pct: percent })}
        style={{
          flexShrink: 0,
          width: 54,
          height: 54,
          borderRadius: 10,
          background: D.blueSoft,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: D.blue, fontFamily: D.mono }}>
          {percent}
        </span>
        <span style={{ fontSize: 8.5, color: D.blue, opacity: 0.75 }}>{t("search.matchBadge")}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Heading là nhãn ẩn danh theo uuid — cùng chuẩn với dashboard và
            trang profile. Kết quả tìm kiếm không mang tên ứng viên cho bất kỳ
            role nào, nên thiếu dòng này thì mọi card của tech lead đều mở đầu
            bằng cùng một câu "Summary hidden" và không phân biệt được nhau. */}
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: D.ink,
            fontFamily: D.mono,
            marginBottom: 4,
          }}
        >
          {result.full_name && !isMasked(result.full_name)
            ? result.full_name
            : anonymousCandidateLabel(result.candidate_uuid)}
        </div>

        {contact.length > 0 && (
          <div style={{ color: D.muted, fontSize: 11.5, marginBottom: 6 }}>
            {contact.join(" · ")}
          </div>
        )}

        {/* Tóm tắt bị che với tech_lead — hiện lời giải thích thay vì ba dấu
            sao trần trụi, để người dùng biết đó là chính sách chứ không phải
            dữ liệu thiếu. */}
        {isMasked(result.summary) ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: D.dim,
              fontStyle: "italic",
            }}
          >
            <Sparkles size={11} strokeWidth={1.8} />
            {t("search.summaryHidden")}
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: D.ink,
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {result.summary}
          </p>
        )}

        {result.skills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
            {result.skills.slice(0, 8).map((skill) => (
              <span
                key={skill}
                style={{
                  padding: "2px 7px",
                  borderRadius: 4,
                  background: D.surface,
                  border: `1px solid ${D.lineSoft}`,
                  fontSize: 10.5,
                  color: D.sub,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
