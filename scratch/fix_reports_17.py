import re

filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
stt = 1
count_x = 0
count_fail = 0
count_skip = 0
count_empty = 0

for i, line in enumerate(lines):
    if line.strip().startswith('|'):
        parts = line.split('|')
        if len(parts) >= 8:
            num_str = parts[1].strip()
            if num_str.isdigit():
                status_match = re.search(r'\[(.*?)\]', parts[-2])
                status = status_match.group(1).strip() if status_match else ' '
                
                if status == 'x' or status == 'X':
                    count_x += 1
                    status = 'x'
                elif status == '!':
                    count_fail += 1
                elif status == '-':
                    count_skip += 1
                else:
                    count_empty += 1
                    status = ' '
                
                parts[1] = f" {stt:3d} "
                parts[-2] = f" [{status}]        "
                lines[i] = '|'.join(parts)
                stt += 1

content = '\n'.join(lines)
total = stt - 1

summary = f"""**Tóm tắt trạng thái:**

- Tổng số Test Cases: {total} kịch bản.
- Đạt `[x]`: {count_x} kịch bản.
- Báo Lỗi `[!]`: {count_fail} kịch bản.
- Chưa code tính năng `[-]`: {count_skip} kịch bản.
- Chưa test `[ ]`: {count_empty} kịch bản.
- Trạng thái chung: Hoàn tất quá trình Review & Gọt dũa kịch bản thực tế.
"""

content = re.sub(r'\*\*Tóm tắt trạng thái:\*\*.*', summary.strip() + '\n', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
