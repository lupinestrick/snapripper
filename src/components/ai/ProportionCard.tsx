"use client";

import React, { useState } from "react";
import { Sparkles, ArrowRight, Plus, Trash2, PieChart, X } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface ProportionCardProps {
  onStartClassification: () => void;
  onClose: () => void;
}

export function ProportionCard({ onStartClassification, onClose }: ProportionCardProps) {
  const {
    proportionReport,
    updateCategoryName,
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
    <Card.Root
      style={{
        margin: "1rem 1.5rem",
        backgroundColor: "#1e293b",
        border: "1px solid #38bdf8",
      }}
    >
      <Card.Header style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                padding: "0.45rem",
                borderRadius: "9999px",
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PieChart size={20} />
            </div>
            <div>
              <Card.Title style={{ fontSize: "1.05rem" }}>AI 标签主题比例分析看板</Card.Title>
              <Card.Description>
                分析了 {totalAnalyzed} 个有效标签页，豁免保护 {excludedCount} 个置顶与内建页面
                {suggestedAction && ` · 建议: ${suggestedAction}`}
              </Card.Description>
            </div>
          </div>

          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={onClose}
            style={{ color: "#94a3b8" }}
            title="关闭看板"
          >
            <X size={18} />
          </Button>
        </div>
      </Card.Header>

      <Card.Body>
        {/* Ratio Proportion Bar */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              height: "1.25rem",
              borderRadius: "9999px",
              overflow: "hidden",
              backgroundColor: "#0f172a",
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
                <span style={{ color: "#f8fafc", fontWeight: 500 }}>{cat.name}</span>
                <span style={{ color: "#94a3b8" }}>{cat.ratio}%</span>
              </div>
            ))}
            {totalRatio !== 100 && (
              <Badge variant="subtle" size="sm" style={{ color: "#fbbf24" }}>
                比例总和: {totalRatio}%
              </Badge>
            )}
          </div>
        </div>

        {/* Categories Grid */}
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
                borderRadius: "0.75rem",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
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
                      borderBottom: "1px dashed #475569",
                      color: "#f8fafc",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      width: "100%",
                      outline: "none",
                    }}
                    title="点击可直接编辑修改分类名称"
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <Badge variant="subtle" size="sm" style={{ color: "#38bdf8" }}>
                    {cat.ratio}%
                  </Badge>
                  <Button
                    variant="ghost"
                    size="xs"
                    pill
                    onClick={() => removeCategory(cat.id)}
                    title="删除此分类"
                    style={{ color: "#94a3b8", padding: "0.2rem" }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>

              {cat.description && (
                <p style={{ fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.3 }}>{cat.description}</p>
              )}

              {cat.keywords && cat.keywords.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.2rem" }}>
                  {cat.keywords.slice(0, 4).map((kw, idx) => (
                    <Badge key={idx} variant="outline" size="sm" style={{ fontSize: "0.68rem" }}>
                      #{kw}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isAdding ? (
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "0.75rem",
                backgroundColor: "#0f172a",
                border: "1px dashed #38bdf8",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Input
                type="text"
                placeholder="输入新分类名称..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
                size="sm"
                style={{ flex: 1 }}
              />
              <Button
                variant="solid"
                size="xs"
                pill
                onClick={handleAdd}
                style={{ backgroundColor: "#38bdf8", color: "#0f172a" }}
              >
                确定
              </Button>
              <Button
                variant="ghost"
                size="xs"
                pill
                onClick={() => setIsAdding(false)}
                style={{ color: "#94a3b8" }}
              >
                <X size={16} />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="xs"
              pill
              onClick={() => setIsAdding(true)}
              style={{
                border: "1px dashed #334155",
                color: "#94a3b8",
                backgroundColor: "transparent",
                justifyContent: "center",
              }}
            >
              <Plus size={13} />
              <span>添加自定义分类</span>
            </Button>
          )}
        </div>
      </Card.Body>

      <Card.Footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
          💡 确认上述分类满意后，点击右侧按钮，AI 将根据该分类标准自动重新组织标签。
        </span>

        <Button
          variant="solid"
          size="xs"
          pill
          onClick={onStartClassification}
          style={{
            backgroundColor: "#2563eb",
            borderColor: "#3b82f6",
            color: "#ffffff",
          }}
        >
          <Sparkles size={13} />
          <span>确认分类标准并执行批量归类</span>
          <ArrowRight size={13} />
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
