"use client";

import React, { useState } from "react";
import { Sparkles, ArrowRight, Plus, Trash2, PieChart, Check, Edit3, X } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { CategoryProportion } from "@/types/ai";

interface ProportionCardProps {
  onStartClassification: () => void;
  onClose: () => void;
}

export function ProportionCard({ onStartClassification, onClose }: ProportionCardProps) {
  const {
    proportionReport,
    updateCategoryName,
    updateCategoryRatio,
    removeCategory,
    addCategory,
  } = useSnapshotStore();

  const [newCatName, setNewCatName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  if (!proportionReport) return null;

  const { categories, totalAnalyzed, excludedCount, suggestedAction } = proportionReport;

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    addCategory(newCatName.trim());
    setNewCatName("");
    setIsAdding(false);
  };

  const totalRatio = categories.reduce((sum, c) => sum + (c.ratio || 0), 0);

  return (
    <div
      style={{
        margin: "1rem 1.5rem",
        padding: "1.25rem",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-focus)",
        borderRadius: "0.75rem",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div
            style={{
              padding: "0.4rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(56, 189, 248, 0.15)",
              color: "var(--accent)",
            }}
          >
            <PieChart size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-main)" }}>
              AI 标签主题比例分析看板
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              分析了 {totalAnalyzed} 个有效标签页，豁免保护 {excludedCount} 个置顶与内建页面
              {suggestedAction && ` · 建议: ${suggestedAction}`}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            height: "1.25rem",
            borderRadius: "0.375rem",
            overflow: "hidden",
            backgroundColor: "var(--bg-subtle)",
            boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        >
          {categories.map((cat) => (
            <div
              key={cat.id}
              style={{
                width: `${Math.max(cat.ratio, 3)}%`,
                backgroundColor: cat.color,
                transition: "width 0.3s ease",
              }}
              title={`${cat.name}: ${cat.ratio}% (${cat.matchCount} 个标签)`}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginTop: "0.6rem",
            fontSize: "0.75rem",
          }}
        >
          {categories.map((cat) => (
            <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: cat.color }} />
              <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{cat.name}</span>
              <span style={{ color: "var(--text-muted)" }}>{cat.ratio}%</span>
            </div>
          ))}
          {totalRatio !== 100 && (
            <span style={{ color: "var(--warning)", fontWeight: 500 }}>
              (比例总和: {totalRatio}%)
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              padding: "0.75rem",
              borderRadius: "0.5rem",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, marginRight: "0.5rem" }}>
                <span
                  style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: cat.color, flexShrink: 0 }}
                />
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) => updateCategoryName(cat.id, e.target.value)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    borderBottom: "1px dashed var(--border-subtle)",
                    color: "var(--text-main)",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    width: "100%",
                    outline: "none",
                  }}
                  title="点击可直接编辑修改分类名称"
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.1rem 0.4rem",
                    borderRadius: "0.25rem",
                    backgroundColor: "rgba(56, 189, 248, 0.15)",
                    color: "var(--accent)",
                  }}
                >
                  {cat.ratio}%
                </span>
                <button
                  onClick={() => removeCategory(cat.id)}
                  title="删除此分类"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "0.2rem",
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {cat.description && (
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.3 }}>{cat.description}</p>
            )}

            {cat.keywords && cat.keywords.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.2rem" }}>
                {cat.keywords.slice(0, 4).map((kw, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: "0.68rem",
                      padding: "0.05rem 0.3rem",
                      borderRadius: "0.2rem",
                      backgroundColor: "var(--bg-subtle)",
                      color: "var(--text-muted)",
                    }}
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {isAdding ? (
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "0.5rem",
              backgroundColor: "var(--bg-primary)",
              border: "1px dashed var(--accent)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <input
              type="text"
              placeholder="输入新分类名称..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
              style={{
                flex: 1,
                padding: "0.3rem 0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.8rem",
              }}
            />
            <button
              onClick={handleAdd}
              style={{
                padding: "0.3rem 0.6rem",
                borderRadius: "0.25rem",
                backgroundColor: "var(--accent)",
                color: "#0f172a",
                border: "none",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              确定
            </button>
            <button
              onClick={() => setIsAdding(false)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            style={{
              padding: "0.75rem",
              borderRadius: "0.5rem",
              backgroundColor: "transparent",
              border: "1px dashed var(--border-subtle)",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              fontSize: "0.8rem",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
          >
            <Plus size={15} />
            添加自定义分类
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          💡 确认上述分类满意后，点击右侧按钮，AI 将根据该分类标准自动重新组织标签。
        </span>

        <button
          onClick={onStartClassification}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.375rem",
            backgroundColor: "#22c55e",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "0.85rem",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(34, 197, 94, 0.25)",
          }}
        >
          <Sparkles size={16} />
          确认分类标准并执行批量归类
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
