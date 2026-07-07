import fitz  # PyMuPDF
from docx import Document
import io
import os
import numpy as np
from PIL import Image
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Initialize EasyOCR reader (lazy loading to save memory)
_ocr_reader = None
_executor = ThreadPoolExecutor(max_workers=4) # 4 concurrent pages

def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        # GPU enabled - RTX 3060 detected
        _ocr_reader = easyocr.Reader(['en'], gpu=True) 
    return _ocr_reader

def ocr_page_sync(reader, img_data):
    """Synchronous OCR helper to be run in executor"""
    results = reader.readtext(img_data)
    return " ".join([res[1] for res in results])

async def extract_text_from_blob(blob: bytes, filename: str) -> str:
    """
    Extracts text from a file blob based on its extension.
    Supported: .pdf, .docx, .txt
    With OCR fallback for scanned PDFs (Multi-threaded & Non-blocking).
    """
    ext = filename.split('.')[-1].lower()
    loop = asyncio.get_event_loop()
    
    try:
        if ext == 'pdf':
            doc = fitz.open(stream=blob, filetype="pdf")
            text = ""
            scanned_pages = []
            
            for page_num, page in enumerate(doc):
                page_text = page.get_text().strip()
                if len(page_text) < 50:
                    scanned_pages.append(page_num)
                text += page_text + "\n"
            
            if scanned_pages:
                try:
                    reader = get_ocr_reader()
                    
                    async def process_page(p_num):
                        page = doc[p_num]
                        # Balanced resolution (2x) for speed vs accuracy
                        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) 
                        img_data = pix.tobytes("png")
                        # Offload blocking OCR call to thread pool
                        return await loop.run_in_executor(_executor, ocr_page_sync, reader, img_data)

                    # Process all scanned pages in parallel
                    tasks = [process_page(p_num) for p_num in scanned_pages]
                    page_results = await asyncio.gather(*tasks)
                    ocr_text = "\n".join(page_results)
                    
                    if len(ocr_text) > len(text) * 0.5:
                        return ocr_text if len(text) < 100 else text + "\n---\nOCR EXTRACTED:\n" + ocr_text
                except Exception:
                    pass
            
            return text
            
        elif ext == 'docx':
            doc = Document(io.BytesIO(blob))
            return "\n".join([para.text for para in doc.paragraphs])
            
        elif ext == 'txt':
            return blob.decode('utf-8', errors='ignore')
            
        return ""
    except Exception:
        return ""
