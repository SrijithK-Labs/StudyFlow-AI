from bs4 import BeautifulSoup
import httpx
import urllib.parse
import re
import time
import random

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]


class SearchService:
    def __init__(self):
        self._consecutive_failures = 0
        self._rate_limit_until: float | None = None

    def _is_file_attachment(self, query: str) -> bool:
        pattern = r'^\[(?:File Attached|Image):.*\]$'
        return bool(re.match(pattern, query.strip()))

    def _get_headers(self) -> dict:
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    def search_web(self, query: str, max_results: int = 5) -> list[dict]:
        if self._is_file_attachment(query):
            return []

        if self._rate_limit_until and time.time() < self._rate_limit_until:
            return []

        results = self._try_bing(query, max_results)
        if results:
            self._consecutive_failures = 0
            return results

        time.sleep(0.3)
        results = self._try_ddg_lite(query, max_results)
        if results:
            self._consecutive_failures = 0
            return results

        time.sleep(0.3)
        results = self._try_ddg_html(query, max_results)
        if results:
            self._consecutive_failures = 0
            return results

        self._consecutive_failures += 1
        if self._consecutive_failures >= 3:
            backoff = min(60 * (self._consecutive_failures - 2), 600)
            self._rate_limit_until = time.time() + backoff
        return []

    def _try_ddg_lite(self, query: str, max_results: int) -> list[dict]:
        try:
            url = "https://lite.duckduckgo.com/lite/"
            data = {"q": query}
            with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                resp = client.post(url, data=data, headers=self._get_headers())

            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "html.parser")
            results = []

            for tr in soup.select("tr.result"):
                td_link = tr.select_one("td.result-link a")
                td_snippet = tr.select_one("td.result-snippet")
                if td_link:
                    title = td_link.text.strip()
                    href = td_link.get("href", "")
                    snippet = td_snippet.text.strip() if td_snippet else ""
                    if title and href:
                        results.append({
                            "title": title,
                            "url": href,
                            "snippet": snippet,
                        })
                        if len(results) >= max_results:
                            break

            return results

        except Exception:
            return []

    def _try_ddg_html(self, query: str, max_results: int) -> list[dict]:
        try:
            url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(query)}"
            with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                resp = client.get(url, headers=self._get_headers())

            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "html.parser")
            results = []
            for r_div in soup.find_all("div", class_="result"):
                a_title = r_div.find("a", class_="result__a")
                a_snippet = r_div.find("a", class_="result__snippet")
                if not a_title:
                    continue

                title = a_title.text.strip()
                raw_href = a_title.get("href", "")

                target_url = raw_href
                if "uddg=" in raw_href:
                    parsed_qs = urllib.parse.parse_qs(urllib.parse.urlparse(raw_href).query)
                    if "uddg" in parsed_qs:
                        target_url = parsed_qs["uddg"][0]
                elif raw_href.startswith("//"):
                    target_url = "https:" + raw_href

                snippet = a_snippet.text.strip() if a_snippet else ""
                results.append({
                    "title": title,
                    "url": target_url,
                    "snippet": snippet,
                })
                if len(results) >= max_results:
                    break

            return results

        except Exception:
            return []

    def _try_bing(self, query: str, max_results: int) -> list[dict]:
        try:
            url = f"https://www.bing.com/search?q={urllib.parse.quote_plus(query)}"
            with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                resp = client.get(url, headers=self._get_headers())

            if resp.status_code != 200:
                return []

            soup = BeautifulSoup(resp.text, "html.parser")
            results = []

            for li in soup.select("li.b_algo"):
                h2 = li.select_one("h2 a")
                snippet = li.select_one(".b_caption p")
                if h2:
                    title = h2.text.strip()
                    href = h2.get("href", "")
                    snippet_text = snippet.text.strip() if snippet else ""
                    results.append({
                        "title": title,
                        "url": href,
                        "snippet": snippet_text,
                    })
                    if len(results) >= max_results:
                        break

            return results

        except Exception:
            return []


search_service = SearchService()
