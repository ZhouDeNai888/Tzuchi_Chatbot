from langchain_core.documents import Document
import json
import os
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
import sys
import asyncio
sys.stdout.reconfigure(encoding='utf-8')

def clean_filename(url):
    parsed_url = urlparse(url)
    domain = parsed_url.netloc.replace('.', '_')  # Replace dots with underscores
    path = parsed_url.path.strip("/")
    if not path:
        return domain
    path = re.sub(r'[^a-zA-Z0-9_]', '_', path)
    return f"{domain}_{path}"

def get_unique_filename(directory, filename):
    base, ext = os.path.splitext(filename)
    counter = 1
    unique_filename = filename
    while os.path.exists(os.path.join(directory, unique_filename)):
        unique_filename = f"{base}_{counter}{ext}"
        counter += 1
    return unique_filename


def extract_articles(soup, url):
    # Remove <script> and <style> tags
    for script_or_style in soup(["script", "style"]):
        script_or_style.decompose()

    articles = []
    seen_texts = set()
    for element in soup.find_all(True):  # Iterate through all tags
        element_text = element.get_text(separator="\n", strip=True)
        element_text = re.sub(r'\s+', ' ', element_text).strip()  # Normalize whitespace
        if element_text and len(element_text) > 20 and element_text not in seen_texts:  # Filter short or duplicate texts
            if element.name == "a" and element.get("href"):  # If it's an <a> tag with an href
                link = urljoin(url, element["href"])
                element_text = f"{element_text} ({link})"
            seen_texts.add(element_text)
            articles.append(element_text)  # Only keep the text, not as a dict
    return articles


async def crawl(url, depth=0, max_depth=1, saved_files=None, visited=None):
    if saved_files is None:
        saved_files = []
    if visited is None:
        visited = set()

    if url in visited or depth > max_depth:
        return saved_files
    visited.add(url)

    print(f"{'  '*depth}🟢 Crawling: {url}")
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36")
            page = await context.new_page()
            await page.goto(url, timeout=60000)
            await page.wait_for_timeout(3000)
            html = await page.content()
            await browser.close()
    except Exception as e:
        print(f"{'  '*depth}❌ Error: {e}")
        return saved_files

    soup = BeautifulSoup(html, "html.parser")

    # Extract articles
    articles = extract_articles(soup, url)
    
    # Format as LangChain documents - this is the proper LangChain Document object
    documents = []
    for article in articles:
        # Create a proper LangChain Document object
        doc = Document(
            page_content=article,
            metadata={
                "source": url,
                "title": soup.title.string if soup.title else url
            }
        )
        documents.append(doc)
    
    return documents


