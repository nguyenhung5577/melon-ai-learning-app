"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/shared/AdminGuard";
import { AdminShell } from "@/components/layout/AdminShell";
import { useAuthContext } from "@/lib/auth/auth-context";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { auth } from "@/lib/auth/firebase";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Mail, Search, Zap, User, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChildInfo {
  uid: string;
  loginId: string;
  displayName: string;
  avatarEmoji: string;
  grade: string;
}

interface ParentInfo {
  uid: string;
  email: string;
  displayName: string;
  plan: "free" | "pro";
  childrenCount: number;
  children: ChildInfo[];
}

export default function AdminUsersPage() {
  const { user, logout } = useAuthContext();
  const [parents, setParents] = useState<ParentInfo[]>([]);
  const [loading, setLoading] = useState(Boolean(auth));
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [upgradingUid, setUpgradingUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    uid: string;
    type: "parent" | "child";
    title: string;
    message: string;
  }>({ isOpen: false, uid: "", type: "parent", title: "", message: "" });

  const fetchUsers = async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/v1/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setParents(data.users);
      } else {
        toast.error("Failed to fetch users");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth) return;
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) fetchUsers();
    });
    return unsub;
  }, []);

  const filteredParents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return parents;
    return parents.filter((parent) => {
      const childMatch = parent.children.some((child) =>
        [child.displayName, child.loginId, child.uid, child.grade]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      );
      return [parent.displayName, parent.email, parent.uid, parent.plan]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)) || childMatch;
    });
  }, [parents, searchQuery]);

  const handleUpgrade = async (uid: string) => {
    setUpgradingUid(uid);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch("/api/v1/admin/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUid: uid, plan: "pro" })
      });
      if (res.ok) {
        toast.success(`Nâng cấp thành công tài khoản lên gói Pro!`);
        // Update local state without needing a refetch
        setParents(parents.map(p => p.uid === uid ? { ...p, plan: "pro" } : p));
      } else {
        toast.error("Lỗi khi nâng cấp. Có thể bạn không đủ quyền Admin.");
      }
    } catch {
      toast.error("Lỗi mạng kết nối.");
    } finally {
      setUpgradingUid(null);
    }
  };

  const handleDeleteUser = async (uid: string, type: "parent" | "child") => {
    setDeletingUid(uid);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch("/api/v1/admin/users/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUid: uid, type })
      });
      if (res.ok) {
        toast.success(`Đã xóa thành công tài khoản!`);
        if (type === "parent") {
          setParents(parents.filter(p => p.uid !== uid));
        } else {
          setParents(parents.map(p => ({
            ...p,
            childrenCount: p.children.some(c => c.uid === uid) ? p.childrenCount - 1 : p.childrenCount,
            children: p.children.filter(c => c.uid !== uid)
          })));
        }
      } else {
        toast.error("Lỗi khi xóa tài khoản.");
      }
    } catch {
      toast.error("Lỗi mạng kết nối.");
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <AdminGuard>
      <AdminShell userName={user?.displayName || "Admin"} onLogout={logout}>
        <div className="max-w-5xl mx-auto">
        <SectionHeader 
            title="Quản lý Người dùng" 
          subtitle="Theo dõi toàn bộ danh sách Phụ huynh và Học sinh" 
        />

        <div className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-black bg-white px-4 py-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <Search className="h-4 w-4 text-[#666]" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm theo email, tên, UID hoặc mã học sinh"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
          />
        </div>

        {loading ? (
          <div className="py-10 text-center font-bold">Đang tải dữ liệu...</div>
        ) : (
          <div className="flex flex-col gap-4 mt-6">
            {filteredParents.map(parent => (
              <div key={parent.uid} className="nb-card rounded-2xl bg-white flex flex-col">
                {/* Header row */}
                <div 
                  className={cn(
                    "p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer transition-colors hover:bg-black/5",
                    expandedUid === parent.uid && "bg-black/5"
                  )}
                  onClick={() => setExpandedUid(expandedUid === parent.uid ? null : parent.uid)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-nb-purple/10 border-2 border-black rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-nb-purple" />
                    </div>
                    <div>
                      <div className="font-display text-base flex items-center gap-2">
                        {parent.displayName}
                        {parent.plan === "pro" ? (
                          <NbPill color="purple">PRO VIP</NbPill>
                        ) : (
                          <NbPill color="black">FREE</NbPill>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-[#666] flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3" /> {parent.email}
                      </div>
                      <div className="text-[10px] font-mono text-black/40 mt-0.5">UID: {parent.uid}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                    {parent.plan === "free" && (
                      <NbButton 
                        variant="primary" 
                        size="sm" 
                        className="bg-nb-orange flex-1 sm:flex-none justify-center"
                        loading={upgradingUid === parent.uid}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Chắc chắn muốn cấp gói Pro cho tài khoản ${parent.email}?`)) {
                            handleUpgrade(parent.uid);
                          }
                        }}
                      >
                        <Zap className="w-3.5 h-3.5 mr-1" /> Cấp Pro
                      </NbButton>
                    )}
                    <NbButton 
                      variant="primary" 
                      size="sm" 
                      className="bg-red-500 text-white flex-1 sm:flex-none justify-center"
                      loading={deletingUid === parent.uid}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmModal({
                          isOpen: true,
                          uid: parent.uid,
                          type: "parent",
                          title: "Xóa Phụ huynh?",
                          message: `CẢNH BÁO: Bạn sắp xóa vĩnh viễn tài khoản Phụ huynh ${parent.email} VÀ TOÀN BỘ học sinh của họ. Hành động này không thể hoàn tác.`
                        });
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </NbButton>
                    <div className="text-xs font-bold bg-white border-2 border-black px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {parent.childrenCount} bé
                      {expandedUid === parent.uid ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Children Details */}
                {expandedUid === parent.uid && (
                  <div className="p-4 sm:p-5 border-t-2 border-black bg-nb-bg/50 rounded-b-2xl">
                    <h4 className="font-display text-sm mb-3 text-nb-purple">Danh sách tài khoản con:</h4>
                    {parent.children.length === 0 ? (
                      <div className="text-sm font-semibold text-[#666] italic">Chưa tạo tài khoản con nào.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {parent.children.map(child => (
                          <div key={child.uid} className="bg-white border-2 border-black rounded-xl p-3 flex items-center gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:-translate-y-1 transition-transform cursor-default">
                            <div className="text-2xl">{child.avatarEmoji}</div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm truncate">{child.displayName}</div>
                              <div className="text-xs font-semibold text-[#666] flex justify-between items-center mt-0.5">
                                <span>{child.grade}</span>
                                <span className="font-mono text-[10px] text-nb-blue bg-nb-blue/10 px-1.5 py-0.5 rounded">ID: {child.loginId}</span>
                              </div>
                            </div>
                            <button
                              disabled={deletingUid === child.uid}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmModal({
                                  isOpen: true,
                                  uid: child.uid,
                                  type: "child",
                                  title: "Xóa Học sinh?",
                                  message: `Bạn muốn xóa vĩnh viễn thẻ học sinh ${child.displayName}? Hành động này không thể hoàn tác.`
                                });
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {filteredParents.length === 0 && !loading && (
              <div className="text-center py-10 font-bold border-2 border-dashed border-black/20 rounded-2xl">
                {parents.length === 0 ? "Chưa có phụ huynh nào đăng ký." : "Không tìm thấy người dùng phù hợp."}
              </div>
            )}
          </div>
        )}
        </div>

        {/* Confirm Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white nb-card max-w-sm w-full rounded-3xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black animate-in fade-in zoom-in duration-200">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 border-2 border-red-500 shadow-[2px_2px_0px_0px_rgba(239,68,68,1)]">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="font-display text-xl mb-2">{confirmModal.title}</h3>
              <p className="text-sm font-semibold text-[#666] mb-6 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-3 w-full">
                <NbButton 
                  variant="outline" 
                  className="flex-1 border-2 border-black"
                  onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                >
                  Hủy bỏ
                </NbButton>
                <NbButton 
                  variant="primary" 
                  className="flex-1 bg-red-500 text-white"
                  loading={deletingUid === confirmModal.uid}
                  onClick={async () => {
                    await handleDeleteUser(confirmModal.uid, confirmModal.type);
                    setConfirmModal({ ...confirmModal, isOpen: false });
                  }}
                >
                  Xóa ngay
                </NbButton>
              </div>
            </div>
          </div>
        )}

      </AdminShell>
    </AdminGuard>
  );
}
