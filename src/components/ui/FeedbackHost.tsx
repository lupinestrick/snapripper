"use client";

import React from "react";
import { useFeedbackStore, ToastType } from "@/store/useFeedbackStore";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

const TOAST_ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={15} style={{ color: "var(--success, #10b981)", flexShrink: 0 }} />,
  warning: <AlertTriangle size={15} style={{ color: "#f59e0b", flexShrink: 0 }} />,
  error: <AlertCircle size={15} style={{ color: "#ef4444", flexShrink: 0 }} />,
  info: <Info size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />,
};

const TOAST_BORDER: Record<ToastType, string> = {
  success: "rgba(16, 185, 129, 0.35)",
  warning: "rgba(245, 158, 11, 0.4)",
  error: "rgba(239, 68, 68, 0.4)",
  info: "var(--border-card)",
};

export function FeedbackHost() {
  const { toasts, dismissToast, pendingConfirm, resolveConfirm } = useFeedbackStore();

  return (
    <>
      {/* Lightweight Toast Stack */}
      {toasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: "1rem",
            right: "1rem",
            zIndex: 300,
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
            maxWidth: "360px",
            width: "calc(100vw - 2rem)",
            pointerEvents: "none",
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.55rem",
                padding: "0.6rem 0.8rem",
                borderRadius: "0.75rem",
                backgroundColor: "var(--bg-card)",
                border: `1px solid ${TOAST_BORDER[t.type]}`,
                color: "var(--text-main)",
                fontSize: "0.8rem",
                lineHeight: 1.4,
                boxShadow: "0 12px 28px rgba(0, 0, 0, 0.28)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                {TOAST_ICON[t.type]}
                <span style={{ wordBreak: "break-word" }}>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unified Confirm Dialog */}
      {pendingConfirm && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) resolveConfirm(false);
          }}
        >
          <Dialog.Backdrop style={{ zIndex: 250 }} />
          <Dialog.Positioner style={{ zIndex: 260 }}>
            <Dialog.Content
              style={{
                maxWidth: "400px",
                width: "92vw",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-card)",
                borderRadius: "0.95rem",
                color: "var(--text-main)",
                overflow: "hidden",
                boxShadow: "0 20px 44px rgba(0, 0, 0, 0.45)",
              }}
            >
              <div
                style={{
                  padding: "0.8rem 1.1rem",
                  borderBottom: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Dialog.Title style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                  {pendingConfirm.title || "确认操作"}
                </Dialog.Title>
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={() => resolveConfirm(false)}
                  style={{ padding: "4px" }}
                >
                  <X size={14} />
                </Button>
              </div>

              <div style={{ padding: "1rem 1.1rem", fontSize: "0.82rem", lineHeight: 1.55, color: "var(--text-muted)" }}>
                {pendingConfirm.message}
              </div>

              <div
                style={{
                  padding: "0.7rem 1.1rem",
                  borderTop: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-surface)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.45rem",
                }}
              >
                <Button variant="ghost" size="xs" pill onClick={() => resolveConfirm(false)}>
                  {pendingConfirm.cancelLabel || "取消"}
                </Button>
                <Button
                  variant="solid"
                  size="xs"
                  pill
                  onClick={() => resolveConfirm(true)}
                  style={
                    pendingConfirm.destructive
                      ? { backgroundColor: "#ef4444", color: "#fff" }
                      : undefined
                  }
                >
                  {pendingConfirm.confirmLabel || "确认"}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      )}
    </>
  );
}
