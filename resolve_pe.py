import re

with open("src/web/components/problems/PersonalizedExercisePanel.tsx", "r", encoding="utf-8") as f:
    content = f.read()

conflict_pattern = r"<<<<<<< HEAD\n      setHintText\(data\.guidance \|\| \"Gợi ý: đọc lại đề hỏi gì, gạch dữ kiện quan trọng, rồi chọn phép tính phù hợp\.\"\);\n    } catch \(err: any\) {\n      setHintText\(err\.message \|\| \"Gợi ý: đọc lại đề hỏi gì, tìm dữ kiện cần dùng, rồi thử giải bằng một phép tính đơn giản trước\.\"\);\n=======\n      setHintText\(data\.guidance \|\| \"Đọc lại đề rồi làm từng bước\.\"\);\n    } catch {\n      setHintText\(\"Đọc lại đề rồi làm từng bước\.\"\);\n>>>>>>> origin/dev"
content = re.sub(conflict_pattern, 'setHintText(data.guidance || "Đọc lại đề rồi làm từng bước.");\n    } catch (err: any) {\n      setHintText(err.message || "Đọc lại đề rồi làm từng bước.");', content)

with open("src/web/components/problems/PersonalizedExercisePanel.tsx", "w", encoding="utf-8") as f:
    f.write(content)
