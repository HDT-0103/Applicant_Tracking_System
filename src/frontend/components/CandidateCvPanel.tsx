"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Download, ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import { D } from "../lib/shared";
import { useT } from "../lib/i18n";
import { getCandidateCvLink } from "../services/candidateCvService";

/**
 * Panel bên trái của Split-Screen Workspace: CV gốc của ứng viên.
 *
 * Cả màn hình này tồn tại để người duyệt ĐỐI CHIẾU — phân tích do AI sinh ra ở
 * một bên, tài liệu thật ở bên kia. Thiếu bên tài liệu thì không có gì để đối
 * chiếu, và người duyệt buộc phải tin phần tóm tắt mà không kiểm được.
 *
 * ## Vì sao là `<iframe>` chứ không phải react-pdf
 *
 * Trình xem PDF của trình duyệt đã render từng trang, cuộn, phóng to và hiện
 * "trang N / M" sẵn. Kéo `react-pdf` về đổi lấy một thư viện nữa, một worker
 * phải cấu hình riêng cho Next.js, và khoảng 300KB bundle — để làm lại đúng
 * thứ trình duyệt đã làm tốt.
 *
 * Link là SAS URL có hạn 15 phút, xin qua endpoint CÓ xác thực. `<iframe>`
 * không gắn được header, nên phải xin link trước rồi mới nạp — đúng lý do
 * endpoint đó trả JSON thay vì redirect.
 */
export function CandidateCvPanel({
  candidateUuid,
  candidateName,
}: {
  candidateUuid: string;
  candidateName?: string | null;
}) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!candidateUuid) {
      setState("missing");
      return;
    }
    setState("loading");
    setMessage(null);
    try {
      const link = await getCandidateCvLink(candidateUuid);
      setUrl(link.url);
      setDownloadUrl(link.download_url ?? link.url);
      setState("ready");
    } catch (err) {
      // 404 nghĩa là "hồ sơ này không có CV" — một trạng thái bình thường, và
      // cũng là câu trả lời cho tech lead ngoài hội đồng. Cả hai đều KHÔNG
      // phải lỗi hệ thống, nên không hiện như lỗi.
      const notFound = err instanceof Error && /not found/i.test(err.message);
      setState(notFound ? "missing" : "error");
      if (!notFound) {
        // Không dịch ở đây: `load` là dependency của effect nạp CV, kéo `t`
        // vào là đổi ngôn ngữ sẽ xin lại link. Thiếu thông điệp thì dịch lúc vẽ.
        setMessage(err instanceof Error ? err.message : null);
      }
    }
  }, [candidateUuid]);

  useEffect(() => {
    // `void` chứ không để promise trôi: `load` tự bắt lỗi bên trong, nhưng một
    // promise không ai giữ vẫn bị runtime ghi nhận là unhandled rejection.
    void load();
  }, [load]);

  const iconButton: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 9px",
    borderRadius: 5,
    border: `1px solid ${D.line}`,
    background: D.canvas,
    color: D.sub,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        style={{
          height: 38,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 14px",
          borderBottom: `1px solid ${D.line}`,
          background: D.canvas,
        }}
      >
        <FileText size={13} strokeWidth={1.8} color={D.blue} />
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: D.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={candidateName ?? undefined}
        >
          {candidateName ? t("candidate.cv.titleFor", { name: candidateName }) : t("candidate.cv.originalCv")}
        </span>

        <span style={{ flex: 1 }} />

        {state === "ready" && url && (
          <>
            <a href={url} target="_blank" rel="noopener noreferrer" style={iconButton}>
              <ExternalLink size={11} strokeWidth={2} />
              {t("common.open")}
            </a>
            {/* Thuộc tính `download` bị trình duyệt bỏ qua với link khác
                origin, nên phần "tải về" do máy chủ lưu trữ quyết bằng
                Content-Disposition trên `download_url`. */}
            <a href={downloadUrl ?? url} download style={iconButton}>
              <Download size={11} strokeWidth={2} />
              {t("common.download")}
            </a>
          </>
        )}
        {state === "error" && (
          <button type="button" onClick={load} style={iconButton}>
            <RefreshCw size={11} strokeWidth={2} />
            {t("common.retry")}
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, background: D.surface, position: "relative" }}>
        {state === "loading" && (
          <Centered>
            <Loader2 size={20} strokeWidth={1.8} color={D.blue} className="animate-spin" />
            <span>{t("candidate.cv.loading")}</span>
          </Centered>
        )}

        {state === "missing" && (
          <Centered>
            <FileText size={22} strokeWidth={1.5} color={D.dim} />
            <span>{t("candidate.cv.missing")}</span>
          </Centered>
        )}

        {state === "error" && (
          <Centered tone={D.red}>
            <AlertCircle size={22} strokeWidth={1.5} color={D.red} />
            <span>{message ?? t("candidate.cv.couldNotLoad")}</span>
          </Centered>
        )}

        {state === "ready" && url && (
          <iframe
            key={url}
            src={url}
            title={t("candidate.cv.frameTitle")}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        )}
      </div>
    </div>
  );
}

function Centered({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: 24,
        textAlign: "center",
        fontSize: 12,
        color: tone ?? D.muted,
      }}
    >
      {children}
    </div>
  );
}
