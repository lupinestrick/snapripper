"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 贪心最小高度优先瀑布流分列算法：保证各列独立纵向堆叠，不被横向卡片拉伸行高
 */
export function distributeMasonryItems<T>(
  items: T[],
  columnCount: number,
  estimateHeight: (item: T) => number = () => 100
): T[][] {
  const safeCols = Math.max(1, Math.min(columnCount, Math.max(1, items.length)));
  const columns: T[][] = Array.from({ length: safeCols }, () => []);
  const colHeights = new Array<number>(safeCols).fill(0);

  for (const item of items) {
    let shortestIdx = 0;
    for (let i = 1; i < safeCols; i++) {
      if (colHeights[i] < colHeights[shortestIdx]) {
        shortestIdx = i;
      }
    }
    columns[shortestIdx].push(item);
    colHeights[shortestIdx] += Math.max(1, estimateHeight(item));
  }

  return columns;
}

interface MasonryColumnsProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  estimateHeight?: (item: T) => number;
  minColumnWidth?: number;
  maxColumns?: number;
  gap?: string;
}

export function MasonryColumns<T>({
  items,
  getKey,
  renderItem,
  estimateHeight,
  minColumnWidth = 280,
  maxColumns = 3,
  gap = "0.55rem",
}: MasonryColumnsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [desiredCols, setDesiredCols] = useState<number>(() => {
    if (typeof window === "undefined") return 2;
    return window.innerWidth >= 1040 ? Math.min(3, maxColumns) : window.innerWidth >= 640 ? 2 : 1;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateCols = (width: number) => {
      if (width <= 0) return;
      const gapPx = 10;
      const fitCount = Math.floor((width + gapPx) / (minColumnWidth + gapPx));
      setDesiredCols(Math.max(1, Math.min(maxColumns, fitCount || 1)));
    };

    updateCols(el.clientWidth);

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          updateCols(entry.contentRect.width);
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    const onResize = () => updateCols(el.clientWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minColumnWidth, maxColumns]);

  const columns = useMemo(
    () => distributeMasonryItems(items, desiredCols, estimateHeight),
    [items, desiredCols, estimateHeight]
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap,
        width: "100%",
      }}
    >
      {columns.map((colItems, colIdx) => (
        <div
          key={colIdx}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap,
          }}
        >
          {colItems.map((item) => (
            <React.Fragment key={getKey(item)}>{renderItem(item)}</React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
