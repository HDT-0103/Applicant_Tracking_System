"""
LinkedIn Profile Scraper sử dụng Renidly API
Đọc danh sách URL từ Excel, cào dữ liệu hồ sơ qua API thương mại Renidly
"""

import re
import time
import requests
import pandas as pd
from tqdm import tqdm
from dotenv import load_dotenv
from typing import Dict, Optional, List
import os

# Tải cấu hình từ file .env
load_dotenv()

# Cấu hình API Key từ biến môi trường
API_KEY = os.getenv("RENIDLY_API_KEY", "")

# Cấu hình API Endpoint
RENIDLY_API_URL = "https://renidly.com/api/data/v1/people/profile"

# Cấu hình Retry
MAX_RETRIES = 3
BASE_DELAY = 2  # giây
INCREMENTAL_SAVE_INTERVAL = 5  # Lưu sau mỗi 5 hồ sơ thành công


def extract_handle(linkedin_url: str) -> Optional[str]:
    """
    Bóc tách handle (username) từ URL LinkedIn sử dụng Regex
    
    Args:
        linkedin_url: URL LinkedIn (ví dụ: https://linkedin.com/in/ryanroslansky/)
    
    Returns:
        Chuỗi handle hoặc None nếu URL không hợp lệ
    """
    if not linkedin_url or pd.isna(linkedin_url):
        return None
    
    # Regex để bóc tách handle từ URL LinkedIn
    # Hỗ trợ các định dạng:
    # - https://linkedin.com/in/username
    # - https://www.linkedin.com/in/username/
    # - https://linkedin.com/in/username?utm_source=...
    pattern = r"linkedin\.com/in/([^/?]+)"
    match = re.search(pattern, linkedin_url.strip())
    
    if match:
        return match.group(1)
    
    return None


def fetch_profile(handle: str) -> Optional[Dict]:
    """
    Gọi API Renidly để lấy dữ liệu profile với cơ chế Auto-Retry
    
    Args:
        handle: Username LinkedIn (ví dụ: ryanroslansky)
    
    Returns:
        Dictionary chứa dữ liệu profile hoặc None nếu thất bại sau khi retry
    """
    headers = {
        "X-renidly-apikey": API_KEY
    }
    
    params = {
        "handle": handle
    }
    
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(
                RENIDLY_API_URL,
                headers=headers,
                params=params,
                timeout=30
            )
            
            # Kiểm tra mã lỗi rate limit (429) hoặc lỗi hệ thống (1074)
            if response.status_code == 429:
                if attempt < MAX_RETRIES - 1:
                    # Exponential backoff: 2^attempt * BASE_DELAY
                    delay = (2 ** attempt) * BASE_DELAY
                    print(f"Rate limit hit. Đợi {delay} giây trước khi retry...")
                    time.sleep(delay)
                    continue
                else:
                    print(f"Rate limit exceeded cho handle {handle} sau {MAX_RETRIES} lần thử")
                    return None
            
            # Kiểm tra response thành công
            if response.status_code == 200:
                data = response.json()
                
                # Kiểm tra success flag trong response
                if data.get("success", False):
                    return data
                else:
                    error_code = data.get("error_code", "UNKNOWN")
                    message = data.get("message", "Unknown error")
                    print(f"API trả về lỗi cho handle {handle}: {message} (Error Code: {error_code})")
                    return None
            else:
                print(f"HTTP Error {response.status_code} cho handle {handle}")
                if attempt < MAX_RETRIES - 1:
                    delay = (2 ** attempt) * BASE_DELAY
                    time.sleep(delay)
                    continue
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"Lỗi mạng khi fetch handle {handle}: {str(e)}")
            if attempt < MAX_RETRIES - 1:
                delay = (2 ** attempt) * BASE_DELAY
                time.sleep(delay)
                continue
            return None
    
    return None


def parse_profile_json(api_response: Dict) -> Dict:
    """
    Trích xuất dữ liệu an toàn từ JSON response của Renidly API
    
    Args:
        api_response: Response JSON từ API Renidly
    
    Returns:
        Dictionary chứa các trường đã được trích xuất an toàn
    """
    if not api_response or not api_response.get("success", False):
        return {}
    
    data = api_response.get("data", {})
    
    # Trích xuất thông tin cơ bản với .get() phòng thủ
    result = {
        "handle": data.get("handle", ""),
        "full_name": data.get("fullName", ""),
        "headline": data.get("headline", ""),
        "location": data.get("location", ""),
        "industry": data.get("industry", ""),
        "profile_url": data.get("profileUrl", ""),
        "email": "",
        "phone": "",
        "current_company": "",
        "current_title": "",
        "tenure": ""
    }
    
    # Trích xuất email nếu có
    contact_info = data.get("contactInfo", {})
    if isinstance(contact_info, dict):
        result["email"] = contact_info.get("emailAddress", "")
        result["phone"] = contact_info.get("phoneNumber", "")
    
    # Trích xuất vị trí hiện tại từ mảng positions
    # Lấy phần tử đầu tiên (vị trí gần nhất)
    positions = data.get("positions", [])
    if positions and isinstance(positions, list) and len(positions) > 0:
        current_position = positions[0]
        if isinstance(current_position, dict):
            result["current_company"] = current_position.get("companyName", "")
            result["current_title"] = current_position.get("title", "")
            
            # Tính tenure (thời gian công tác)
            start_date = current_position.get("startDate", {})
            end_date = current_position.get("endDate", {})
            
            if isinstance(start_date, dict):
                year = start_date.get("year", "")
                month = start_date.get("month", "")
                if year:
                    tenure = f"{month}/{year}" if month else str(year)
                    if end_date and isinstance(end_date, dict):
                        end_year = end_date.get("year", "")
                        end_month = end_date.get("month", "")
                        if end_year:
                            end_str = f"{end_month}/{end_year}" if end_month else str(end_year)
                            tenure += f" - {end_str}"
                        else:
                            tenure += " - Present"
                    else:
                        tenure += " - Present"
                    result["tenure"] = tenure
    
    return result


def main():
    """
    Hàm chính: Đọc Excel, cào dữ liệu, lưu kết quả với incremental saving
    """
    # Kiểm tra API Key
    if not API_KEY:
        print("LỖI: Không tìm thấy RENIDLY_API_KEY trong file .env")
        print("Vui lòng thêm dòng sau vào file .env:")
        print("RENIDLY_API_KEY=your_api_key_here")
        return
    
    # File paths
    input_file = "linkedin_profiles.xlsx"
    output_file = "linkedin_scraped_results.xlsx"
    
    # Kiểm tra file input
    if not os.path.exists(input_file):
        print(f"LỖI: Không tìm thấy file input: {input_file}")
        print("Vui lòng tạo file Excel chứa cột 'Linkedin_URL' với danh sách URL LinkedIn")
        return
    
    # Đọc file Excel input
    print(f"Đang đọc file input: {input_file}")
    try:
        df = pd.read_excel(input_file)
    except Exception as e:
        print(f"Lỗi khi đọc file Excel: {str(e)}")
        return
    
    # Kiểm tra cột Linkedin_URL
    if "Linkedin_URL" not in df.columns:
        print("LỖI: File Excel không chứa cột 'Linkedin_URL'")
        print("Vui lòng đảm bảo file có cột tên chính xác là 'Linkedin_URL'")
        return
    
    # Lấy danh sách URL
    urls = df["Linkedin_URL"].tolist()
    total_urls = len(urls)
    
    print(f"Tìm thấy {total_urls} URL LinkedIn để cào")
    print("-" * 50)
    
    # Khởi tạo danh sách kết quả
    results = []
    success_count = 0
    fail_count = 0
    
    # Progress bar với tqdm
    with tqdm(total=total_urls, desc="Cào LinkedIn Profiles", unit="profile") as pbar:
        for idx, url in enumerate(urls):
            # Bóc tách handle từ URL
            handle = extract_handle(url)
            
            if not handle:
                print(f"\nURL không hợp lệ: {url}")
                results.append({
                    "original_url": url,
                    "handle": "",
                    "full_name": "",
                    "headline": "",
                    "location": "",
                    "industry": "",
                    "profile_url": "",
                    "email": "",
                    "phone": "",
                    "current_company": "",
                    "current_title": "",
                    "tenure": "",
                    "status": "INVALID_URL"
                })
                fail_count += 1
                pbar.update(1)
                continue
            
            # Gọi API để fetch profile
            api_response = fetch_profile(handle)
            
            if api_response:
                # Parse dữ liệu từ JSON
                profile_data = parse_profile_json(api_response)
                profile_data["original_url"] = url
                profile_data["handle"] = handle
                profile_data["status"] = "SUCCESS"
                
                results.append(profile_data)
                success_count += 1
                
                # Incremental saving: Lưu sau mỗi N hồ sơ thành công
                if success_count % INCREMENTAL_SAVE_INTERVAL == 0:
                    temp_df = pd.DataFrame(results)
                    temp_df.to_excel(output_file, index=False)
                    print(f"\nĐã lưu tạm {success_count} hồ sơ vào {output_file}")
            else:
                # Ghi log thất bại nhưng vẫn tiếp tục
                results.append({
                    "original_url": url,
                    "handle": handle,
                    "full_name": "",
                    "headline": "",
                    "location": "",
                    "industry": "",
                    "profile_url": "",
                    "email": "",
                    "phone": "",
                    "current_company": "",
                    "current_title": "",
                    "tenure": "",
                    "status": "API_FAILED"
                })
                fail_count += 1
            
            # Cập nhật progress bar
            pbar.update(1)
            pbar.set_postfix({
                "Success": success_count,
                "Failed": fail_count
            })
    
    # Lưu kết quả cuối cùng
    print("\n" + "=" * 50)
    print(f"Hoàn thành! Tổng kết:")
    print(f"- Thành công: {success_count}")
    print(f"- Thất bại: {fail_count}")
    print(f"- Tổng: {total_urls}")
    
    if results:
        final_df = pd.DataFrame(results)
        final_df.to_excel(output_file, index=False)
        print(f"\nĐã lưu kết quả đầy đủ vào: {output_file}")
    else:
        print("\nKhông có dữ liệu nào được cào thành công")


if __name__ == "__main__":
    main()
