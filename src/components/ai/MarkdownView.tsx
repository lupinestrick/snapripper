"use client";

import React from "react";

interface MarkdownViewProps {
  content: string;
}

/**
 * 轻量级无外部依赖的 Markdown 格式化渲染组件
 */
export function MarkdownView({ content }: MarkdownViewProps) {
  const lines = content.split("\n");

  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul
          key={`ul_${elements.length}`}
          style={{
            margin: "0.5rem 0 0.5rem 1.25rem",
            paddingLeft: "0.5rem",
            listStyleType: "disc",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  const formatInline = (text: string): React.ReactNode => {
    // 简单解析 **粗体** 与 `代码`
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // 匹配 **bold**
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      // 匹配 `code`
      const codeMatch = remaining.match(/`([^`]+)`/);

      let firstMatch: { type: "bold" | "code"; index: number; length: number; content: string } | null = null;

      if (boldMatch && boldMatch.index !== undefined) {
        firstMatch = { type: "bold", index: boldMatch.index, length: boldMatch[0].length, content: boldMatch[1] };
      }

      if (codeMatch && codeMatch.index !== undefined) {
        if (!firstMatch || codeMatch.index < firstMatch.index) {
          firstMatch = { type: "code", index: codeMatch.index, length: codeMatch[0].length, content: codeMatch[1] };
        }
      }

      if (!firstMatch) {
        parts.push(remaining);
        break;
      }

      if (firstMatch.index > 0) {
        parts.push(remaining.slice(0, firstMatch.index));
      }

      if (firstMatch.type === "bold") {
        parts.push(
          <strong key={`b_${keyIdx++}`} style={{ fontWeight: 700, color: "var(--text-main)" }}>
            {firstMatch.content}
          </strong>
        );
      } else {
        parts.push(
          <code
            key={`c_${keyIdx++}`}
            style={{
              padding: "0.1rem 0.35rem",
              borderRadius: "4px",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.85em",
              fontFamily: "monospace",
              color: "var(--accent-text)",
            }}
          >
            {firstMatch.content}
          </code>
        );
      }

      remaining = remaining.slice(firstMatch.index + firstMatch.length);
    }

    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 标题 H1, H2, H3
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h4
          key={`h4_${i}`}
          style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            marginTop: "0.85rem",
            marginBottom: "0.35rem",
            color: "var(--text-main)",
          }}
        >
          {formatInline(trimmed.slice(4))}
        </h4>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h3
          key={`h3_${i}`}
          style={{
            fontSize: "1.05rem",
            fontWeight: 700,
            marginTop: "1.1rem",
            marginBottom: "0.45rem",
            color: "var(--accent-text)",
          }}
        >
          {formatInline(trimmed.slice(3))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h2
          key={`h2_${i}`}
          style={{
            fontSize: "1.2rem",
            fontWeight: 800,
            marginTop: "1.25rem",
            marginBottom: "0.5rem",
            color: "var(--text-main)",
          }}
        >
          {formatInline(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // 引用块
    if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={`bq_${i}`}
          style={{
            borderLeft: "3px solid var(--accent)",
            paddingLeft: "0.75rem",
            margin: "0.5rem 0",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            fontStyle: "italic",
          }}
        >
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // 列表项
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
      const itemContent = trimmed.replace(/^[-*]\s+|\d+\.\s+/, "");
      currentList.push(
        <li key={`li_${i}`} style={{ fontSize: "0.85rem", lineHeight: 1.5, color: "var(--text-main)" }}>
          {formatInline(itemContent)}
        </li>
      );
      continue;
    }

    // 分割线
    if (trimmed === "---" || trimmed === "***") {
      flushList();
      elements.push(
        <hr
          key={`hr_${i}`}
          style={{
            margin: "1rem 0",
            border: "none",
            borderTop: "1px solid var(--border-subtle)",
          }}
        />
      );
      continue;
    }

    // 普通段落
    flushList();
    if (trimmed) {
      elements.push(
        <p
          key={`p_${i}`}
          style={{
            fontSize: "0.85rem",
            lineHeight: 1.6,
            marginBottom: "0.4rem",
            color: "var(--text-main)",
          }}
        >
          {formatInline(line)}
        </p>
      );
    }
  }

  flushList();

  return <div style={{ wordBreak: "break-word" }}>{elements}</div>;
}
