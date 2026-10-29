"use client";

import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Pin,
  ExternalLink,
  Copy,
  Layers,
  Globe,
  Folder,
} from "lucide-react";
import { TabTreeNode } from "@/types/sidebery";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { filterTree } from "@/services/treeOperations";
import { extractDomain, getFaviconUrl } from "@/utils/urlHelper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function TabTreeView() {
  const {
    rootNodes,
    expandedIds,
    toggleExpand,
    selectedIds,
    selectTab,
    searchQuery,
    panelFilter,
    containerFilter,
    onlyDuplicates,
    duplicateUrls,
    rawSnapshot,
  } = useSnapshotStore();

  const filteredTree = React.useMemo(() => {
    return filterTree(rootNodes, searchQuery, {
      panelId: panelFilter || undefined,
      containerId: containerFilter || undefined,
      showOnlyDuplicates: onlyDuplicates,
      duplicateUrls,
    });
  }, [rootNodes, searchQuery, panelFilter, containerFilter, onlyDuplicates, duplicateUrls]);

  if (rootNodes.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          color: "#94a3b8",
          gap: "1rem",
        }}
      >
        <Layers size={48} strokeWidth={1.5} color="#334155" />
        <div style={{ textAlign: "center" }}>
          <h3 style={{ color: "#f8fafc", marginBottom: "0.25rem", fontSize: "1.1rem" }}>
            暂未加载 Sidebery 快照
          </h3>
          <p style={{ fontSize: "0.85rem" }}>
            点击右上角文件图标打开 <strong>“快照管理”</strong> 导入 Sidebery 导出的快照文件或加载测试样本
          </p>
        </div>
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
          height: "40vh",
          color: "#94a3b8",
          gap: "0.5rem",
        }}
      >
        <p style={{ fontSize: "0.9rem" }}>未匹配到任何标签页</p>
        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>请尝试更换搜索关键字或重置筛选条件</span>
      </div>
    );
  }

  return (
    <div style={{ padding: "0.75rem 1rem", overflowY: "auto", flex: 1 }}>
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
          panels={rawSnapshot?.panels || {}}
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
  panels: Record<string, any>;
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
  panels,
}: TreeNodeRowProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedIds.has(node.id);
  const isDuplicate = duplicateUrls.has(node.tab.url);

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
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.4rem 0.5rem",
          paddingLeft: `${depth * 1.5 + 0.5}rem`,
          borderRadius: "0.375rem",
          backgroundColor: isSelected ? "rgba(56, 189, 248, 0.15)" : "transparent",
          border: isSelected ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid transparent",
          cursor: "pointer",
          transition: "background 0.1s ease",
          fontSize: "0.85rem",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <div style={{ width: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {hasChildren ? (
            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              style={{
                padding: 0,
                width: "18px",
                height: "18px",
                color: "#94a3b8",
              }}
            >
              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </Button>
          ) : (
            <div style={{ width: "15px" }} />
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
          style={{ cursor: "pointer", accentColor: "#38bdf8" }}
        />

        <div style={{ display: "flex", alignItems: "center", width: "1rem", flexShrink: 0 }}>
          {node.isCategoryHeader ? (
            <Folder size={16} color="#38bdf8" />
          ) : favicon ? (
            <img
              src={favicon}
              alt=""
              style={{ width: 16, height: 16, borderRadius: 2 }}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <Globe size={15} color="#94a3b8" />
          )}
        </div>

        <span
          style={{
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontWeight: node.isCategoryHeader ? 600 : 400,
            color: node.isCategoryHeader ? "#38bdf8" : "#f8fafc",
          }}
          title={`${node.tab.title}\n${node.tab.url}`}
        >
          {node.tab.title || "无标题标签"}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
          {isDuplicate && (
            <Badge
              variant="subtle"
              size="sm"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.2)",
                color: "#f87171",
                fontSize: "0.68rem",
                padding: "0.1rem 0.35rem",
              }}
              title="存在重复 URL"
            >
              重复
            </Badge>
          )}

          {node.tab.pinned && (
            <Badge
              variant="subtle"
              size="sm"
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.2)",
                color: "#fbbf24",
                fontSize: "0.68rem",
                padding: "0.1rem 0.35rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Pin size={11} />
              <span>置顶</span>
            </Badge>
          )}

          {container && (
            <Badge
              variant="outline"
              size="sm"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                color: "#94a3b8",
                borderLeft: `2px solid ${container.color || "#38bdf8"}`,
                fontSize: "0.68rem",
              }}
            >
              {container.name}
            </Badge>
          )}

          {domain && !node.isCategoryHeader && (
            <Badge
              variant="outline"
              size="sm"
              style={{
                backgroundColor: "#1e293b",
                color: "#94a3b8",
                borderColor: "#334155",
                fontSize: "0.7rem",
              }}
            >
              {domain}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={handleCopyUrl}
            title="复制 URL"
            style={{ color: "#94a3b8", padding: "0.2rem" }}
          >
            <Copy size={13} />
          </Button>

          {!node.isCategoryHeader && (
            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={handleOpenUrl}
              title="在新窗口打开"
              style={{ color: "#94a3b8", padding: "0.2rem" }}
            >
              <ExternalLink size={13} />
            </Button>
          )}
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
              panels={panels}
            />
          ))}
        </div>
      )}
    </div>
  );
}
