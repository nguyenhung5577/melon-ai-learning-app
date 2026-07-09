import re
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md', 'r', encoding='utf-8') as f:
    tp = f.read()

tp = re.sub(r'(\|\s*4\s*\|\s*AUTH-04\s*\|.*?\| )\[!\]', r'\1[x]', tp)
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md', 'w', encoding='utf-8') as f:
    f.write(tp)

with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md', 'r', encoding='utf-8') as f:
    br = f.read()

br = re.sub(r'## 1\. Bug 01: Frontend không hiển thị cảnh báo khi sai mật khẩu \(AUTH-04\).*?(?=## 2\.)', '', br, flags=re.DOTALL)
br = br.replace('5 Lỗi (Bugs)', '4 Lỗi (Bugs)')
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md', 'w', encoding='utf-8') as f:
    f.write(br)
