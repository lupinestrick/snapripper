"use client";

import React, { useState } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { CategorizationRule, RuleScope } from "@/types/sidebery";
import { Plus, Trash2, Download, Upload, Check, Sliders, Shield } from "lucide-react";

export function RulesPage() {
  const {
    rulesSettings,
    setRulesSettings,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    importRulesJSON,
    exportRulesJSON,
  } = useConfigStore();

  const { rawSnapshot } = useSnapshotStore();
  const panels = rawSnapshot?.panels || {};

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>规则与成组设置</h1>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem" }}>
            匹配域名与标题关键词自动聚类为 Sidebery Group，支持设定应用面板范围与最小阈值。
          </p>
        </div>

        {/* Import / Export & Add Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
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

      {/* Global General Options Card */}
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
            style={{ width: "20px", height: "20px", accentColor: "#38bdf8", cursor: "pointer" }}
          />
        </div>

        <div style={{ height: "1px", backgroundColor: "#334155" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>全局默认成组最小阈值</div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
              匹配到至少指定数量的标签才自动创建 Group，低于该阈值的标签保留在原地
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              min={1}
              max={50}
              value={rulesSettings.defaultMinThreshold}
              onChange={(e) => setRulesSettings({ defaultMinThreshold: parseInt(e.target.value, 10) || 2 })}
              style={{
                width: "60px",
                padding: "0.3rem 0.5rem",
                borderRadius: "0.5rem",
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                color: "#fff",
                textAlign: "center",
                fontSize: "0.85rem",
              }}
            />
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>个标签</span>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.25rem" }}>
          当前规则列表 ({rulesSettings.rules.length})
        </div>

        {rulesSettings.rules.map((rule) => {
          const panelName = rule.targetScopeId ? panels[rule.targetScopeId]?.name || rule.targetScopeId : "全部面板";
          return (
            <div
              key={rule.id}
              style={{
                padding: "1rem 1.25rem",
                borderRadius: "0.875rem",
                backgroundColor: "#1e293b",
                border: rule.enabled ? "1px solid #334155" : "1px solid #1e293b",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: rule.enabled ? 1 : 0.6,
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  style={{ width: "18px", height: "18px", accentColor: "#38bdf8", cursor: "pointer" }}
                />

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{rule.name}</span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: rule.scope === "panel" ? "rgba(236, 72, 153, 0.15)" : "rgba(56, 189, 248, 0.15)",
                        color: rule.scope === "panel" ? "#f472b6" : "#38bdf8",
                        fontSize: "0.7rem",
                        fontWeight: 500,
                      }}
                    >
                      {rule.scope === "panel" ? `面板: ${panelName}` : "范围: 全局"}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      阈值: ≥{rule.minThreshold || 2}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.35rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                    {rule.matchDomain && (
                      <div>
                        <span style={{ color: "#64748b" }}>域名: </span>
                        <span>{rule.matchDomain}</span>
                      </div>
                    )}
                    {rule.matchKeyword && (
                      <div>
                        <span style={{ color: "#64748b" }}>关键词: </span>
                        <span>{rule.matchKeyword}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  onClick={() => deleteRule(rule.id)}
                  style={{
                    padding: "6px",
                    borderRadius: "9999px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#ef4444",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="删除规则"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Rule Dialog Modal */}
      {isAddOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setIsAddOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              backgroundColor: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              color: "#f8fafc",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>添加自定义分类规则</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                  目标 Group 名称 *
                </label>
                <input
                  type="text"
                  placeholder="例如: DLsite 作品 / Anime-Sharing"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    color: "#fff",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                    规则应用范围
                  </label>
                  <select
                    value={newRule.scope}
                    onChange={(e) => setNewRule({ ...newRule, scope: e.target.value as RuleScope })}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.5rem",
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      color: "#fff",
                      fontSize: "0.85rem",
                    }}
                  >
                    <option value="all">全部面板 (全局)</option>
                    <option value="panel">指定面板</option>
                  </select>
                </div>

                {newRule.scope === "panel" && (
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                      选择目标面板
                    </label>
                    <select
                      value={newRule.targetScopeId}
                      onChange={(e) => setNewRule({ ...newRule, targetScopeId: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        color: "#fff",
                        fontSize: "0.85rem",
                      }}
                    >
                      <option value="">请选择面板</option>
                      {Object.entries(panels).map(([pId, p]) => (
                        <option key={pId} value={pId}>
                          {p.name || pId}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                    成组阈值 (最少标签数)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newRule.minThreshold}
                    onChange={(e) => setNewRule({ ...newRule, minThreshold: parseInt(e.target.value, 10) || 2 })}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.5rem",
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      color: "#fff",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                  匹配域名 (多域名用逗号分隔)
                </label>
                <input
                  type="text"
                  placeholder="例如: dlsite.com, anime-sharing.com"
                  value={newRule.matchDomain}
                  onChange={(e) => setNewRule({ ...newRule, matchDomain: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    color: "#fff",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                  匹配标题关键词 (多关键词用逗号分隔)
                </label>
                <input
                  type="text"
                  placeholder="例如: RJ, 音声, 同人, GitHub"
                  value={newRule.matchKeyword}
                  onChange={(e) => setNewRule({ ...newRule, matchKeyword: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    color: "#fff",
                    fontSize: "0.85rem",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1.5rem" }}>
              <button
                onClick={() => setIsAddOpen(false)}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "9999px",
                  border: "1px solid #374151",
                  backgroundColor: "transparent",
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreateRule}
                style={{
                  padding: "0.5rem 1.5rem",
                  borderRadius: "9999px",
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                保存规则
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
