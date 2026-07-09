import re
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md', 'r', encoding='utf-8') as f:
    tp = f.read()

tp = re.sub(r'(\|\s*19\s*\|\s*PARSE-04\s*\|.*?\| )\[!\]', r'\1[x]', tp)
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md', 'w', encoding='utf-8') as f:
    f.write(tp)

with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md', 'r', encoding='utf-8') as f:
    br = f.read()

br = re.sub(r'## 2\. Bug 02: Lỗi Tốn Token AI khi Upload PDF Nhiều Trang \(PARSE-04\).*?(?=## 3\.)', '', br, flags=re.DOTALL)
br = br.replace('4 Lỗi (Bugs)', '3 Lỗi (Bugs)')
br = br.replace('## 3. Bug 03:', '## 1. Bug 01:')
br = br.replace('## 4. Bug 04:', '## 2. Bug 02:')
br = br.replace('## 5. Bug 05:', '## 3. Bug 03:')
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md', 'w', encoding='utf-8') as f:
    f.write(br)
