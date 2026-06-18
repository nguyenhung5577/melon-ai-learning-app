import re

with open("src/web/app/lessons/[id]/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

conflict1_pattern = r"<<<<<<< HEAD\n      setHintText\(data\.guidance \|\| \"Gợi ý: đọc lại đề hỏi gì, gạch dữ kiện quan trọng, rồi chọn phép tính phù hợp\. Con làm được mà!\"\);\n=======\n\n      const guidance = \(data\.guidance as string\) \|\| \"Làm từng bước nhé\.\";\n      setHintText\(guidance\);\n>>>>>>> origin/dev"
content = re.sub(conflict1_pattern, 'const guidance = (data.guidance as string) || "Làm từng bước nhé.";\n      setHintText(guidance);', content)

conflict2_pattern = r"<<<<<<< HEAD\n    } catch \(err: any\) {\n      setHintText\(err\.message \|\| \"Gợi ý: đọc lại đề hỏi gì, gạch dữ kiện quan trọng, rồi chọn phép tính phù hợp\. Con làm được mà!\"\);\n=======\n    } catch {\n      setHintText\(\"Đọc lại đề, tìm dữ kiện, rồi làm từng bước\.\"\);\n>>>>>>> origin/dev"
content = re.sub(conflict2_pattern, '} catch (err: any) {\n      setHintText(err.message || "Đọc lại đề, tìm dữ kiện, rồi làm từng bước.");', content)

with open("src/web/app/lessons/[id]/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
