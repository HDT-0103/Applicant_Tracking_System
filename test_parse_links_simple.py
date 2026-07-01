import pypdf
import sys
from pathlib import Path


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
        # Parse GitHub URL to get username
        if "github.com" in link:
            try:
                # Remove trailing slashes, split by /
                parts = link.rstrip("/").split("/")
                # Find the part after github.com - should be username
                if len(parts) >= 2:
                    for i, part in enumerate(parts):
                        if part in ("github.com", "www.github.com") and i + 1 < len(parts):
                            candidate = parts[i+1]
                            # Skip if it's "orgs" or "sponsors" etc.
                            if candidate and candidate not in ("orgs", "sponsors", "features", "marketplace", "about", "contact", "pricing", "login", "signup"):
                                github_username = candidate
                                break
            except Exception as e:
                print(f"GitHub parse error: {e}")
        
        # Keep LinkedIn URL as-is
        if "linkedin.com" in link:
            linkedin_url = link
    
    return github_username, linkedin_url


pdf_path = Path("uploads/2f276bed-951f-4292-a339-1b42c255df2f.pdf")
if len(sys.argv) > 1:
    pdf_path = Path(sys.argv[1])

print(f"Testing with PDF: {pdf_path}")
resume_text, links = extract_text_and_links_from_pdf(str(pdf_path))
print(f"Found {len(links)} links")
github_username, linkedin_url = parse_github_and_linkedin_from_links(links)
print(f"Extracted GitHub username: {github_username}")
print(f"Extracted LinkedIn URL: {linkedin_url}")
