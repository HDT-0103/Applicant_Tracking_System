#!/usr/bin/env python3
import sys
from pathlib import Path
import json

# Add src/backend to path
sys.path.insert(0, str(Path(__file__).parent / "src" / "backend"))

def _extract_embedded_links(page):
    urls = []
    try:
        annots = page.get("/Annots")
        if not annots:
            return urls
        for ref in annots:
            try:
                annot = ref.get_object()
                if annot.get("/Subtype") != "/Link":
                    continue
                action = annot.get("/A")
                if action and "/URI" in action:
                    url = str(action["/URI"]).strip()
                    if url:
                        urls.append(url)
            except Exception:
                continue
    except Exception:
        pass
    return urls


def extract_text_and_links_from_pdf(pdf_path):
    try:
        import pypdf
        reader = pypdf.PdfReader(pdf_path)
        pages = []
        all_links = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
            embedded = _extract_embedded_links(page)
            if embedded:
                pages.append("--- EMBEDDED SOCIAL LINKS ---")
                pages.extend(embedded)
                all_links.extend(embedded)
        full_text = "\n\n".join(pages) if pages else None
        return full_text, all_links
    except Exception as e:
        print(f"Error: {e}")
        return None, []


def parse_github_and_linkedin_from_links(links):
    github_username = None
    linkedin_url = None

    for link in links:
        if "github.com" in link:
            try:
                parts = link.rstrip("/").split("/")
                if len(parts) >= 2:
                    for i, part in enumerate(parts):
                        if part in ("github.com", "www.github.com") and i + 1 < len(parts):
                            candidate = parts[i+1]
                            if candidate and candidate not in ("orgs", "sponsors", "features", "marketplace", "about", "contact", "pricing", "login", "signup"):
                                github_username = candidate
                                break
            except Exception as e:
                print(f"GitHub parse error: {e}")

        if "linkedin.com" in link:
            linkedin_url = link

    return github_username, linkedin_url


def test_pdf_ingestion():
    print("=" * 80)
    print("TEST 1: EXTRACT TEXT & LINKS FROM PDF")
    print("=" * 80)

    upload_dir = Path(__file__).parent / "uploads"
    if not upload_dir.exists():
        print("Uploads directory not found!")
        return

    pdf_files = list(upload_dir.glob("*.pdf"))
    if not pdf_files:
        print("No PDFs found in uploads folder!")
        return

    print(f"\nFound {len(pdf_files)} PDFs in uploads folder!")

    for pdf_path in pdf_files:
        print(f"\nTesting {pdf_path.name}")
        print("-" * 80)

        text, links = extract_text_and_links_from_pdf(str(pdf_path))

        if links:
            print(f"\nFound {len(links)} embedded links:")
            for i, link in enumerate(links, 1):
                print(f"  {i}. {link}")

            github_username, linkedin_url = parse_github_and_linkedin_from_links(links)
            print(f"\nExtracted social links:")
            print(f"   GitHub Username: {github_username}")
            print(f"   LinkedIn URL:    {linkedin_url}")

            if github_username:
                print("\nSUCCESS! We found GitHub!")
            else:
                print("\nNo GitHub found in links!")

            if linkedin_url:
                print("SUCCESS! We found LinkedIn!")
            else:
                print("No LinkedIn found in links!")

        else:
            print("\nNo embedded links found!")


if __name__ == "__main__":
    test_pdf_ingestion()
