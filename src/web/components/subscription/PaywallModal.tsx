"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NbButton } from "@/components/shared/NbButton";
import { Lock, Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export function PaywallModal({ isOpen, onClose, featureName }: PaywallModalProps) {
  const router = useRouter();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md nb-card p-6 !rounded-2xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
        <DialogHeader className="text-left space-y-3">
          <div className="w-12 h-12 bg-nb-orange border-2 border-black rounded-xl flex items-center justify-center mb-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="font-display text-2xl">
            Nâng cấp Melon Pro
          </DialogTitle>
          <DialogDescription className="text-sm font-semibold text-[#666] leading-relaxed">
            {featureName === "Tạo thêm tài khoản con" ? (
              <>Tài khoản Free hiện tại của bạn chỉ được tạo <strong>tối đa 2 tài khoản con</strong>. Nâng cấp ngay lên Melon Pro để quản lý nhiều bé hơn và mở khóa toàn bộ sức mạnh AI!</>
            ) : (
              <>Tính năng <strong className="text-black">{featureName || "này"}</strong> chỉ dành riêng cho tài khoản Melon Pro. Nâng cấp ngay để không bị giới hạn trải nghiệm học tập cùng AI!</>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 my-5">
          <div className="flex items-center gap-3 bg-nb-bg p-3 rounded-xl border-2 border-black">
            <div className="text-nb-purple"><Sparkles className="w-5 h-5" /></div>
            <span className="font-bold text-sm">Sinh bài tập tự động không giới hạn</span>
          </div>
          <div className="flex items-center gap-3 bg-nb-bg p-3 rounded-xl border-2 border-black">
             <div className="text-nb-blue"><Sparkles className="w-5 h-5" /></div>
            <span className="font-bold text-sm">Upload đề PDF & nhờ AI bóc tách</span>
          </div>
          <div className="flex items-center gap-3 bg-nb-bg p-3 rounded-xl border-2 border-black">
             <div className="text-nb-green"><Sparkles className="w-5 h-5" /></div>
            <span className="font-bold text-sm">Quản lý và theo dõi lên đến 5 bé</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <NbButton 
            variant="primary" 
            className="w-full justify-center bg-nb-orange" 
            onClick={() => {
              onClose();
              router.push("/pricing");
            }}
          >
            <span className="flex items-center gap-2"><Zap className="w-4 h-4"/> Xem Bảng Giá</span>
          </NbButton>
          <button 
            onClick={onClose}
            className="text-sm font-bold text-[#666] hover:text-black transition-colors py-2"
          >
            Để sau
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
