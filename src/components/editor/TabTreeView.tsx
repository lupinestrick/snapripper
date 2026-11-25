"use client";

import React, { useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Pin,
  ExternalLink,
  Copy,
  Layers,
  Globe,
  Folder,
  Upload,
} from "lucide-react";
import { TabTreeNode } from "@/types/sidebery";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { filterTree } from "@/services/treeOperations";
import { extractDomain, getFaviconUrl } from "@/utils/urlHelper";
import { Button } from "@/components/ui/button";

export function TabTreeView() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    rootNodes,
    expandedIds,
    toggleExpand,
    selectedIds,
    selectTab,
    searchQuery,
    setSearchQuery,
    panelFilter,
    setPanelFilter,
    containerFilter,
    setContainerFilter,
    onlyDuplicates,
    setOnlyDuplicates,
    duplicateUrls,
    rawSnapshot,
    loadSnapshot,
  } = useSnapshotStore();

  const filteredTree = React.useMemo(() => {
    return filterTree(rootNodes, searchQuery, {
      panelId: panelFilter || undefined,
      containerId: containerFilter || undefined,
      showOnlyDuplicates: onlyDuplicates,
      duplicateUrls,
    });
  }, [rootNodes, searchQuery, panelFilter, containerFilter, onlyDuplicates, duplicateUrls]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        loadSnapshot(event.target?.result as string, file.name);
      } catch (err: any) {
        alert(err.message || "读取失败");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (rootNodes.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          minHeight: "50vh",
          color: "var(--text-muted)",
          gap: "0.75rem",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        <Layers size={40} strokeWidth={1.4} color="var(--border-card)" />
        <span style={{ fontSize: "0.9rem", color: "var(--text-main)", fontWeight: 500 }}>
          暂无快照
        </span>
        <Button
          variant="solid"
          size="sm"
          pill
          onClick={() => fileInputRef.current?.click()}
          style={{
            backgroundColor: "var(--accent-solid)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <Upload size={14} />
          <span>导入 JSON</span>
        </Button>
      </div>
    );
  }

  if (filteredTree.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          minHeight: "40vh",
          color: "var(--text-muted)",
          gap: "0.65rem",
        }}
      >
        <span style={{ fontSize: "0.88rem" }}>无匹配标签</span>
        <Button
          variant="outline"
          size="xs"
          pill
          onClick={() => {
            setSearchQuery("");
            setPanelFilter(null);
            setContainerFilter(null);
            setOnlyDuplicates(false);
          }}
        >
          重置筛选
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "0.5rem 0.75rem 5rem 0.75rem", overflowY: "auto", flex: 1 }}>
      {filteredTree.map((node) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          selectedIds={selectedIds}
          selectTab={selectTab}
          duplicateUrls={duplicateUrls}
          containers={rawSnapshot?.containers || {}}
        />
      ))}
    </div>
  );
}

interface TreeNodeRowProps {
  node: TabTreeNode;
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  selectedIds: Set<string>;
  selectTab: (id: string, isMulti?: boolean) => void;
  duplicateUrls: Set<string>;
  containers: Record<string, any>;
}

function TreeNodeRow({
  node,
  depth,
  expandedIds,
  toggleExpand,
  selectedIds,
  selectTab,
  duplicateUrls,
  containers,
}: TreeNodeRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedIds.has(node.id);
  const isDuplicate = duplicateUrls.has(node.tab.url);
  const isGroupNode = Boolean(node.isCategoryHeader || node.isGroup);

  const container = node.tab.containerId ? containers[node.tab.containerId] : null;
  const domain = extractDomain(node.tab.url);
  const favicon = getFaviconUrl(node.tab.url, node.tab.favIconUrl);

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(node.tab.url);
  };

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(node.tab.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <div
        onClick={(e) => {
          selectTab(node.id, e.ctrlKey || e.metaKey || e.shiftKey);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.45rem",
          padding: "0.3rem 0.5rem",
          paddingLeft: `${depth * 1.2 + 0.45}rem`,
          borderRadius: "0.375rem",
          backgroundColor: isSelected
            ? "var(--accent-subtle)"
            : isHovered
              ? "var(--bg-hover)"
              : "transparent",
          border: isSelected ? "1px solid var(--accent-border)" : "1px solid transparent",
          cursor: "pointer",
          transition: "background 0.1s ease",
          fontSize: "0.82rem",
          userSelect: "none",
        }}
      >
        <div style={{ width: "1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                padding: 0,
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <div style={{ width: "14px" }} />
          )}
        </div>

        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={(e) => {
            e.stopPropagation();
            selectTab(node.id, true);
          }}
          style={{ cursor: "pointer", accentColor: "var(--accent)", flexShrink: 0 }}
        />

        <div style={{ display: "flex", alignItems: "center", width: "1rem", flexShrink: 0 }}>
          {isGroupNode ? (
            <Folder size={15} style={{ color: "var(--accent)" }} />
          ) : favicon ? (
            <img
              src={favicon}
              alt=""
              style={{ width: 15, height: 15, borderRadius: 2 }}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <Globe size={14} color="var(--text-muted)" />
          )}
        </div>

        <span
          style={{
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontWeight: isGroupNode ? 600 : 400,
            color: isGroupNode ? "var(--accent-text)" : "var(--text-main)",
          }}
          title={`${node.tab.title}\n${node.tab.url}`}
        >
          {node.tab.title || "无标题"}
          {isGroupNode && hasChildren && (
            <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", fontWeight: 400, color: "var(--text-muted)" }}>
              ({node.children.length})
            </span>
          )}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
          {isDuplicate && (
            <span
              style={{
                fontSize: "0.65rem",
                padding: "0.08rem 0.35rem",
                borderRadius: "9999px",
                backgroundColor: "rgba(239, 68, 68, 0.16)",
                color: "var(--danger)",
                fontWeight: 600,
              }}
            >
              重复
            </span>
          )}

          {node.tab.pinned && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: "0.65rem",
                padding: "0.12rem 0.3rem",
                borderRadius: "9999px",
                backgroundColor: "rgba(245, 158, 11, 0.18)",
                color: "var(--warning)",
              }}
              title="置顶"
            >
              <Pin size={10} />
            </span>
          )}

          {container && (
            <span
              style={{
                fontSize: "0.66rem",
                padding: "0.08rem 0.38rem",
                borderRadius: "4px",
                backgroundColor: "var(--bg-subtle)",
                color: "var(--text-muted)",
                borderLeft: `2px solid ${container.color || "var(--accent)"}`,
              }}
            >
              {container.name}
            </span>
          )}

          {domain && !isGroupNode && (
            <span
              style={{
                fontSize: "0.68rem",
                padding: "0.08rem 0.4rem",
                borderRadius: "4px",
                backgroundColor: "var(--bg-subtle)",
                color: "var(--text-muted)",
                maxWidth: "150px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {domain}
            </span>
          )}

          {/* Hover-only Row Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.1rem",
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? "auto" : "none",
              transition: "opacity 0.1s ease",
            }}
          >
            <button
              type="button"
              onClick={handleCopyUrl}
              title="复制 URL"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "0.18rem",
              }}
            >
              <Copy size={12} />
            </button>

            {!isGroupNode && (
              <button
                type="button"
                onClick={handleOpenUrl}
                title="新窗口打开"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "0.18rem",
                }}
              >
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              selectedIds={selectedIds}
              selectTab={selectTab}
              duplicateUrls={duplicateUrls}
              containers={containers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
