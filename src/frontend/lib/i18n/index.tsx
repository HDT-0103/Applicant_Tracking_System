"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MESSAGES, type MessageKey } from "./messages";

/**
 * Đa ngôn ngữ (Anh / Việt) cho toàn bộ giao diện.
 *
 * Cách dùng trong component:
 *
 *     const t = useT();
 *     <h1>{t("dashboard.title")}</h1>
 *     <p>{t("dashboard.welcome", { name: user.name })}</p>
 *
 * Từ điển nằm ở ./messages/<namespace>.ts, mỗi key mang CẢ HAI ngôn ngữ cạnh
 * nhau (`{ en, vi }`) để không bao giờ có key dịch một nửa;
 * __tests__/i18n.test.ts bắt key thiếu một bên.
 *
 * Không có provider (test đơn vị render component trần) thì t() trả tiếng
 * Anh — nên test hiện có vẫn khớp chuỗi cũ. Thiếu key thì trả về chính key
 * để nhìn ra ngay trên màn hình thay vì ô trống.
 */
export type Lang = "en" | "vi";

export const LANG_STORAGE_KEY = "smartats_lang";
export const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "vi", label: "Tiếng Việt" },
];

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: MessageKey | string, vars?: Vars): string {
  const entry = (MESSAGES as Record<string, { en: string; vi: string }>)[key];
  let text = entry ? entry[lang] || entry.en : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
}

export function readStoredLang(): Lang | null {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    return raw === "en" || raw === "vi" ? raw : null;
  } catch {
    return null;
  }
}

/** Ngôn ngữ mặc định: đã lưu → theo trình duyệt → Anh. */
export function detectLang(): Lang {
  const stored = readStoredLang();
  if (stored) return stored;
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  return nav.toLowerCase().startsWith("vi") ? "vi" : "en";
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey | string, vars?: Vars) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => undefined,
  t: (key, vars) => translate("en", key, vars),
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(detectLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* private mode: vẫn đổi được cho phiên này */
    }
  }, []);

  const t = useCallback((key: MessageKey | string, vars?: Vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLang = () => useContext(LanguageContext);
export const useT = () => useContext(LanguageContext).t;
