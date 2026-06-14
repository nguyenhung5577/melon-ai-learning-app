"use client";

import { useState } from "react";
import { KidShell } from "@/components/layout/KidShell";
import { useAuthContext } from "@/lib/auth/auth-context";
import { auth } from "@/lib/auth/firebase";
import { AuthModal } from "@/components/auth/AuthModal";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { Check, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";

// Lấy public key từ env
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

export default function PricingPage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/v1/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Không thể khởi tạo thanh toán. Vui lòng thử lại.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi Front-end bắt được: " + (err?.message || String(err)));
      setLoading(false);
    }
  };

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.avatarUrl ?? user?.photoURL}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
    >
      <SectionContainer className="py-12 md:py-20 flex flex-col items-center">
        <SectionHeader 
          title="Nâng cấp việc học" 
          subtitle="Mở khóa toàn bộ sức mạnh của trí tuệ nhân tạo Melon AI" 
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mt-10 px-4 md:px-0">
          {/* Free Tier */}
          <div className="nb-card p-8 bg-white flex flex-col items-center text-center">
            <h3 className="font-display text-2xl mb-2 text-[#888]">Gói Cơ Bản</h3>
            <div className="text-4xl font-bold mb-6">Miễn phí</div>
            
            <ul className="flex flex-col gap-4 text-left w-full font-semibold text-[#555] mb-8">
              <li className="flex items-center gap-3"><Check className="text-nb-green w-5 h-5 flex-shrink-0"/> Tối đa 2 tài khoản con</li>
              <li className="flex items-center gap-3"><Check className="text-nb-green w-5 h-5 flex-shrink-0"/> Báo cáo học tập cơ bản</li>
              <li className="flex items-center gap-3 text-[#aaa]"><X className="w-5 h-5 flex-shrink-0"/> Không có Gia sư AI</li>
              <li className="flex items-center gap-3 text-[#aaa]"><X className="w-5 h-5 flex-shrink-0"/> Không thể giải toán qua ảnh</li>
              <li className="flex items-center gap-3 text-[#aaa]"><X className="w-5 h-5 flex-shrink-0"/> Không thể tạo bài tập từ PDF</li>
            </ul>

            <NbButton variant="ghost" size="lg" className="w-full mt-auto justify-center" onClick={() => user ? null : setAuthOpen(true)}>
              {user ? "Đang sử dụng" : "Đăng nhập ngay"}
            </NbButton>
          </div>

          {/* Pro Tier */}
          <div className="nb-card p-8 bg-nb-purple/10 border-nb-purple flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-5 right-[-35px] bg-nb-yellow border-2 border-black font-bold text-xs px-10 py-1 rotate-45 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">VIP</div>
            
            <h3 className="font-display text-2xl mb-2 text-nb-purple">Melon Pro</h3>
            <div className="text-4xl font-bold mb-6 text-nb-purple">$9.99<span className="text-lg text-black/50">/tháng</span></div>
            
            <ul className="flex flex-col gap-4 text-left w-full font-semibold mb-8">
              <li className="flex items-center gap-3"><Check className="text-nb-purple w-5 h-5 flex-shrink-0"/> <strong>Không giới hạn</strong> tài khoản con</li>
              <li className="flex items-center gap-3"><Check className="text-nb-purple w-5 h-5 flex-shrink-0"/> Gia sư AI (Cosmo) 1 kèm 1</li>
              <li className="flex items-center gap-3"><Check className="text-nb-purple w-5 h-5 flex-shrink-0"/> Trợ lý giải toán qua hình ảnh</li>
              <li className="flex items-center gap-3"><Check className="text-nb-purple w-5 h-5 flex-shrink-0"/> Đọc PDF và tự động sinh bài tập</li>
              <li className="flex items-center gap-3"><Check className="text-nb-purple w-5 h-5 flex-shrink-0"/> Quyền ưu tiên dùng server AI mạnh nhất</li>
            </ul>

            <NbButton 
              variant="primary" 
              size="lg" 
              className="w-full bg-nb-purple text-white mt-auto justify-center"
              loading={loading}
              onClick={handleSubscribe}
            >
              <Zap className="w-4 h-4 mr-2" /> Nâng cấp Melon Pro
            </NbButton>
          </div>
        </div>
      </SectionContainer>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
