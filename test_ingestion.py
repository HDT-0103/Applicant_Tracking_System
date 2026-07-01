#!/usr/bin/env python3
import sys
from pathlib import Path
import json

# Add src/backend to path
sys.path.insert(0, str(Path(__file__).parent / "src" / "backend"))

from modules.ingestion.application.ingestion_service import (
    extract_text_and_links_from_pdf,
    parse_github_and_linkedin_from_links
)

def test_pdf_ingestion():
    print("=" * 80)
    print("TEST 1: EXTRACT TEXT & LINKS FROM PDF")
    print("=" * 80)
    
    # Check uploads folder
    upload_dir = Path(__file__).parent / "uploads"
    if not upload_dir.exists():
        print("❌ Uploads directory not found!")
        return
    
    # Get all PDFs in uploads
    pdf_files = list(upload_dir.glob("*.pdf"))
    if not pdf_files:
        print("❌ No PDFs found in uploads folder!")
        return
    
    print(f"\n✅ Found {len(pdf_files)} PDFs in uploads folder!")
    
    for pdf_path in pdf_files:
        print(f"\n📄 Testing {pdf_path.name}")
        print("-" * 80)
        
        text, links = extract_text_and_links_from_pdf(str(pdf_path))
        
        if links:
            print(f"\n✅ Found {len(links)} embedded links:")
            for i, link in enumerate(links, 1):
                print(f"  {i}. {link}")
                
            github_username, linkedin_url = parse_github_and_linkedin_from_links(links)
            print(f"\n✅ Extracted social links:")
            print(f"   GitHub Username: {github_username}")
            print(f"   LinkedIn URL:    {linkedin_url}")
            
            if github_username:
                print("\n🎉 SUCCESS! We found GitHub!")
            else:
                print("\n⚠️ No GitHub found in links!")
                
            if linkedin_url:
                print("🎉 SUCCESS! We found LinkedIn!")
            else:
                print("⚠️ No LinkedIn found in links!")
                
        else:
            print("\n❌ No embedded links found!")
            
if __name__ == "__main__":
    test_pdf_ingestion()
