import sys
from pathlib import Path

# Add src/backend to path
sys.path.insert(0, str(Path(__file__).parent / "src" / "backend"))

from modules.ingestion.application.ingestion_service import (
    extract_text_and_links_from_pdf,
    parse_github_and_linkedin_from_links
)

pdf_path = Path("uploads/2f276bed-951f-4292-a339-1b42c255df2f.pdf")
if len(sys.argv) > 1:
    pdf_path = Path(sys.argv[1])

print(f"Testing with PDF: {pdf_path}")
resume_text, links = extract_text_and_links_from_pdf(str(pdf_path))
print(f"Found {len(links)} links")
github_username, linkedin_url = parse_github_and_linkedin_from_links(links)
print(f"Extracted GitHub username: {github_username}")
print(f"Extracted LinkedIn URL: {linkedin_url}")
