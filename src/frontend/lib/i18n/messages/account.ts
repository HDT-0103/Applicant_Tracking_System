import type { Message } from "./index";

/** Menu tài khoản ở header. */
export const accountMessages = {
  "account.menu": { en: "Account menu", vi: "Menu tài khoản" },
  "account.settings": { en: "Settings", vi: "Cài đặt" },
  "account.logout": { en: "Log out", vi: "Đăng xuất" },
} satisfies Record<string, Message>;
