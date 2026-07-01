import pypdf
import sys
from pathlib import Path

def _extract_embedded_links(page: pypdf._page.PageObject) -> list[str]:
    """Extract hidden hyperlink URLs from PDF annotations (/Annots -> /Link -> /A -> /URI)."""
    urls: list[str] = []
    try:
        print(f"DEBUG: Checking page for annotations...")
        annots = page.get("/Annots")
        if not annots:
            print("DEBUG: No annotations found on page")
            return urls
        print(f"DEBUG: Found {len(annots)} annotations")
        for i, ref in enumerate(annots):
            try:
                annot = ref.get_object()
                print(f"DEBUG: Annotation {i}: subtype={annot.get('/Subtype')}, keys={list(annot.keys())}")
                if annot.get("/Subtype") != "/Link":
                    continue
                action = annot.get("/A")
                print(f"DEBUG: Link action: {action}")
                if action and "/URI" in action:
                    url = str(action["/URI"]).strip()
                    print(f"DEBUG: Found URL: {url}")
                    if url:
                        urls.append(url)
            except Exception as e:
                print(f"DEBUG: Error processing annotation {i}: {e}")
                continue
    except Exception as e:
        print(f"DEBUG: Error extracting links: {e}")
    return urls

def test_pdf(pdf_path: str):
    print(f"Testing PDF: {pdf_path}")
    try:
        reader = pypdf.PdfReader(pdf_path)
        print(f"PDF has {len(reader.pages)} pages")
        
        all_urls = []
        for page_num, page in enumerate(reader.pages):
            print(f"\n--- Page {page_num + 1} ---")
            urls = _extract_embedded_links(page)
            print(f"Extracted links from page {page_num + 1}: {urls}")
            all_urls.extend(urls)
            
            # Also print some text to see what's there
            text = page.extract_text()
            if text:
                print(f"First 200 chars of text: {text[:200]}")
        
        print(f"\nTotal URLs found: {len(all_urls)}")
        print(f"All URLs: {all_urls}")
        return all_urls
        
    except Exception as e:
        print(f"Error reading PDF: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    pdf_path = Path("uploads/2f276bed-951f-4292-a339-1b42c255df2f.pdf")
    if len(sys.argv) > 1:
        pdf_path = Path(sys.argv[1])
    test_pdf(str(pdf_path))
