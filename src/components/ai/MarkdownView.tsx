"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface MarkdownViewProps {
  content: string;
}

/**
 * 轻量级无外部依赖 JSON 语法高亮
 */
function highlightJSON(code: string): React.ReactNode[] {
  const tokenRegex =
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:])/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(code.slice(lastIndex, match.index));
    }

    const token = match[0];
    let color = "var(--text-main)";

    if (token.startsWith('"')) {
      if (token.endsWith(":")) {
        // JSON key (keep trailing colon muted)
        const keyPart = token.slice(0, -1);
        nodes.push(
          <span key={`jk_${key++}`} style={{ color: "var(--accent-text)", fontWeight: 600 }}>
            {keyPart}
          </span>
        );
        nodes.push(
          <span key={`jc_${key++}`} style={{ color: "var(--text-muted)" }}>
            :
          </span>
        );
        lastIndex = tokenRegex.lastIndex;
        continue;
      } else {
        color = "var(--success, #10b981)";
      }
    } else if (/^(true|false|null)$/.test(token)) {
      color = "#c084fc";
    } else if (/^-?\d/.test(token)) {
      color = "#f59e0b";
    } else if (/^[{}\[\],:]$/.test(token)) {
      color = "var(--text-muted)";
    }

    nodes.push(
      <span key={`jt_${key++}`} style={{ color }}>
        {token}
      </span>
    );
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < code.length) {
    nodes.push(code.slice(lastIndex));
  }
  return nodes;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const normalizedLang = lang.trim().toLowerCase();
  const trimmedCode = code.trim();
  const isJson =
    normalizedLang === "json" ||
    normalizedLang === "jsonc" ||
    (!normalizedLang && (trimmedCode.startsWith("{") || trimmedCode.startsWith("[")));

  return (
    <div
      style={{
        margin: "0.6rem 0",
        borderRadius: "0.65rem",
        border: "1px solid var(--border-card)",
        backgroundColor: "var(--bg-card)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.35rem 0.7rem",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-subtle)",
          fontSize: "0.7rem",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600 }}>
          {normalizedLang || (isJson ? "json" : "code")}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            background: "transparent",
            border: "none",
            color: copied ? "var(--success, #10b981)" : "var(--text-muted)",
            fontSize: "0.7rem",
            cursor: "pointer",
            padding: "2px 4px",
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "0.7rem 0.85rem",
          overflowX: "auto",
          maxHeight: "360px",
          overflowY: "auto",
          fontSize: "0.76rem",
          lineHeight: 1.55,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          color: "var(--text-main)",
        }}
      >
        <code>{isJson ? highlightJSON(code) : code}</code>
      </pre>
    </div>
  );
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

    // Fenced code blocks (```json ... ```)
    if (trimmed.startsWith("```")) {
      flushList();
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <CodeBlock key={`cb_${i}_${elements.length}`} lang={lang} code={codeLines.join("\n")} />
      );
      continue;
    }

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
