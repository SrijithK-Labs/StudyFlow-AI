"""
Module 5 — Knowledge Retriever (Adaptive RAG)
Dynamically adjusts retrieval strategy based on query complexity.
Simple questions get fast answers, complex ones get deeper retrieval.
"""
import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class KnowledgeContext:
    documents: str
    search_raw: str
    search_results: list[dict] = field(default_factory=list)
    total_chars: int = 0
    retrieval_strategy: str = "basic"
    query_complexity: str = "simple"
    chunks_used: int = 0


class KnowledgeRetriever:
    """
    Adaptive RAG: selects retrieval strategy based on query complexity.
    """

    # Keywords that signal complex queries needing deep retrieval
    COMPLEX_SIGNALS = [
        "compare", "difference", "vs", "versus",
        "explain in detail", "deep dive", "comprehensive",
        "how does .* work", "why does", "what if",
        "architecture", "design pattern", "trade-off",
        "pros and cons", "advantages", "disadvantages",
    ]

    # Keywords that signal simple lookups
    SIMPLE_SIGNALS = [
        "what is", "define", "meaning of", "translate",
        "hi", "hello", "hey", "thanks",
    ]

    def __init__(self, search_service: Any, document_service: Any):
        self.search = search_service
        self.documents = document_service

    def _assess_complexity(self, query: str) -> str:
        """Determine query complexity: simple, moderate, or complex."""
        q = query.lower().strip()

        for signal in self.SIMPLE_SIGNALS:
            if signal in q and len(q) < 30:
                return "simple"

        for signal in self.COMPLEX_SIGNALS:
            if re.search(signal, q):
                return "complex"

        if len(q) > 80 or q.count("?") > 1:
            return "complex"

        if len(q) > 30:
            return "moderate"

        return "simple"

    def _select_strategy(self, complexity: str, needs_search: bool) -> str:
        """Select retrieval strategy based on complexity."""
        if complexity == "simple":
            return "basic"
        if complexity == "moderate":
            return "targeted"
        if complexity == "complex":
            return "deep"
        return "basic"

    async def retrieve(
        self,
        query: str,
        workspace_id: str,
        needs_search: bool = False,
    ) -> KnowledgeContext:
        complexity = self._assess_complexity(query)
        strategy = self._select_strategy(complexity, needs_search)

        doc_text = ""
        search_list = []
        search_raw = ""
        chunks_used = 0

        # ── Document retrieval ──────────────────────────────────
        try:
            docs = await self.documents.get_workspace_docs(workspace_id)

            if strategy == "basic":
                # Simple: just grab top 3 docs, 2000 chars each
                for doc in docs[:3]:
                    text = doc.get("content_text", doc.get("extracted_text", ""))
                    if text:
                        doc_name = doc.get("name", "Unnamed")
                        doc_text += f"--- DOCUMENT: {doc_name} ---\n{text[:2000]}\n\n"
                        chunks_used += 1

            elif strategy == "targeted":
                # Moderate: more docs, 3000 chars each
                query_words = set(query.lower().split())
                scored_docs = []
                for doc in docs:
                    text = doc.get("content_text", doc.get("extracted_text", ""))
                    if not text:
                        continue
                    doc_words = set(text.lower().split())
                    overlap = len(query_words & doc_words)
                    scored_docs.append((overlap, doc))
                scored_docs.sort(key=lambda x: x[0], reverse=True)
                for _, doc in scored_docs[:5]:
                    text = doc.get("content_text", doc.get("extracted_text", ""))
                    doc_name = doc.get("name", "Unnamed")
                    doc_text += f"--- DOCUMENT: {doc_name} ---\n{text[:3000]}\n\n"
                    chunks_used += 1

            else:  # deep
                # Complex: all docs, 4000 chars each, plus web search always
                for doc in docs[:10]:
                    text = doc.get("content_text", doc.get("extracted_text", ""))
                    if text:
                        doc_name = doc.get("name", "Unnamed")
                        doc_text += f"--- DOCUMENT: {doc_name} ---\n{text[:4000]}\n\n"
                        chunks_used += 1

        except Exception:
            pass

        # ── Web search ──────────────────────────────────────────
        # Always search for complex queries, even if not explicitly requested
        should_search = needs_search or complexity == "complex"

        # Skip search for file attachment messages
        import re as _re
        if _re.match(r'^\[(?:File Attached|Image):.*\]$', query.strip()):
            should_search = False

        if should_search:
            try:
                # For complex queries, also search with expanded terms
                search_queries = [query]
                if complexity == "complex":
                    # Add a "vs" search for comparison queries
                    if " vs " in query.lower() or "difference" in query.lower():
                        search_queries.append(query.replace(" vs ", " compared to "))

                for sq in search_queries[:2]:
                    results = self.search.search_web(sq)
                    search_list.extend(results)

                if search_list:
                    from datetime import datetime
                    today = datetime.now().strftime("%B %d, %Y")
                    search_raw = f"--- REAL-TIME SEARCH RESULTS (As of {today}) ---\n"
                    seen_urls = set()
                    idx = 1
                    for res in search_list:
                        url = res.get("url", "")
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)
                        search_raw += f"[{idx}] Title: {res.get('title', 'N/A')}\n"
                        search_raw += f"    Source: {url}\n"
                        search_raw += f"    Snippet: {res.get('snippet', 'No snippet available.')}\n\n"
                        idx += 1
                else:
                    search_raw = "No search results found."

            except Exception:
                search_raw = "Search unavailable."

        total_chars = len(doc_text) + len(search_raw)

        return KnowledgeContext(
            documents=doc_text,
            search_raw=search_raw,
            search_results=search_list,
            total_chars=total_chars,
            retrieval_strategy=strategy,
            query_complexity=complexity,
            chunks_used=chunks_used,
        )
