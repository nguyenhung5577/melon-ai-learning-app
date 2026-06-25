"use client";

import { 
  Users, 
  BookOpen, 
  AlertCircle, 
  Activity
} from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { AdminGuard } from "@/components/shared/AdminGuard";

const AI_SPEND = [
  { date: "Apr 17", cost: 0.12 },
  { date: "Apr 18", cost: 0.45 },
  { date: "Apr 19", cost: 0.88 },
  { date: "Apr 20", cost: 1.20 },
  { date: "Apr 21", cost: 1.05 },
  { date: "Apr 22", cost: 1.55 },
  { date: "Apr 23", cost: 2.10 },
];

export default function AdminDashboard() {
  const { user, logout } = useAuthContext();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <AdminGuard>
      <AdminShell userName={user?.displayName ?? "Quản trị viên"} onLogout={handleLogout}>
        <SectionHeader
          title="Bảng quản trị"
          subtitle="Tổng quan hệ thống Melon"
          badge={<NbPill color="purple">Giai đoạn 1</NbPill>}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-8">
          {[
            { label: "Tổng học sinh", value: "1,284", icon: <Users className="w-4 h-4" />, color: "bg-nb-blue/20 text-nb-blue" },
            { label: "Bài học đang mở", value: "42", icon: <BookOpen className="w-4 h-4" />, color: "bg-nb-green/20 text-nb-green" },
            { label: "Nội dung bị báo cáo", value: "3", icon: <AlertCircle className="w-4 h-4" />, color: "bg-nb-red/20 text-nb-red" },
            { label: "Lượt dùng quiz AI", value: "8.2k", icon: <Activity className="w-4 h-4" />, color: "bg-nb-orange/20 text-nb-orange" },
          ].map((s) => (
            <div key={s.label} className="nb-card rounded-2xl p-5 flex flex-col gap-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.color)}>
                {s.icon}
              </div>
              <div className="text-2xl font-display">{s.value}</div>
              <div className="text-xs font-bold text-[#666] uppercase">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* AI Spend Table */}
          <div className="nb-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-sm">Chi phí API AI trong 7 ngày</h3>
              <NbPill color="purple">Tổng $6.35</NbPill>
            </div>
            <div className="flex flex-col gap-3">
              {AI_SPEND.map((row) => (
                <div key={row.date} className="flex items-center justify-between text-sm font-bold">
                  <span className="text-[#666]">{row.date}</span>
                  <div className="flex-1 mx-4 h-2 bg-nb-bg rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-nb-purple" 
                      style={{ width: `${(row.cost / 2.5) * 100}%` }}
                    />
                  </div>
                  <span>${row.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-6">
            <div className="nb-card rounded-2xl p-6 bg-nb-purple/10 border-nb-purple">
              <h3 className="font-display text-sm mb-2">Quản lý Người dùng</h3>
              <p className="text-sm font-semibold text-[#666] mb-4">
                Xem danh sách phụ huynh, tài khoản con và cấp quyền Melon Pro.
              </p>
              <NbButton 
                variant="primary" 
                size="sm" 
                className="w-full justify-center bg-nb-purple text-white"
                onClick={() => router.push('/admin/users')}
              >
                Tới danh sách người dùng
              </NbButton>
            </div>

            <div className="nb-card rounded-2xl p-6">
              <h3 className="font-display text-sm mb-2">Tình trạng hệ thống</h3>
              <div className="flex items-center gap-2 mb-4">
                <NbPill color="green">Đang hoạt động</NbPill>
                <span className="text-xs font-bold text-[#888]">Thời gian ổn định: 99.9%</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span>OpenAI API</span>
                  <span className="text-nb-green">Đang chạy</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span>Lưu trữ Cloudinary</span>
                  <span className="text-nb-green">Ổn định</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
