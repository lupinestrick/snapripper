# Sidebery 快照智能整理工具 (SnapRipper) 实施计划书

> **更新日期**：2026-11-27 ｜ **架构定位**：Local-First Firefox Sidebery 快照编辑与结构重构工具

---

## 一、 技术选型

| 层次 | 选型 | 说明 |
| :--- | :--- | :--- |
| **应用框架** | Next.js 15 + React 19 + TypeScript | App Router，本地静态交互为主，辅以 `/api/ai/proxy` 转发模型请求 |
| **界面与样式** | Ark UI (`@ark-ui/react`) + Panda CSS + Lucide | 基于 Design Tokens 与主题变量（零 Tailwind） |
| **状态持久化** | Zustand (`persist`) + Cookie 元数据同步 | 快照树、撤销栈、规则与模型配置均本地存储，不依赖外部数据库 |
| **模型协议层** | OpenAI / Anthropic / Gemini 原生多协议驱动 | 支持多供应商独立槽位、自定义兼容端点及会话级模型列表缓存 |

---

## 二、 核心准则与数据安全

1. **高风险豁免保护**：`pinned: true` 标签及 `about:`、`chrome:`、`moz-extension:` 内建页自动排除在重构目标外，默认留守原位。
2. **子树上下文保护**：既有 Sidebery 原生 Group 组及连续父子树在聚类、规则和搬迁中尽量保持整体不拆散。
3. **先差分预览、后确认写入**：所有批处理与 AI 重构均先生成 Diff 预览确认后再写入快照树，支持随时撤销（Undo）。
4. **原件基线兜底**：导入时同步留存 `initialSnapshot` 原件基线，随时支持一键对比原件差异或还原初始状态。

---

## 三、 核心模块与目录映射

| 模块 | 职责概要 | 关键文件 |
| :--- | :--- | :--- |
| **工作台** | 导入解析、树形/扁平浏览、搜索与容器筛选、级联多选、批量移动/固定/删除 | `src/components/editor/*`、`src/services/snapshotParser.ts` |
| **处理中心** | URL 去重、同域名合并、规则批处理流水线、差分摘要与树对比确认 | `src/components/process/*`、`src/services/diffEngine.ts`、`domainMergeEngine.ts` |
| **规则引擎** | 组合条件 DSL（`all`/`any`、字段与正则、排除豁免）、阴影冲突检测、AI 规则生成 | `src/components/rules/*`、`src/services/ruleEngine.ts`、`src/constants/rulePresets.ts` |
| **AI 架构师** | 本地无监督微簇压缩（`microClusters`）、三阶段对话与微调、蓝图画布、三态重组（原地/归并/新建面板）与合并报告 | `src/components/ai/*`、`src/services/tabClusterEngine.ts`、`aiArchitectEngine.ts`、`src/constants/aiPrompts.ts` |
| **文件与设置** | 双栏快照体检、拖拽/粘贴导入、面板过滤与多格式导出（JSON / MD / HTML）、供应商配置、全站 Toast/确认弹窗 | `src/components/layout/SnapshotFileHopupModal.tsx`、`src/services/snapshotDataService.ts`、`src/components/settings/SettingsPage.tsx`、`src/components/ui/FeedbackHost.tsx` |

---

## 四、 实施里程碑与当前进度

- [x] **M1 基础解析与工作台**：完成 Sidebery v4/v5 快照解析、树构建还原、搜索筛选及批量操作条。
- [x] **M2 处理流水线与规则引擎**：完成 URL 去重、域名合并、组合条件 DSL 规则引擎、冲突检测与 AI 规则生成器。
- [x] **M3 AI 微簇架构师**：完成本地 100% 非豁免标签预聚类、三阶段（诊断反问 / 三方案生成 / 多轮微调）极简 Prompt 与解析容错、方案卡片气泡与蓝图画布微调、合并变更报告。
- [x] **M4 差分交互与文件中心重构**：完成统一变更摘要与瀑布流布局（含卡片内滚动）、原地/归并/新建面板三态切换与全局面板看板、双栏快照体检与原件基线对比/还原、全站轻反馈替换。
- [ ] **M5 后续可选演进**：
  - 彻底清理旧版标签比例分析（`proportionReport` / `analyzeTabProportions`）与历史兼容冗余字段；
  - 针对 5,000+ 超大快照扩展虚拟列表渲染与本地 IndexedDB 多存档槽（按需评估）。

---

## 五、 验收基线

- **类型检查**：`npx tsc --noEmit` 0 错误
- **自动化测试**：`npx tsx tests/runAll.ts` 177/177 通过（覆盖解析、树操作、域名合并、规则 DSL、微簇聚类、Prompt 解析、基线导出等）
- **生产构建**：`npm run build` 正常生成 Panda tokens 与打包输出
