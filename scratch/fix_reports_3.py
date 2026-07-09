import re
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md', 'r', encoding='utf-8') as f:
    tp = f.read()

tp = re.sub(r'(\|\s*52\s*\|\s*PERF-01\s*\|.*?\| )\[!\]', r'\1[x]', tp)
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md', 'w', encoding='utf-8') as f:
    f.write(tp)

with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md', 'r', encoding='utf-8') as f:
    br = f.read()

br = re.sub(r'## 2\. Bug 02: Race Condition Nhân 5 Lần Điểm EXP \(PERF-01\).*?(?=## 3\.)', '', br, flags=re.DOTALL)
br = br.replace('3 Lỗi (Bugs)', '2 Lỗi (Bugs)')
br = br.replace('## 3. Bug 03:', '## 2. Bug 02:')
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md', 'w', encoding='utf-8') as f:
    f.write(br)
