giải thích yêu cầu sau, xem nó có khả thi không, lên kế hoạch thực hiện chứ chưa thực hiện:
Thiết kế freemium model cho app. Subscription sẽ có quyền truy cập các tính năng như tự gen đề, tự upload đề và parse ra bằng AI. Với user không trả phí, chỉ được học materials tracking có sẵn và giới hạn tối đa 2 children.



12:11 AM






Yêu cầu này nghĩa là cần thêm mô hình phân quyền theo gói sử dụng cho Melon.
Cụ thể app sẽ có 2 nhóm chính:
Nhóm user	Quyền
Free	Học materials có sẵn, tracking tiến độ, tối đa 2 child accounts
Paid / Subscription	Có thêm quyền tự upload đề, tự parse đề bằng AI, tự generate đề/bài luyện

Nói ngắn gọn: không phải chỉ thêm UI “nâng cấp gói”, mà cần một lớp entitlement / feature gating ở cả frontend và backend API.
Có Khả Thi Không?
Khả thi. App hiện đã có nền khá phù hợp:
Có Firebase Auth.
Có Firestore users, children.
Có parent/child role.
Có các API cần bị giới hạn:/api/parents/children
/api/v1/problems/parse
/api/v1/rag/ingest
/api/v1/exercise/generate
/api/upload
/admin/question-bank
/admin/pdf-upload

Có parent dashboard và family flow để áp giới hạn 2 children.
Có Firebase Admin SDK trong server routes, đủ để kiểm tra plan server-side.
Phần chưa có là payment provider như Stripe/MoMo/ZaloPay. Nhưng có thể làm theo 2 phase:
Phase 1: Subscription model nội bộ bằng Firestore, admin/manual set plan.
Phase 2: Tích hợp payment thật, webhook tự update subscription.
Thiết Kế Đề Xuất
Thêm trường subscription vào users/{uid} hoặc collection riêng.
Ví dụ trong users/{parentUid}:
subscription: {
  plan: "free" | "pro",
  status: "active" | "inactive" | "trialing" | "past_due",
  startedAt?: string,
  expiresAt?: string,
  provider?: "manual" | "stripe" | "momo",
  customerId?: string
}
Hoặc tách collection:
subscriptions/{uid}
Mình nghiêng về subscriptions/{uid} vì sạch hơn, dễ mở rộng payment/webhook.
Entitlements
Tạo bảng quyền trung tâm:
free:
  maxChildren: 2
  canUseExistingMaterials: true
  canTrackProgress: true
  canUploadProblems: false
  canParseProblemsWithAI: false
  canGenerateExercises: false
  canUploadRagPdf: false

pro:
  maxChildren: unlimited hoặc 10
  canUseExistingMaterials: true
  canTrackProgress: true
  canUploadProblems: true
  canParseProblemsWithAI: true
  canGenerateExercises: true
  canUploadRagPdf: true
Các Chỗ Cần Chặn
Backend API phải chặn, frontend chỉ để UX đẹp hơn.
Tính năng	Chặn ở đâu
Tạo child thứ 3	/api/parents/children
Upload đề	/api/upload, /api/v1/problems/parse
Parse đề bằng AI	/api/v1/problems/parse, rubric/classify routes nếu có
Generate đề/bài	/api/v1/exercise/generate, /api/v1/rag/quiz
Upload PDF RAG	/api/v1/rag/ingest
Admin question bank?	Tùy: admin có thể bypass hoặc vẫn theo plan

Luồng UX
Free parent:
Vào /family, nếu đã có 2 children:Disable Create Child.
Hiển thị message: “Free plan supports up to 2 child profiles.”

Vào /practice hoặc /admin/question-bank upload/parse:Thấy paywall modal/card.
Không cho bấm parse/upload.

Vẫn học được:/lessons
/study nếu dùng materials/question bank có sẵn
/progress
/parent

Paid parent:
Không bị giới hạn 2 children.
Có thể upload đề.
Có thể parse AI.
Có thể generate đề/bài luyện.
Có thể upload PDF để RAG/generate lesson.
Kế Hoạch Thực Hiện
Khảo sát route/tính năng cần gating
Liệt kê toàn bộ API có chi phí AI/upload.
Xác định route nào cần free/pro.

Tạo subscription domain
lib/subscription/types.ts
lib/subscription/plans.ts
lib/subscription/entitlements.ts
Hàm getUserSubscription(uid)
Hàm getEntitlements(subscription)

Tạo server-side guard
requireFirebaseUser(req)
requireEntitlement(req, entitlementName)
assertChildLimit(parentUid)

Áp guard vào API tạo child
Trong /api/parents/children, trước khi tạo child:Đếm số child hiện tại.
Nếu free và >= 2, trả 403.


Áp guard vào API AI/upload
/api/v1/problems/parse
/api/v1/exercise/generate
/api/v1/rag/ingest
/api/v1/rag/quiz
/api/upload nếu upload dùng cho đề/PDF premium
Có thể trả response chuẩn:

{
  "error": "subscription_required",
  "message": "Upgrade to Pro to use AI problem parsing.",
  "requiredPlan": "pro"
}
Tạo client hook
useSubscription()
useEntitlement("canParseProblemsWithAI")
Dùng để disable button, hiện paywall.

Cập nhật UI
Family page: hiện plan badge, child limit.
Practice/admin question bank: paywall cho upload/parse.
PDF upload page: paywall.
Parent dashboard/profile: hiển thị plan hiện tại.

Tạo trang subscription/billing giả lập Phase 1
/subscription hoặc /profile
Cho thấy Free vs Pro.
Phase 1 có thể chỉ hiển thị “Contact admin to upgrade”.
Admin có thể update Firestore manual.

Thêm admin/manual upgrade
Trong admin dashboard hoặc Firestore trực tiếp:Set subscriptions/{uid}.plan = "pro"
status = "active"


Test toàn bộ
Free parent tạo child thứ 1, thứ 2 được.
Free parent tạo child thứ 3 bị chặn.
Free child học lesson/materials có sẵn được.
Free user không upload/parse AI được.
Pro user upload/parse/generate được.
API bị chặn kể cả khi gọi bằng curl/Postman.

Khả Năng Làm Theo Phase
Mình khuyên làm theo thứ tự:
Phase 1: Không payment thật
Firestore subscription model.
Backend guards.
UI paywall.
Manual upgrade bằng admin/Firestore.
Phase 2: Payment
Tích hợp Stripe hoặc cổng VN.
Checkout session.
Webhook update subscription.
Billing portal/cancel subscription.
Grace period, expired subscription.
Rủi Ro / Điểm Cần Quyết Định
Cần chốt mấy điểm trước khi implement:
Paid plan gọi là gì? pro, premium, hay plus?
Paid max children là bao nhiêu? Unlimited, 5, hay 10?
Admin có bypass subscription không?
Child có cần subscription riêng không, hay dùng subscription của parent?
Có payment thật ngay không, hay Phase 1 manual upgrade?
“Materials tracking có sẵn” gồm những gì: lessons mock, question bank public, hay course runs đã seed?
Kết luận: yêu cầu khả thi, nên làm theo hướng entitlement server-side trước. Quan trọng nhất là không chỉ ẩn nút trên UI; phải chặn ở API, đặc biệt các route AI/upload vì đó là phần tốn chi phí.