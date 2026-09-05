// Gom từ điển theo namespace. Mỗi file một màn hình / một nhóm component;
// key đặt dạng "<namespace>.<tên>" để không đụng nhau giữa các file.
//
// Thêm namespace mới: tạo messages/<ns>.ts export `const <ns>Messages`,
// rồi nối vào đây. __tests__/i18n.test.ts bắt key trùng và key thiếu EN/VI.
import { commonMessages } from "./common";
import { navMessages } from "./nav";
import { accountMessages } from "./account";
import { settingsMessages } from "./settings";
import { dashboardMessages } from "./dashboard";
import { searchMessages } from "./search";
import { analyticsMessages } from "./analytics";
import { scheduleMessages } from "./schedule";
import { jobsMessages } from "./jobs";
import { careersMessages } from "./careers";
import { candidateMessages } from "./candidate";
import { adminMessages } from "./admin";
import { authMessages } from "./auth";

export type Message = { en: string; vi: string };

export const MESSAGE_GROUPS = {
  common: commonMessages,
  nav: navMessages,
  account: accountMessages,
  settings: settingsMessages,
  dashboard: dashboardMessages,
  search: searchMessages,
  analytics: analyticsMessages,
  schedule: scheduleMessages,
  jobs: jobsMessages,
  careers: careersMessages,
  candidate: candidateMessages,
  admin: adminMessages,
  auth: authMessages,
} as const;

export const MESSAGES = {
  ...commonMessages,
  ...navMessages,
  ...accountMessages,
  ...settingsMessages,
  ...dashboardMessages,
  ...searchMessages,
  ...analyticsMessages,
  ...scheduleMessages,
  ...jobsMessages,
  ...careersMessages,
  ...candidateMessages,
  ...adminMessages,
  ...authMessages,
} as const;

export type MessageKey = keyof typeof MESSAGES;
