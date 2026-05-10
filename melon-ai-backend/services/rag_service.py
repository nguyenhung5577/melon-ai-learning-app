import os
import fitz # PyMuPDF
import chromadb
import torch
from transformers import AutoTokenizer, AutoModel
from dotenv import load_dotenv

load_dotenv()

# Setup Local Contriever
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
rag_tokenizer = AutoTokenizer.from_pretrained("facebook/contriever")
rag_model = AutoModel.from_pretrained("facebook/contriever").to(device)
rag_model.eval()

def _mean_pool(last_hidden: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    mask = attention_mask.unsqueeze(-1).float()
    summed = (last_hidden * mask).sum(dim=1)
    counts = mask.sum(dim=1).clamp(min=1e-9)
    return summed / counts

def get_embeddings(texts: list[str]) -> list[list[float]]:
    inputs = rag_tokenizer(texts, padding=True, truncation=True, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = rag_model(**inputs)
    embeddings = _mean_pool(outputs.last_hidden_state, inputs["attention_mask"])
    return embeddings.cpu().tolist()

# Local Vector DB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
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

    # Generate embeddings via Contriever
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