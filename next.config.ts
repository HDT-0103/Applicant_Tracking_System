import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Neo workspace root về đúng thư mục repo.
  //
  // Next dò ngược lên trên để tìm root và trước đây chọn phải
  // `/Users/admin/package-lock.json` — tức thư mục home của máy. Build trace vì
  // vậy tính từ một gốc nằm ngoài repo: kết quả phụ thuộc vào máy ai đang
  // build, và trên máy khác sẽ ra khác.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
