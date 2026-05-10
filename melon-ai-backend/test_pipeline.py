import os
import json
import uuid
import fitz # PyMuPDF
from dotenv import load_dotenv
from services.rag_service import ingest_document, retrieve_context
from services.llm_service import generate_lesson_content
# Tải env
load_dotenv()


def run_test():
    print("=== BẮT ĐẦU TEST PIPELINE ===")

    # 1. Tạo file PDF mẫu
    pdf_filename = "sample_test.pdf"
    doc = fitz.open()
    page = doc.new_page()
    lesson_text = (
        "Dinosaurs are a diverse group of reptiles of the clade Dinosauria. "
        "They first appeared during the Triassic period, between 243 and 233 million years ago. "
        "Paleontologists have identified over 1,000 distinct dinosaur species. "
        "The Tyrannosaurus Rex (T-Rex) is one of the most well-known carnivorous dinosaurs, "
        "while the Triceratops is another famous species with three horns.\n\n"
        "Marie Curie is the first person who discovered Uranium.\n\n"
        "Unit testing is a special and popular test to distinguish between the computer and human answer."
    )
    # Use insert_textbox instead of insert_text to wrap text, otherwise PyMuPDF cuts it at the margin
    rect = fitz.Rect(50, 50, 550, 800)
    page.insert_textbox(rect, lesson_text, fontsize=12)
    doc.save(pdf_filename)
    print(f"\n[1] Đã tạo file PDF mẫu: {pdf_filename}")

    # 2. Test Ingest (Băm & Tokenize lên GPU)
    file_id = str(uuid.uuid4())
    print(f"\n[2] Đang băm và import vào Vector DB (File ID: {file_id})...")
    num_chunks = ingest_document(pdf_filename, file_id)
    print(f"    -> Thành công! Đã lưu {num_chunks} chunk(s) vào ChromaDB cục bộ.")

    # 3. Test Retrieval RAG
    topic = "Unit testing"
    query = f"{topic}"
    print(f"\n[3] Đang tìm kiếm vector cho query: '{query}'...")
    retrieved_context = retrieve_context(query=query, file_id=file_id, top_k=2)
    print(f"    -> Context trích xuất được:\n       {retrieved_context}")

    # 4. Test LLM Generation (Sinh Text Mộc)
    print(f"\n[4] Đang đưa Context vào Model 7B để sinh câu hỏi/bài tập (Sẽ mất thời gian chạy infer)...")
    print(topic + retrieved_context)
    try:
        final_output = generate_lesson_content(topic=topic, context=retrieved_context)
        print("\n[5] KẾT QUẢ OUTPUT TỪ LLM:")
        print(final_output)
    except Exception as e:
        print(f"\n[!] LỖI KHI SINH: {e}")

if __name__ == "__main__":
    run_test()