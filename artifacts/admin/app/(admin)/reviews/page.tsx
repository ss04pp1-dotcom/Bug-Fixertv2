"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Search, ChevronDown, ChevronLeft, ChevronRight,
  Menu, RefreshCw, Star, Check, X, Trash2, Eye,
} from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface Review {
  id: string;
  userId?: string;
  user?: { name?: string; email?: string } | null;
  contentType?: string;
  contentId?: string;
  rating?: number;
  title?: string;
  comment?: string;
  isApproved?: boolean;
  createdAt?: string;
}

interface ReviewsResponse {
  data: Review[];
  meta: { total: number; totalPages: number; page: number };
}

interface ReviewsStatsResponse {
  totalReviews: number;
  pendingApproval: number;
  avgRating: number;
  thisWeek: number;
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function Reviews() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterContentType, setFilterContentType] = useState("");
  const [filterApproval, setFilterApproval] = useState("");

  const [expandedComment, setExpandedComment] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (filterContentType) params.set("contentType", filterContentType);
  if (filterApproval !== "") params.set("isApproved", filterApproval);

  const { data, isLoading: loading, error, refetch } = useApi<ReviewsResponse>(`/v1/reviews/admin?${params}`);
  const { data: statsData } = useApi<ReviewsStatsResponse>("/v1/reviews/admin/stats");
  const { call, loading: actionLoading } = useApiCallState();

  const reviews = data?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const pages = meta?.totalPages ?? 1;

  const stats = statsData ?? { totalReviews: 0, pendingApproval: 0, avgRating: 0, thisWeek: 0 };

  const handleToggleApprove = async (review: Review) => {
    const newStatus = !review.isApproved;
    try {
      await call("put", `/v1/reviews/admin/${review.id}`, { isApproved: newStatus });
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to update review";
      alert(typeof msg === "string" ? msg : "Failed to update review");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review? This action cannot be undone.")) return;
    try {
      await call("delete", `/v1/reviews/admin/${id}`);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete review";
      alert(typeof msg === "string" ? msg : "Failed to delete review");
    }
  };

  const renderStars = (rating?: number) => {
    const r = rating ?? 0;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={13}
            className={cn(
              star <= r ? "text-yellow-400 fill-yellow-400" : "text-gray-600"
            )}
          />
        ))}
        <span className="text-xs text-[#8B92A5] ml-1">{r.toFixed(1)}</span>
      </div>
    );
  };

  const truncateText = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "...";
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Reviews</h1>
          {total > 0 && (
            <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">{total.toLocaleString()}</span>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: "Total Reviews", value: stats.totalReviews.toLocaleString(), gradient: "gradient-primary" },
            { label: "Pending Approval", value: stats.pendingApproval.toLocaleString(), color: "text-yellow-400" },
            { label: "Avg Rating", value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—", color: "text-blue-400" },
            { label: "This Week", value: stats.thisWeek.toLocaleString(), color: "text-green-400" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-[#8B92A5] mb-1">{s.label}</p>
              <p className={cn("text-2xl font-bold", s.gradient ? "bg-clip-text text-transparent " + s.gradient : s.color ?? "text-white")}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Search + Filters + Actions */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
            <Search size={14} className="text-[#8B92A5] shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reviews..."
              className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
            />
          </div>
          <div className="relative">
            <select
              value={filterContentType}
              onChange={e => { setFilterContentType(e.target.value); setPage(1); }}
              className="bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-white outline-none appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="">All Content Types</option>
              <option value="movie">Movie</option>
              <option value="series">Series</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filterApproval}
              onChange={e => { setFilterApproval(e.target.value); setPage(1); }}
              className="bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-white outline-none appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="">All Statuses</option>
              <option value="true">Approved</option>
              <option value="false">Pending</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
          </div>
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-red-400 text-sm">Failed to load reviews</p>
              <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
            </div>
          )}
          {!loading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide w-10">#</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">User</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Content Type</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Content ID</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Rating</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Title</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Comment</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Approved</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Created</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-12 text-sm text-[#8B92A5]">No reviews found</td></tr>
                    ) : reviews.map((r, i) => (
                      <tr key={r.id} className="tbl-row border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 text-sm text-[#8B92A5]">{(page - 1) * 20 + i + 1}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-white">
                            {r.user?.name || r.user?.email || r.userId || "Anonymous"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                            r.contentType === "movie" ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
                          )}>
                            {r.contentType ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#8B92A5] font-mono text-xs">{r.contentId ?? "—"}</td>
                        <td className="px-4 py-3">{renderStars(r.rating)}</td>
                        <td className="px-4 py-3 text-sm text-white max-w-[150px] truncate">{r.title ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-[200px]">
                            <p className="text-sm text-[#8B92A5]">
                              {expandedComment === r.id
                                ? r.comment ?? "—"
                                : truncateText(r.comment ?? "—", 60)
                              }
                            </p>
                            {(r.comment && r.comment.length > 60) && (
                              <button
                                onClick={() => setExpandedComment(expandedComment === r.id ? null : r.id)}
                                className="text-[10px] text-primary mt-0.5 hover:underline"
                              >
                                {expandedComment === r.id ? "Show less" : "Read more"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-medium",
                            r.isApproved ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
                          )}>
                            {r.isApproved ? "Approved" : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#8B92A5]">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleApprove(r)}
                              disabled={actionLoading}
                              title={r.isApproved ? "Revoke approval" : "Approve review"}
                              className={cn(
                                "w-7 h-7 rounded-md flex items-center justify-center",
                                r.isApproved ? "hover:bg-yellow-500/10" : "hover:bg-green-500/10"
                              )}
                            >
                              {r.isApproved ? (
                                <X size={13} className="text-yellow-400" />
                              ) : (
                                <Check size={13} className="text-green-400" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={actionLoading}
                              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10"
                            >
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-[#8B92A5]">Showing {reviews.length} of {total.toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  {(() => {
                    const getPageNumbers = (current: number, totalPages: number) => {
                      const maxVisible = 5;
                      let start = Math.max(1, current - Math.floor(maxVisible / 2));
                      let end = start + maxVisible - 1;
                      if (end > totalPages) { end = totalPages; start = Math.max(1, end - maxVisible + 1); }
                      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    };
                    return getPageNumbers(page, pages).map(pg => (
                      <button
                        key={pg}
                        onClick={() => setPage(() => pg)}
                        className={cn(
                          "w-7 h-7 rounded-md text-xs font-medium",
                          pg === page ? "bg-primary text-white" : "text-[#8B92A5] hover:bg-white/5"
                        )}
                      >
                        {pg}
                      </button>
                    ));
                  })()}
                  <button
                    onClick={() => setPage(p => Math.min(pages, p + 1))}
                    disabled={page >= pages}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}