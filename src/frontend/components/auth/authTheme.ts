// --- Auth Design Tokens (B2B Minimalist / High-contrast Light) ---------------
// Phẳng, sắc nét, radius 6px, không neon/gradient. Kế thừa palette từ lib/shared (D).
import { D } from "../../lib/shared";

export const T = {
  font: D.font,

  // Surfaces
  page: "#FFFFFF",
  panel: D.surface, // #FAFBFC — panel thương hiệu bên phải
  ink: D.ink, //   #0D1117
  sub: D.sub, //   #3D4451
  muted: D.muted, // #6B7280
  dim: D.dim, //   #9CA3AF

  // Lines & borders (razor-sharp)
  line: D.line, //     #E2E4E9
  lineSoft: D.lineSoft, // #ECEEF2

  // Accent (đơn sắc, không gradient)
  primary: D.blue, //     #1B62F0
  primaryInk: "#FFFFFF",
  primaryHover: "#1550CC",
  ring: "rgba(27,98,240,0.28)",

  // Feedback
  danger: D.red, //   #DC2626
  dangerBg: "rgba(220,38,38,0.06)",
  dangerLine: "rgba(220,38,38,0.28)",

  // Shape
  radius: 6,
  field: 42, // chiều cao input/button
} as const;

export const dotGrid =
  "radial-gradient(" + T.line + " 1px, transparent 1px)";
