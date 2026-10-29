"use client";

import React, { useState } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { CategorizationRule, RuleScope } from "@/types/sidebery";
import { AIRulesChatModal } from "./AIRulesChatModal";
import { Plus, Trash2, Download, Upload, Sliders, Sparkles, SlidersHorizontal } from "lucide-react";

export function RulesPage() {
  const {
    rulesSettings,
    setRulesSettings,
    addRule,
    deleteRule,
    toggleRule,
    importRulesJSON,
    exportRulesJSON,
  } = useConfigStore();

  const { rawSnapshot } = useSnapshotStore();
  const panels = rawSnapshot?.panels || {};

  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRule, setNewRule] = useState<Omit<CategorizationRule, "id">>({
    name: "",
    enabled: true,
    scope: "all",
    targetScopeId: "",
    matchDomain: "",
    matchKeyword: "",
    minThreshold: 2,
    color: "#38bdf8",
  });

  const handleExport = () => {
    const jsonStr = exportRulesJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapripper-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importRulesJSON(content);
      if (success) {
        alert("规则配置导入成功！");
      } else {
        alert("导入失败：无效的规则配置文件");
      }
    };
    reader.readAsText(file);
  };

  const handleCreateRule = () => {
    if (!newRule.name.trim()) {
      alert("请输入 Group 目标名称");
      return;
    }
    if (!newRule.matchDomain?.trim() && !newRule.matchKeyword?.trim()) {
      alert("请至少填写域名或标题关键词中的一项");
      return;
    }
    addRule(newRule);
    setNewRule({
      name: "",
      enabled: true,
      scope: "all",
      targetScopeId: "",
      matchDomain: "",
      matchKeyword: "",
      minThreshold: 2,
      color: "#38bdf8",
    });
    setIsAddOpen(false);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "960px", margin: "0 auto", color: "#f8fafc" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>规则与成组设置</h1>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            匹配域名与关键词自动归类到目标 Group 分组中，支持自定义作用范围与聚合阈值。
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            onClick={() => setIsAIChatOpen(true)}
            style={{
              padding: "0.5rem 1.1rem",
              borderRadius: "9999px",
              border: "1px solid #38bdf8",
              backgroundColor: "rgba(56, 189, 248, 0.1)",
              color: "#38bdf8",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "all 0.15s ease",
            }}
          >
            <Sparkles size={15} />
            <span>AI 生成规则</span>
          </button>

          <label
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "9999px",
              border: "1px solid #334155",
              backgroundColor: "#1e293b",
              color: "#94a3b8",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <Upload size={14} />
            <span>导入设置</span>
            <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
          </label>

          <button
            onClick={handleExport}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "9999px",
              border: "1px solid #334155",
              backgroundColor: "#1e293b",
              color: "#94a3b8",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <Download size={14} />
            <span>导出设置</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "#fff",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <Plus size={15} />
            <span>添加规则</span>
          </button>
        </div>
      </div>

      {/* Global Options Card */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "1rem",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          marginBottom: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>已有 Group 视为不可分割整体</div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
              快照中已由用户建立的 Group（带子级标签的折叠项）保持为一个单元，不打散其子节点
            </div>
          </div>
          <input
            type="checkbox"
            checked={rulesSettings.treatExistingGroupsAsUnit}
            onChange={(e) => setRulesSettings({ treatExistingGroupsAsUnit: e.target.checked })}
            style={{ cursor: "pointer", width: 18, height: 18, accentColor: "#2563eb" }}
          />
        </div>

        <div style={{ borderTop: "1px solid #334155", paddingTop: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>默认最小成组阈值</div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
              同类标签达到该数量时才创建新 Group 折叠项（少于该阈值则保持原状，防止产生过多单标签组）
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              min={1}
              max={20}
              value={rulesSettings.defaultMinThreshold}
              onChange={(e) => setRulesSettings({ defaultMinThreshold: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{
                width: "70px",
                padding: "0.3rem 0.5rem",
                borderRadius: "0.375rem",
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                color: "#fff",
                fontSize: "0.85rem",
                textAlign: "center",
              }}
            />
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>个标签</span>
          </div>
        </div>
      </div>

      {/* Add Rule Form Modal / Collapsible */}
      {isAddOpen && (
        <div
          style={{
            padding: "1.5rem",
            borderRadius: "1rem",
            backgroundColor: "#1e293b",
            border: "1px solid #38bdf8",
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>新建分类规则</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                Group 名称 (如: 🎬 视频流媒体)
              </label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="例如: 💻 技术开发"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#0f172a",
                  border: "1px solid #374151",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                应用范围 (Scope)
              </label>
              <select
                value={newRule.scope}
                onChange={(e) => setNewRule({ ...newRule, scope: e.target.value as RuleScope })}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#0f172a",
                  border: "1px solid #374151",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              >
                <option value="all">全局所有面板</option>
                <option value="panel">指定特定面板 (Panel)</option>
              </select>
            </div>

            {newRule.scope === "panel" && (
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                  目标面板
                </label>
                <select
                  value={newRule.targetScopeId}
                  onChange={(e) => setNewRule({ ...newRule, targetScopeId: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "#0f172a",
                    border: "1px solid #374151",
                    color: "#fff",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="">请选择面板...</option>
                  {Object.entries(panels).map(([id, p]: [string, any]) => (
                    <option key={id} value={id}>
                      {p.name || id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                匹配域名 (逗号分隔)
              </label>
              <input
                type="text"
                value={newRule.matchDomain}
                onChange={(e) => setNewRule({ ...newRule, matchDomain: e.target.value })}
                placeholder="github.com, gitlab.com"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#0f172a",
                  border: "1px solid #374151",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                标题关键词 (逗号分隔)
              </label>
              <input
                type="text"
                value={newRule.matchKeyword}
                onChange={(e) => setNewRule({ ...newRule, matchKeyword: e.target.value })}
                placeholder="react, vue, typescript"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#0f172a",
                  border: "1px solid #374151",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                成组阈值 (达到多少个才建组)
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={newRule.minThreshold}
                onChange={(e) => setNewRule({ ...newRule, minThreshold: parseInt(e.target.value) || 2 })}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#0f172a",
                  border: "1px solid #374151",
                  color: "#fff",
                  fontSize: "0.85rem",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button
              onClick={() => setIsAddOpen(false)}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: "9999px",
                border: "1px solid #475569",
                backgroundColor: "transparent",
                color: "#94a3b8",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              onClick={handleCreateRule}
              style={{
                padding: "0.4rem 1.25rem",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#fff",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              保存规则
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>当前规则列表 ({rulesSettings.rules.length})</h2>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>从上至下优先级匹配</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {rulesSettings.rules.map((rule, idx) => (
            <div
              key={rule.id}
              style={{
                padding: "1rem 1.25rem",
                borderRadius: "0.75rem",
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: rule.enabled ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  style={{ cursor: "pointer", width: 16, height: 16, accentColor: "#2563eb" }}
                />

                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: rule.color || "#38bdf8",
                  }}
                />

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{rule.name}</span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        backgroundColor: "#0f172a",
                        color: "#94a3b8",
                        border: "1px solid #334155",
                      }}
                    >
                      {rule.scope === "all" ? "全局" : `面板: ${rule.targetScopeId || "未指定"}`}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        backgroundColor: "#0f172a",
                        color: "#94a3b8",
                        border: "1px solid #334155",
                      }}
                    >
                      阈值: {rule.minThreshold ?? rulesSettings.defaultMinThreshold}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                    {rule.matchDomain && (
                      <span style={{ marginRight: "1rem" }}>
                        <strong>域名:</strong> {rule.matchDomain}
                      </span>
                    )}
                    {rule.matchKeyword && (
                      <span>
                        <strong>关键词:</strong> {rule.matchKeyword}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => deleteRule(rule.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "0.4rem",
                  borderRadius: "9999px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                title="删除规则"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* AI Rule Generator Chat Hop-up Modal */}
      <AIRulesChatModal isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
    </div>
  );
}
