"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Plus,
  Trash2,
  PieChart,
  X,
  GitCompare,
  FileEdit,
  Tag,
  BookOpen,
  Loader2,
  Check,
} from "lucide-react";
import { useSnapshotStore, buildProcessedSnapshot } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { findSimilarTabsForCategory } from "@/services/aiService";
import { flattenTabTree } from "@/services/snapshotParser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CategoryProportion } from "@/types/ai";

interface ProportionCardProps {
  onStartClassification: () => void;
  onClose: () => void;
}

export function ProportionCard({ onStartClassification, onClose }: ProportionCardProps) {
  const {
    rawSnapshot,
    rootNodes,
    proportionReport,
    updateCategoryName,
    updateCategory,
    removeCategory,
    addCategory,
    aiProcessedCache,
    setAiProcessedCache,
    setIsAIDiffModalOpen,
    enterPostEditMode,
    isPostEditMode,
  } = useSnapshotStore();

  const { rulesSettings, aiConfig } = useConfigStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatKeywords, setNewCatKeywords] = useState("");
  const [newCatRuleId, setNewCatRuleId] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  const [editingTagCatId, setEditingTagCatId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState("");
  const [matchingCatId, setMatchingCatId] = useState<string | null>(null);

  if (!proportionReport) return null;

  const { categories, totalAnalyzed, excludedCount, suggestedAction } = proportionReport;

  const handleRuleSelectInAdd = (ruleId: string) => {
    setNewCatRuleId(ruleId);
    if (ruleId) {
      const rule = rulesSettings.rules.find((r) => r.id === ruleId);
      if (rule) {
        if (!newCatName) setNewCatName(rule.name);
        const ruleKws = [rule.matchDomain, rule.matchKeyword].filter(Boolean).join(", ");
        if (!newCatKeywords && ruleKws) setNewCatKeywords(ruleKws);
      }
    }
  };

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    const kws = newCatKeywords
      .split(/[,，\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    addCategory(newCatName.trim(), {
      description: newCatDesc.trim() || "用户自定义分类",
      keywords: kws,
      associatedRuleId: newCatRuleId || undefined,
    });

    setNewCatName("");
    setNewCatKeywords("");
    setNewCatRuleId("");
    setNewCatDesc("");
    setIsAdding(false);
  };

  const handleAddTagToCategory = (catId: string) => {
    if (!newTagInput.trim()) return;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const updatedKeywords = Array.from(new Set([...(cat.keywords || []), newTagInput.trim()]));
    updateCategory(catId, { keywords: updatedKeywords });
    setNewTagInput("");
    setEditingTagCatId(null);
  };

  const handleRemoveTag = (catId: string, tagIndex: number) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat || !cat.keywords) return;
    const updatedKeywords = cat.keywords.filter((_, i) => i !== tagIndex);
    updateCategory(catId, { keywords: updatedKeywords });
  };

  const handleAIMatch = async (cat: CategoryProportion) => {
    if (!rawSnapshot) {
      alert("请先在工作台导入或加载快照数据");
      return;
    }
    const allTabs = flattenTabTree(rootNodes);
    const associatedRule = rulesSettings.rules.find((r) => r.id === cat.associatedRuleId);
    setMatchingCatId(cat.id);

    try {
      const matchedIds = await findSimilarTabsForCategory(
        allTabs,
        cat,
        aiConfig,
        associatedRule
      );

      if (matchedIds.length === 0) {
        alert(`未在当前快照中检索到与「${cat.name}」相似的标签页，可尝试补充关键词标签或关联规则。`);
        setMatchingCatId(null);
        return;
      }

      // Update category match count and ratio
      const newRatio = Math.round((matchedIds.length / totalAnalyzed) * 100);
      updateCategory(cat.id, {
        matchCount: matchedIds.length,
        ratio: newRatio,
        targetRatio: newRatio,
      });

      // If AI cache exists, dynamically update the classification map and snapshot
      if (aiProcessedCache) {
        const nextMap = { ...aiProcessedCache.classificationMap };
        for (const id of matchedIds) {
          nextMap[id] = cat.name;
        }
        const { processedSnapshot, processedTree } = buildProcessedSnapshot(
          aiProcessedCache.originalSnapshot,
          new Map(Object.entries(nextMap)),
          proportionReport.categories.map((c) => ({ id: c.id, name: c.name })),
          aiProcessedCache.targetMode,
          aiProcessedCache.targetPanelId
        );

        const nextCategoryCounts = { ...aiProcessedCache.summary.categoryCounts };
        nextCategoryCounts[cat.name] = matchedIds.length;

        setAiProcessedCache({
          ...aiProcessedCache,
          processedSnapshot,
          classificationMap: nextMap,
          summary: {
            ...aiProcessedCache.summary,
            categoryCounts: nextCategoryCounts,
            categorizedCount: Object.keys(nextMap).length,
            uncategorizedCount: Math.max(0, totalAnalyzed - Object.keys(nextMap).length),
          },
        });

        if (isPostEditMode) {
          useSnapshotStore.setState({ rootNodes: processedTree });
        }
      }

      alert(`已成功通过 AI 为「${cat.name}」聚拢并归入 ${matchedIds.length} 个相似标签页！`);
    } catch (err: any) {
      alert(`AI 聚拢标签失败: ${err.message || "请求超时或网络异常"}`);
    } finally {
      setMatchingCatId(null);
    }
  };

  const totalRatio = categories.reduce((sum, c) => sum + (c.ratio || 0), 0);

  return (
    <Card.Root
      style={{
        margin: "1rem 1.5rem",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--accent-solid)",
      }}
    >
      <Card.Header style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                padding: "0.45rem",
                borderRadius: "9999px",
                backgroundColor: "var(--accent-subtle)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PieChart size={20} />
            </div>
            <div>
              <Card.Title style={{ fontSize: "1.05rem", color: "var(--text-main)" }}>
                AI 标签主题比例分析看板
              </Card.Title>
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
            style={{ color: "var(--text-muted)" }}
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
              backgroundColor: "var(--bg-subtle)",
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
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          {categories.map((cat) => {
            const isMatchingThis = matchingCatId === cat.id;

            return (
              <div
                key={cat.id}
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {/* Header: Color + Name + Ratio Badge + Delete */}
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
                    <Badge variant="subtle" size="sm" style={{ color: "var(--accent-text)" }}>
                      {cat.ratio}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="xs"
                      pill
                      onClick={() => removeCategory(cat.id)}
                      title="删除此分类"
                      style={{ color: "var(--text-muted)", padding: "0.2rem" }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>

                {cat.description && (
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                    {cat.description}
                  </p>
                )}

                {/* Tags / Keywords Management Area */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Tag size={11} />
                      <span>标签/特征词:</span>
                    </span>

                    {editingTagCatId !== cat.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTagCatId(cat.id);
                          setNewTagInput("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--accent)",
                          fontSize: "0.68rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.15rem",
                          padding: "1px 4px",
                        }}
                      >
                        <Plus size={10} />
                        <span>加标签</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", alignItems: "center" }}>
                    {(cat.keywords || []).map((kw, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "9999px",
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: "0.68rem",
                          color: "var(--text-main)",
                        }}
                      >
                        <span>#{kw}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(cat.id, idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: 0,
                            lineHeight: 1,
                          }}
                          title="删除此标签"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}

                    {editingTagCatId === cat.id && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                        <input
                          type="text"
                          placeholder="输入标签按回车..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddTagToCategory(cat.id);
                            if (e.key === "Escape") setEditingTagCatId(null);
                          }}
                          autoFocus
                          style={{
                            padding: "0.15rem 0.45rem",
                            borderRadius: "9999px",
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--accent-solid)",
                            fontSize: "0.68rem",
                            color: "var(--text-main)",
                            outline: "none",
                            width: "90px",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddTagToCategory(cat.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent)",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTagCatId(null)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rule Association Selector */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.15rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                    <BookOpen size={11} />
                    <span>关联规则:</span>
                  </span>
                  <select
                    value={cat.associatedRuleId || ""}
                    onChange={(e) => updateCategory(cat.id, { associatedRuleId: e.target.value || undefined })}
                    style={{
                      flex: 1,
                      padding: "0.2rem 0.4rem",
                      borderRadius: "4px",
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.68rem",
                      color: "var(--text-main)",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">(无规则关联)</option>
                    {rulesSettings.rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Match Similar Tabs Button */}
                <div style={{ marginTop: "0.4rem", paddingTop: "0.4rem", borderTop: "1px dashed var(--border-subtle)" }}>
                  <Button
                    variant="outline"
                    size="xs"
                    pill
                    onClick={() => handleAIMatch(cat)}
                    disabled={isMatchingThis}
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      borderColor: "var(--accent-solid)",
                      color: "var(--accent-text)",
                      backgroundColor: "var(--bg-card)",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                    }}
                    title="通过 AI 语义匹配快照中的相似标签页并直接归入此分类"
                  >
                    {isMatchingThis ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    <span>{isMatchingThis ? "AI 检索匹配中..." : "AI 聚拢相似标签页"}</span>
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add Custom Category Card */}
          {isAdding ? (
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "0.75rem",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--accent-solid)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)" }}>
                  新建自定义分类
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={() => setIsAdding(false)}
                  style={{ color: "var(--text-muted)", padding: "2px" }}
                >
                  <X size={14} />
                </Button>
              </div>

              <div>
                <Input
                  type="text"
                  placeholder="分类名称（例如：🎮 游戏与电竞）"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  autoFocus
                  size="sm"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <Input
                  type="text"
                  placeholder="关键词/标签（逗号或空格隔开）"
                  value={newCatKeywords}
                  onChange={(e) => setNewCatKeywords(e.target.value)}
                  size="sm"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <select
                  value={newCatRuleId}
                  onChange={(e) => handleRuleSelectInAdd(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.35rem 0.5rem",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.75rem",
                    color: "var(--text-main)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">关联规则（可选，自动提取词与域名）</option>
                  {rulesSettings.rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Input
                  type="text"
                  placeholder="分类特征说明（可选）"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  size="sm"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem", marginTop: "0.2rem" }}>
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={() => setIsAdding(false)}
                  style={{ color: "var(--text-muted)" }}
                >
                  取消
                </Button>
                <Button
                  variant="solid"
                  size="xs"
                  pill
                  onClick={handleAdd}
                >
                  确认添加
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="xs"
              pill
              onClick={() => setIsAdding(true)}
              style={{
                border: "1px dashed var(--border-subtle)",
                color: "var(--text-muted)",
                backgroundColor: "transparent",
                justifyContent: "center",
                minHeight: "120px",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              <Plus size={18} />
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>添加自定义分类</span>
            </Button>
          )}
        </div>
      </Card.Body>

      <Card.Footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          💡 确认上述分类满意后，点击右侧按钮，AI 将依据该分类标准自动生成重组缓存与差分。
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {aiProcessedCache && (
            <>
              <Button
                variant="outline"
                size="xs"
                pill
                onClick={() => setIsAIDiffModalOpen(true)}
                title="查看已生成的 AI 分类差分对比"
              >
                <GitCompare size={13} />
                <span>DIFF 对比</span>
              </Button>

              <Button
                variant="solid"
                size="xs"
                pill
                onClick={enterPostEditMode}
                style={{ backgroundColor: "var(--accent-solid)", color: "#fff" }}
                title="进入工作台加载被 AI 处理后的数据"
              >
                <FileEdit size={13} />
                <span>AI 处理后编辑 (Post Edit)</span>
              </Button>
            </>
          )}

          <Button
            variant="solid"
            size="xs"
            pill
            onClick={onStartClassification}
          >
            <Sparkles size={13} />
            <span>{aiProcessedCache ? "重新归类与生成差分" : "确认标准并执行智能归类"}</span>
            <ArrowRight size={13} />
          </Button>
        </div>
      </Card.Footer>
    </Card.Root>
  );
}
