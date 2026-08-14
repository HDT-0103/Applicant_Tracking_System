import re
import structlog

from bs4 import BeautifulSoup
from markdownify import markdownify as md
from playwright.async_api import async_playwright

from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)


REMOVE_TAGS = ["script", "style", "nav", "footer", "header", "noscript", "iframe", "svg"]
REMOVE_CLASSES = re.compile(
    r"(feed-shared|profile-background|artdeco|ad-banner|promoted|comment|reaction)", re.I
)


def _clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag_name in REMOVE_TAGS:
        for tag in soup.find_all(tag_name):
            tag.decompose()
    for element in soup.find_all(class_=REMOVE_CLASSES):
        element.decompose()
    return str(soup)


def _html_to_markdown(html: str) -> str:
    text = md(
        html,
        heading_style="ATX",
        strip=["img", "a"],
        bullets="-",
    )
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"^\s*[-*]\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


class LinkedInScraperService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.playwright = None
        self.browser = None
        self.context = None

    async def _init_browser(self):
        try:
            if not self.playwright:
                self.playwright = await async_playwright().start()
            if not self.browser:
                self.browser = await self.playwright.chromium.launch(headless=True)
            
            context_kwargs = {
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "viewport": {"width": 1920, "height": 1080}
            }
            self.context = await self.browser.new_context(**context_kwargs)
            
            if self.settings.linkedin_cookie:
                await self.context.add_cookies([{
                    "name": "li_at",
                    "value": self.settings.linkedin_cookie,
                    "domain": ".www.linkedin.com",
                    "path": "/"
                }])
        except Exception as e:
            logger.warning("linkedin.scraper.init_failed", error=str(e))
            # Continue gracefully without browser

    async def scrape_to_markdown(self, linkedin_url: str) -> str | None:
        try:
            logger.info("linkedin.scraper.start", url=linkedin_url)
            await self._init_browser()
            
            if not self.context:
                logger.warning("linkedin.scraper.no_browser", url=linkedin_url)
                return None
            
            page = await self.context.new_page()
            
            await page.goto(linkedin_url, wait_until="networkidle")
            
            # Auto scroll for lazy loading
            await page.evaluate("""
                async () => {
                    let lastHeight = document.body.scrollHeight;
                    for (let i = 0; i < 5; i++) {
                        window.scrollTo(0, document.body.scrollHeight);
                        await new Promise(r => setTimeout(r, 1500));
                        let newHeight = document.body.scrollHeight;
                        if (newHeight === lastHeight) break;
                        lastHeight = newHeight;
                    }
                    window.scrollTo(0, 0);
                }
            """)
            
            raw_html = await page.content()
            await page.close()
            
            cleaned = _clean_html(raw_html)
            markdown = _html_to_markdown(cleaned)

            if len(markdown) < 100:
                logger.warning("linkedin.scraper.too_short", url=linkedin_url, length=len(markdown))
                return None

            logger.info("linkedin.scraper.success", url=linkedin_url, length=len(markdown))
            return markdown

        except Exception as e:
            logger.warning("linkedin.scraper.unexpected_error", url=linkedin_url, error=str(e))
            return None

    async def close(self):
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except:
            pass
