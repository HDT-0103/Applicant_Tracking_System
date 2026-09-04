"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Link nộp hồ sơ công khai của một tin, kèm nút copy.
 *
 * Link KHÔNG được lưu trong DB — nó suy ra từ `id + job_title` (lib/jobUrl),
 * nên dựng lại được ở bất kỳ đâu. Trước đây ô này chỉ nằm ở bước 3 của wizard
 * tạo tin và trong modal publish, nên vào lại tin là "mất link"; nay trang
 * chi tiết tin luôn hiện nó.
 */
export function ShareLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Public application link
      </span>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 flex-1 min-w-0 rounded-lg border border-border bg-[#f8f9fb] px-3
            text-xs font-mono text-foreground outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={copy}
          className="h-9 shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-white
            transition-colors hover:bg-primary-hover flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Share this link anywhere. Every CV submitted through it is attached to this job only.
      </p>
    </div>
  );
}
