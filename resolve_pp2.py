import re

with open("src/web/components/problems/ProblemParserPanel.tsx", "r", encoding="utf-8") as f:
    content = f.read()

start = content.find("<<<<<<< HEAD")
end = content.find(">>>>>>> origin/dev") + len(">>>>>>> origin/dev")

if start != -1 and end != -1:
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
    content = content[:start] + replacement + content[end:]
    
    with open("src/web/components/problems/ProblemParserPanel.tsx", "w", encoding="utf-8") as f:
        f.write(content)
