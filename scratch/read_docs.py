import sys
from docx import Document
sys.stdout.reconfigure(encoding='utf-8')

try:
    doc = Document(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\pa\pa2\SDP-v2.docx')
    for p in doc.paragraphs[:50]:
        if p.text.strip():
            print(p.text)
except Exception as e:
    print(e)
