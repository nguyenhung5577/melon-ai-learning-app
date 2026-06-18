import re

with open("src/web/components/problems/ProblemParserPanel.tsx", "r", encoding="utf-8") as f:
    content = f.read()

conflict_pattern = r"<<<<<<< HEAD\n          \{!canParse \? \(\n            <div\n              className=\{cn\(\n                \"w-full min-h-28 border-2 border-dashed border-nb-red rounded-xl\",\n                \"bg-\[#ffebeb\] flex flex-col items-center justify-center gap-2 p-4\"\n              \)\}\n            >\n              <AlertCircle className=\"w-6 h-6 text-nb-red\" />\n              <span className=\"text-sm font-bold text-nb-red\">Tính năng yêu cầu gói Pro</span>\n              <span className=\"text-\[0\.7rem\] font-semibold text-nb-red\">\n                Vui lòng nhờ Phụ huynh nâng cấp để sử dụng AI đọc đề\n              </span>\n            </div>\n          \) : \(\n            <button\n              type=\"button\"\n              onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\}\n              className=\{cn\(\n                \"w-full min-h-28 border-2 border-dashed border-nb-black rounded-xl\",\n                \"bg-nb-bg cursor-pointer flex flex-col items-center justify-center gap-2 p-4\",\n                \"hover:bg-nb-yellow/30 transition-colors\"\n              \)\}\n            >\n              <Upload className=\"w-6 h-6\" />\n              <span className=\"text-sm font-bold\">Upload PDF, DOCX hoặc ảnh nhiều trang</span>\n              <span className=\"text-\[0\.7rem\] text-\[#555\]\">\n                \{files\.length > 0 \? `Đã chọn \$\{files\.length\} file` : \"JPG, PNG, PDF, DOCX, TXT\"\}\n              </span>\n            </button>\n          \)\n=======\n          <button\n            type=\"button\"\n            onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\}\n            className=\{cn\(\n              \"w-full min-h-28 border-2 border-dashed border-nb-black rounded-xl\",\n              \"bg-nb-bg cursor-pointer flex flex-col items-center justify-center gap-2 p-4\",\n              \"hover:bg-nb-yellow/30 transition-colors\"\n            \)\}\n          >\n            <Upload className=\"w-6 h-6\" />\n            <span className=\"text-sm font-bold\">T\?i t\?p l\?n</span>\n            <span className=\"text-\[0\.7rem\] text-\[#555\]\">\n              \{files\.length > 0 \? `Đã chọn \$\{files\.length\} file` : \"JPG, PNG, PDF, DOCX, TXT\"\}\n            </span>\n          </button>\n>>>>>>> origin/dev"

replacement = '''{!canParse ? (
            <div
              className={cn(
                "w-full min-h-28 border-2 border-dashed border-nb-red rounded-xl",
                "bg-[#ffebeb] flex flex-col items-center justify-center gap-2 p-4"
              )}
            >
              <AlertCircle className="w-6 h-6 text-nb-red" />
              <span className="text-sm font-bold text-nb-red">Tính năng yêu cầu gói Pro</span>
              <span className="text-[0.7rem] font-semibold text-nb-red">
                Vui lòng nhờ Phụ huynh nâng cấp để sử dụng AI đọc đề
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full min-h-28 border-2 border-dashed border-nb-black rounded-xl",
                "bg-nb-bg cursor-pointer flex flex-col items-center justify-center gap-2 p-4",
                "hover:bg-nb-yellow/30 transition-colors"
              )}
            >
              <Upload className="w-6 h-6" />
              <span className="text-sm font-bold">Tải tệp lên</span>
              <span className="text-[0.7rem] text-[#555]">
                {files.length > 0 ? `Đã chọn ${files.length} file` : "JPG, PNG, PDF, DOCX, TXT"}
              </span>
            </button>
          )}'''
content = re.sub(conflict_pattern, replacement, content)

with open("src/web/components/problems/ProblemParserPanel.tsx", "w", encoding="utf-8") as f:
    f.write(content)
