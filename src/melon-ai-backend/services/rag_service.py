import os
import fitz # PyMuPDF
import chromadb
import hashlib
import math
import re
from dotenv import load_dotenv
from chromadb.config import Settings

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Avoid noisy telemetry warning from Chroma in local dev.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

EMBEDDING_DIM = 384

def _tokenize(text: str) -> list[str]:
    return re.findall(r"\b\w+\b", text.lower())

def _hash_embedding(text: str) -> list[float]:
    vector = [0.0] * EMBEDDING_DIM
    for token in _tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIM
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]

def get_embeddings(texts: list[str]) -> list[list[float]]:
    return [_hash_embedding(text) for text in texts]

# Local Vector DB
chroma_client = chromadb.PersistentClient(
    path="./chroma_db",
    settings=Settings(anonymized_telemetry=False)
)
try:
    collection = chroma_client.create_collection(name="melon_documents")
except Exception:
    collection = chroma_client.get_collection(name="melon_documents")

def extract_text_from_pdf(filepath: str) -> list[str]:
    doc = fitz.open(filepath)
    pages = []
    for page in doc:
        text = page.get_text("text").strip()
        if text:
            pages.append(text)
    return pages

def chunk_text(text: str, max_words=30) -> list[str]:
    words = text.split()
    chunks = [" ".join(words[i:i + max_words]) for i in range(0, len(words), max_words)]
    return chunks

def ingest_document(filepath: str, file_id: str):
    pages = extract_text_from_pdf(filepath)
    all_chunks = []
    for page in pages:
        all_chunks.extend(chunk_text(page))

    # Generate lightweight local embeddings without external model downloads.
    embeddings = get_embeddings(all_chunks)

    ids = [f"{file_id}_chunk_{i}" for i in range(len(all_chunks))]
    metadatas = [{"file_id": file_id} for _ in range(len(all_chunks))]

    # Store in DB
    collection.add(
        embeddings=embeddings,
        documents=all_chunks,
        metadatas=metadatas,
        ids=ids
    )
    return len(all_chunks)

def retrieve_context(query: str, file_id: str = None, top_k=1):
    query_emb = get_embeddings([query])[0]

    # query DB
    where_clause = {"file_id": file_id} if file_id else None
    results = collection.query(
        query_embeddings=[query_emb],
        n_results=top_k,
        where=where_clause
    )

    return " ".join(results["documents"][0]) if results["documents"] else ""
