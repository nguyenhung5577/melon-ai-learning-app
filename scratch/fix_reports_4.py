import re
filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    br = f.read()
br = br.replace('2 Lỗi (Bugs)', '3 Lỗi (Bugs)')
bug3 = """
## 3. Bug 03: Bất đồng bộ Cập nhật trạng thái Tài khoản Pro sau khi thanh toán
- **Mức độ (Severity):** 🔴 High (Nghiêm trọng - Thất thoát quyền lợi Khách hàng)
- **Mô tả:** Sau khi Phụ huynh mua gói Pro thành công qua Stripe, tài khoản vẫn bị hiển thị là "Free" trên trang Quản lý của Admin và không sử dụng được tính năng VIP.
- **Bước tái hiện:**
  1. Dùng thẻ test Stripe mua thành công gói Pro.
  2. Truy cập vào Dashboard của Admin -> Xem danh sách Users.
- **Kết quả thực tế:** User đó vẫn ở trạng thái `Free` do dữ liệu Webhook chỉ lưu ở collection `subscriptions`.
- **Vị trí Code cần Fix:** File `src/web/app/api/v1/stripe/webhook/route.ts` - Bổ sung logic update `isPro: true` vào collection `users` hoặc đồng bộ trạng thái User Profile để Admin dashboard đọc được.
"""
if '---' in br:
    # We replace the second '---' separator
    parts = br.split('---')
    if len(parts) >= 3:
        parts[1] = parts[1] + bug3 + '\n'
        br = '---'.join(parts)
    else:
        br = br.replace('---', bug3 + '\n---', 1)
else:
    br += '\n' + bug3
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(br)
