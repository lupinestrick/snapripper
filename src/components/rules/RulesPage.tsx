"use client";

import React, { useState, useRef } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { CategorizationRule, RuleScope } from "@/types/sidebery";
import { AIRulesChatModal } from "./AIRulesChatModal";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Download, Upload, Sparkles, Edit3, X, Check } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CategorizationRule | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

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
    e.target.value = "";
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

  const handleOpenEdit = (rule: CategorizationRule) => {
    setEditingRule({ ...rule });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingRule) return;
    if (!editingRule.name.trim()) {
      alert("请输入 Group 目标名称");
      return;
    }
    if (!editingRule.matchDomain?.trim() && !editingRule.matchKeyword?.trim()) {
      alert("请至少填写域名或标题关键词中的一项");
      return;
    }
    updateRule(editingRule.id, editingRule);
    setIsEditOpen(false);
    setEditingRule(null);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "960px", margin: "0 auto", color: "var(--text-main)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>规则与成组设置</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            匹配域名与关键词自动归类到目标 Group 分组中
          </p>
        </div>

        {/* Action Controls - Park UI Make It Yours Button Style */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setIsAIChatOpen(true)}
          >
            <Sparkles size={13} />
            <span>AI 生成</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={13} />
            <span>导入</span>
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />

          <Button
            variant="outline"
            size="xs"
            onClick={handleExport}
          >
            <Download size={13} />
            <span>导出</span>
          </Button>

          <Button
            variant="solid"
            size="xs"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={13} />
            <span>添加规则</span>
          </Button>
        </div>
      </div>

      {/* Global Options Card */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          marginBottom: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-main)" }}>已有 Group 视为不可分割整体</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              快照中已建立的 Group 保持为整体，不拆散其子节点
            </div>
          </div>
          <input
            type="checkbox"
            checked={rulesSettings.treatExistingGroupsAsUnit}
            onChange={(e) => setRulesSettings({ treatExistingGroupsAsUnit: e.target.checked })}
            style={{ cursor: "pointer", width: 18, height: 18, accentColor: "var(--accent-solid)" }}
          />
        </div>

        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-main)" }}>默认最小成组阈值</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              同类标签达到该数量时才创建新 Group 折叠项
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Input
              type="number"
              min={1}
              max={20}
              size="sm"
              value={rulesSettings.defaultMinThreshold}
              onChange={(e) => setRulesSettings({ defaultMinThreshold: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{
                width: "70px",
                textAlign: "center",
              }}
            />
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>个标签</span>
          </div>
        </div>
      </div>

      {/* Add Rule Form Modal / Collapsible */}
      {isAddOpen && (
        <div
          style={{
            padding: "1.5rem",
            borderRadius: "var(--radius-btn, 8px)",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-focus)",
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "1rem" }}>新建分类规则</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                Group 名称 (如: 🎬 视频流媒体)
              </label>
              <Input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="例如: 💻 技术开发"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                应用范围
              </label>
              <Select
                value={newRule.scope}
                onChange={(e) => setNewRule({ ...newRule, scope: e.target.value as RuleScope })}
                pill={false}
              >
                <option value="all">全局所有面板</option>
                <option value="panel">指定特定面板</option>
              </Select>
            </div>

            {newRule.scope === "panel" && (
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  目标面板
                </label>
                <Select
                  value={newRule.targetScopeId}
                  onChange={(e) => setNewRule({ ...newRule, targetScopeId: e.target.value })}
                  pill={false}
                >
                  <option value="">请选择面板...</option>
                  {Object.entries(panels).map(([id, p]: [string, any]) => (
                    <option key={id} value={id}>
                      {p.name || id}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                匹配域名 (逗号分隔)
              </label>
              <Input
                type="text"
                value={newRule.matchDomain}
                onChange={(e) => setNewRule({ ...newRule, matchDomain: e.target.value })}
                placeholder="github.com, gitlab.com"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                标题关键词 (逗号分隔)
              </label>
              <Input
                type="text"
                value={newRule.matchKeyword}
                onChange={(e) => setNewRule({ ...newRule, matchKeyword: e.target.value })}
                placeholder="react, vue, typescript"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                成组阈值
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={newRule.minThreshold}
                onChange={(e) => setNewRule({ ...newRule, minThreshold: parseInt(e.target.value) || 2 })}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsAddOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="solid"
              size="xs"
              onClick={handleCreateRule}
            >
              保存规则
            </Button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-main)" }}>当前规则列表 ({rulesSettings.rules.length})</h2>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>从上至下优先级匹配</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {rulesSettings.rules.map((rule) => (
            <div
              key={rule.id}
              style={{
                padding: "1rem 1.25rem",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
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
                  style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--accent-solid)" }}
                />

                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: rule.color || "var(--accent)",
                  }}
                />

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-main)" }}>{rule.name}</span>
                    <Badge variant="outline" size="sm">
                      {rule.scope === "all" ? "全局" : `面板: ${rule.targetScopeId || "未指定"}`}
                    </Badge>
                    <Badge variant="outline" size="sm">
                      阈值: {rule.minThreshold ?? rulesSettings.defaultMinThreshold}
                    </Badge>
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
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

              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleOpenEdit(rule)}
                  style={{
                    color: "var(--text-muted)",
                    padding: "0.4rem",
                  }}
                  title="编辑规则"
                >
                  <Edit3 size={15} />
                </Button>

                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => deleteRule(rule.id)}
                  style={{
                    color: "var(--text-muted)",
                    padding: "0.4rem",
                  }}
                  title="删除规则"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Rule Hop-up Modal */}
      {editingRule && (
        <Dialog.Root open={isEditOpen} onOpenChange={(open) => !open && setIsEditOpen(false)}>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content style={{ maxWidth: "560px", padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <Dialog.Title>编辑分类规则</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    pill
                    onClick={() => setIsEditOpen(false)}
                    style={{ color: "var(--text-muted)", padding: "4px" }}
                    title="关闭"
                  >
                    <X size={18} />
                  </Button>
                </Dialog.CloseTrigger>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    Group 名称
                  </label>
                  <Input
                    type="text"
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                      应用范围
                    </label>
                    <Select
                      value={editingRule.scope}
                      onChange={(e) => setEditingRule({ ...editingRule, scope: e.target.value as RuleScope })}
                      pill={false}
                    >
                      <option value="all">全局所有面板</option>
                      <option value="panel">指定特定面板</option>
                    </Select>
                  </div>

                  {editingRule.scope === "panel" && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                        目标面板
                      </label>
                      <Select
                        value={editingRule.targetScopeId || ""}
                        onChange={(e) => setEditingRule({ ...editingRule, targetScopeId: e.target.value })}
                        pill={false}
                      >
                        <option value="">请选择面板...</option>
                        {Object.entries(panels).map(([id, p]: [string, any]) => (
                          <option key={id} value={id}>
                            {p.name || id}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    匹配域名 (逗号分隔)
                  </label>
                  <Input
                    type="text"
                    value={editingRule.matchDomain || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, matchDomain: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    标题关键词 (逗号分隔)
                  </label>
                  <Input
                    type="text"
                    value={editingRule.matchKeyword || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, matchKeyword: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    成组阈值
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={editingRule.minThreshold}
                    onChange={(e) => setEditingRule({ ...editingRule, minThreshold: parseInt(e.target.value) || 1 })}
                    style={{ width: "90px" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1.5rem" }}>
                <Button
                  variant="solid"
                  size="sm"
                  pill
                  onClick={handleSaveEdit}
                >
                  <Check size={14} />
                  <span>保存修改</span>
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      )}

      {/* AI Rule Generator Chat Hop-up Modal */}
      <AIRulesChatModal isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
    </div>
  );
}
