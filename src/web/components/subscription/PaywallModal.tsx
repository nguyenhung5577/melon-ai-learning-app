"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

/**
 * Màn hình Paywall dùng để chặn người dùng xài tính năng VIP
 */
export function PaywallModal({ isOpen, onClose, featureName }: PaywallModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-amber-600">
            <Lock className="w-6 h-6" />
            Nâng cấp Melon Pro
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Tính năng <strong className="text-black">{featureName || "này"}</strong> chỉ dành riêng cho tài khoản Melon Pro. 
            Nâng cấp ngay để không bị giới hạn trải nghiệm học tập cùng trí tuệ nhân tạo (AI)!
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 my-4">
          <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-lg text-amber-900 border border-amber-200">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="font-medium">Sinh bài tập tự động không giới hạn</span>
          </div>
          <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-lg text-amber-900 border border-amber-200">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="font-medium">Upload đề PDF & nhờ AI bóc tách</span>
          </div>
          <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-lg text-amber-900 border border-amber-200">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="font-medium">Quản lý và theo dõi lên đến 5 bé</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <Button variant="outline" onClick={onClose}>Để sau</Button>
          <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md" onClick={() => alert("Chức năng Thanh toán (Phase 2) chưa được tích hợp!")}>
            Nâng cấp ngay
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
