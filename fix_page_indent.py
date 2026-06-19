with open("src/web/app/lessons/[id]/page.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(len(lines)):
    if lines[i].startswith("const guidance ="):
        lines[i] = "      " + lines[i]
    if lines[i].startswith("} catch (err: any) {"):
        lines[i] = "    " + lines[i]

with open("src/web/app/lessons/[id]/page.tsx", "w", encoding="utf-8") as f:
    f.writelines(lines)
