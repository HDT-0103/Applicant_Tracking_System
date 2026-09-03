import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Neo workspace root về gốc repo.
  //
  // Next dò ngược lên trên để tìm root và trước đây chọn phải
  // `/Users/admin/package-lock.json` — tức thư mục home của máy. Build trace vì
  // vậy tính từ một gốc nằm ngoài repo: kết quả phụ thuộc vào máy ai đang
  // build, và trên máy khác sẽ ra khác.
  //
  // File này phải nằm trong src/frontend chứ không phải gốc repo: Next đọc
  // next.config từ THƯ MỤC DỰ ÁN (tham số của `next build`), nên bản ở gốc
  // trước đây chưa từng được nạp — cảnh báo chọn nhầm root vẫn còn nguyên.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
