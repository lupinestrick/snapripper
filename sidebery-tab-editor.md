# Sidebery 快照智能整理工具 (SnapRipper) 实施计划书

> **文档版本**: 1.0.0  
> **创建日期**: 2026-10-29  
> **项目类型**: WEB (Local-First 单页桌面端 Web 应用)  
> **核心目标**: 针对 Firefox Sidebery 导出的标签页快照（Tab Snapshot JSON），提供本地安全解析、树状拖拽与批量编辑、生成式 AI 标签比例分析，以及按比例灵活重构分类导出功能。

---

## 一、 项目背景与核心痛点

### 1.1 现状与问题
- **标签页囤积（Tab Hoarding）**：重度浏览器用户常积累数百乃至数千个标签页，Sidebery 提供了强大的侧边栏树形展示及快照备份（Snapshot）功能。
- **快照缺乏有效整理手段**：导出的快照文件为庞大且复杂的 JSON，用户无法在外部直观编辑、去重或调整层级；一旦重新导入浏览器，容易导致侧边栏再次杂乱。
- **分类标准主观且耗时**：面对上千个标签，人工逐个分类极其耗时；而简单的基于域名的规则无法识别网页的真实业务场景（例如同一个 `github.com` 下包含工具、学习教程、待办 PR、收藏库等完全不同的类别）。

### 1.2 解决方案 (SnapRipper)
1. **本地优先与隐私保护**：快照文件在浏览器内存与 IndexedDB 中本地解析，绝不上载至第三方中间服务器；
2. **现代化高性能树状编辑器**：基于 **Next.js 15 + Park UI (Ark UI + Panda CSS)**，支持数千个标签的流畅滚动、多选、拖拽层级调整、快速搜索过滤与去重；
3. **两阶段 AI 比例探索与分类**：
   - **阶段一（比例探查）**：提取 URL 路径、域名与标题等精简指纹，由 AI 发现当前标签集的主题分布与比例（如：前端开发 35%、音视频 20%、AI 论文 15%...），生成可视化交互看板；
   - **阶段二（微调与归类）**：用户在 UI 上调整分类名称、合并类别或设定目标比例阈值后，AI 批量执行结构映射；
4. **多维度导出兼容**：无损保留 Sidebery 容器（Containers）与面板（Panels）元数据，支持重构成“树状父标签”、“Sidebery 面板”或“Firefox 容器”并导出有效快照。

---

## 二、 系统架构与技术选型

### 2.1 技术栈清单 (Tech Stack)

| 模块 / 层次 | 技术选型 | 选型考量与优势 |
|---|---|---|
| **核心框架** | Next.js 15 (App Router, React 19, TypeScript) | 工业级 React 体系，优异的类型推断与代码组织规范，本地开发秒级热更 |
| **UI 组件库** | **Park UI** (`@park-ui/react`, 基于 Ark UI) | 基于 Zag.js 状态机的高可用无障碍（WAI-ARIA）组件库，原生提供 TreeView、Dialog 等丰富模式 |
| **样式引擎** | **Panda CSS** (`@pandacss/dev` + `@park-ui/panda-preset`) | 编译期零运行时 CSS-in-JS，严格类型安全的 Design Tokens 与 Recipes，**完全规避 Tailwind 类名堆叠** |
| **标签树驱动** | Ark UI `TreeView` + 虚拟滚动集成 | 原生支持多选、层级折叠展开与键盘导航，针对数千节点深度优化 |
| **本地状态存储** | Zustand + `idb-keyval` (IndexedDB) | 快照体积通常 2MB~20MB，突破 LocalStorage 5MB 限制，保证毫秒级自动持久化与撤销重做（Undo/Redo） |
| **AI 接口抽象** | 自研轻量级 Fetch 驱动 (OpenAI 兼容端点) | 支持自带 API Key 直连主流云端 LLM（Gemini 2.0 Flash / DeepSeek / OpenAI），且 100% 兼容本地 Ollama |
| **数据序列化** | 原生 Web Streams + File System Access API / Blob | 零网络依赖的文件导出与安全校验 |

### 2.2 整体架构数据流

```
[Sidebery JSON 快照文件]
         │ (用户拖拽上传)
         ▼
[snapshotParser.ts] ─── 安全校验 & v4/v5 数据结构规范化
         │
         ├───► [IndexedDB: 本地持久化缓存]
         ▼
[Snapshot AST (统一树结构)] ◄───► [useSnapshotStore (Zustand)]
         │                                │
         ├── (可视化编辑)                  ├── (AI 比例分析)
         ▼                                ▼
[Park UI TreeView 渲染]           [aiClient: 提示词与精简上下文]
(搜索/多选/拖拽/去重)                       │
         │                        ┌───────┴───────┐
         │                        ▼               ▼
         │                 [云端 API (Gemini)] [本地 Ollama]
         │                        │               │
         │                        └───────┬───────┘
         │                                ▼
         │                     [阶段 1: 类别比例分布看板]
         │                                │ (用户确认/微调)
         │                                ▼
         │                     [阶段 2: 批量节点分类执行]
         ▼                                │
[重构引擎: exportHelper.ts] ◄──────────────┘
(模式选择: 树形父标签 / 面板拆分 / 容器划分)
         │
         ▼
[导出的 Sidebery JSON 快照] ───► 导入回 Firefox Sidebery
```

---

## 三、 数据模型与核心规范 (Data Schemas)

### 3.1 Sidebery 核心数据结构适配
```typescript
// src/types/sidebery.ts

export interface SideberyTab {
  id: number | string;
  panelId: string;
  parentId: number | string; // -1 或 undefined 表示顶级标签
  lvl?: number;              // 树形缩进层级 (0: 顶层, 1: 子标签...)
  title: string;
  url: string;
  pinned?: boolean;
  containerId?: string;      // Firefox Multi-Account Container ID
  customTitle?: string | null;
  customColor?: string | null;
  favIconUrl?: string;
}

export interface SideberyPanel {
  id: string;
  name: string;
  color?: string;
  iconSVG?: string;
}

export interface SideberyContainer {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface SideberySnapshot {
  id: string;
  time: number;
  containers?: Record<string, SideberyContainer>;
  panels?: Record<string, SideberyPanel>;
  windows: Record<string, {
    tabs: SideberyTab[];
  }>;
}
```

### 3.2 AI 分类与比例数据模型
```typescript
// src/types/ai.ts

export interface CategoryProportion {
  id: string;
  name: string;              // 类别名称，如 "前端开发与工程化"
  color: string;             // 用于 UI 比例图的色值标识
  ratio: number;             // 当前占比 (百分比 0-100)
  targetRatio?: number;      // 用户设定的目标比例
  description: string;       // 类别覆盖的网站特征说明
  matchCount: number;        // 匹配到的标签数量
}

export interface ProportionAnalysisReport {
  totalAnalyzed: number;
  excludedCount: number;     // 豁免的固定标签与特殊页数量
  categories: CategoryProportion[];
  suggestedAction: string;
}

export interface TabClassificationResult {
  tabId: string | number;
  categoryId: string;
  confidence: number;
}
```

---

## 四、 核心工作流与边界决策 (Workflows & Edge Cases)

### 4.1 边界情况执行准则 (已确认)
1. **Edge Case 1: 原有嵌套子树保护**
   - **策略**：**保持子树完整性**。
   - **逻辑**：AI 仅对快照中的顶层根标签（`parentId === -1` 或顶层节点）进行特征识别与归类；其下挂载的所有子孙标签自动作为整体一同归入对应新分类，严禁打散已有用户整理好的上下文关系。
2. **Edge Case 2: 固定标签与内建页豁免**
   - **策略**：**自动锁定保护**。
   - **逻辑**：所有 `pinned: true` 的固定标签，以及协议为 `about:`, `chrome:`, `moz-extension:` 的内建页面，自动被移出 AI 归类队列，并在最终导出时始终保持在顶部原有位置。
3. **Edge Case 3: 超大快照（1,000 ~ 5,000 标签）的 Token 优化**
   - **精简指纹压缩**：送入 AI 分析时，剔除无关字段，仅提取 `[id, domain, cleaned_pathname, title_truncated]`，将单条标签体积压缩至 30~50 字符以内；
   - **批次分块（Chunking）**：针对本地 Ollama 等上下文受限环境，支持 100 篇/批次的分块处理与进度条回显。

### 4.2 两阶段 AI 归类交互细节
```
[点击 AI 智能整理]
       │
       ▼
[指纹提取器] ── 剔除 Pinned 和 about: 页面，生成精简文本
       │
       ▼
[阶段 1 提示词: 比例探查] ──► LLM 返回分类建议及各自比例百分比
       │
       ▼
[前端渲染: 比例看板交互]
  - 饼状/条形比例进度条
  - 用户可重命名分类、合并小分类或新增指定分类
  - 用户点击【确认应用分类】
       │
       ▼
[阶段 2 提示词: 批量映射] ──► LLM/规则引擎输出 `[tabId -> categoryId]` 映射表
       │
       ▼
[本地树重构] ── 在 TreeView 中实时预览重构结果，支持撤销 (Undo)
```

### 4.3 三种导出重组模式 (3C 灵活选项)
1. **模式 A: 树形父标签 (Tree Header Tabs - 默认推荐)**
   - 在当前面板内为每个分类生成一个虚拟父标签（例如 `📁 [前端开发]`）；
   - 对应分类的标签作为其子节点（`parentId` 指向该父标签 ID，`lvl = 1`）。
2. **模式 B: 拆分 Sidebery 面板 (Panels)**
   - 自动在快照中新建对应的 Sidebery 面板定义；
   - 将各个分类的标签的 `panelId` 修改为对应面板 ID。
3. **模式 C: 映射 Firefox 容器 (Containers)**
   - 为各个分类绑定指定的 Firefox 多账号容器环境。

---

## 五、 项目目录结构规划

```
snapripper/
├── panda.config.ts             # Panda CSS 配置 (Park UI preset, token 规范)
├── next.config.ts              # Next.js 15 配置 (启用客户端静态兼容)
├── package.json
├── tsconfig.json
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 根布局：Park UI 主题 Provider、全局字体
│   │   ├── page.tsx            # 主工作台（Workbench）：工作区左右双栏
│   │   └── globals.css         # Panda CSS 生成入口与基础重置样式
│   ├── components/
│   │   ├── ui/                 # Park UI 基础组件库 (Ark UI + Panda Recipes)
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── tree-view.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   └── badge.tsx
│   │   ├── layout/             # 界面框架
│   │   │   ├── TopNav.tsx      # 顶部标题栏、文件导入导出、设置按钮
│   │   │   ├── StatsHeader.tsx # 快照元信息、标签总数、重复率快速预览
│   │   │   └── Footer.tsx      # 状态与持久化提示
│   │   ├── editor/             # 标签编辑核心
│   │   │   ├── TabTreeView.tsx # 基于 Park UI TreeView 的树状标签区
│   │   │   ├── TabNodeRow.tsx  # 单个标签行：图标、标题、域名、Pinned、层级
│   │   │   ├── BatchBar.tsx    # 浮动批量操作条（多选删除/移动/去重）
│   │   │   └── SearchFilter.tsx# 实时过滤（按域名、标题、容器、面板）
│   │   ├── ai/                 # AI 分析与比例系统
│   │   │   ├── AIConfigDialog.tsx   # 模型端点配置 (OpenAI/Ollama/Gemini)
│   │   │   ├── ProportionCard.tsx   # 类别比例分布图表与微调看板
│   │   │   └── CategorizeModal.tsx  # 分类执行弹窗与进度反馈
│   │   └── export/
│   │       └── ExportDialog.tsx     # 导出选项（树形/面板/容器模式选择与下载）
│   ├── types/
│   │   ├── sidebery.ts         # Sidebery 完整快照结构及内部 AST 定义
│   │   └── ai.ts               # 分类与比例分析接口定义
│   ├── services/
│   │   ├── snapshotParser.ts   # 快照导入校验、规范化与版本迁移
│   │   ├── treeOperations.ts   # 树结构变换、父子节点更新、去重算法
│   │   └── aiService.ts        # OpenAI/Ollama 兼容流式请求与重试处理
│   ├── store/
│   │   ├── useSnapshotStore.ts # 主状态仓库：快照数据、选中项、操作历史
│   │   └── useConfigStore.ts   # 用户配置：AI API Key、BaseURL、保护选项
│   └── utils/
│       ├── urlHelper.ts        # 域名提取、URL 规范化、去参去重工具
│       └── exportSerializer.ts # 还原 Sidebery 格式合法 JSON
└── tests/
    ├── snapshotParser.test.ts  # 快照解析与序列化测试
    └── treeOperations.test.ts  # 树节点操作与重构测试
```

---

## 六、 详细实施任务拆解 (Task Breakdown)

### Phase 1: 项目基础建设与 Sidebery 解析器
- [x] **Task 1.1: 初始化 Next.js 15 + Panda CSS + Park UI 骨架**
  - **负责人**: `frontend-specialist` | **规范**: `clean-code`
  - **输入**: 干净目录 `snapripper/`
  - **输出**: 成功安装配置 Next.js 15, `@pandacss/dev`, `@park-ui/panda-preset`, `@ark-ui/react`, `lucide-react`
  - **验证**: 运行 `npm.cmd run build` 成功无报错，Panda CSS 代码生成正常。
- [x] **Task 1.2: Sidebery 快照解析、验证与 AST 构建引擎 (`snapshotParser.ts`)**
  - **负责人**: `frontend-specialist` | **规范**: `testing-patterns`
  - **输入**: Sidebery v4 与 v5 快照 JSON 样本
  - **输出**: 完整的 TypeScript 解析与序列化方法，支持单/多快照自适应，准确提取 `windows`, `tabs`, `panels`, `containers`
  - **验证**: 单元测试跑通，任意快照经“解析 → AST → 重新序列化”后关键数据无损。

### Phase 2: 高性能树状编辑与批量操作工作台
- [x] **Task 2.1: 构建基于 Park UI TreeView 的侧边栏标签树组件 (`TabTreeView.tsx`)**
  - **负责人**: `frontend-specialist` | **规范**: `frontend-architecture`
  - **输入**: 快照标签 AST
  - **输出**: 具备折叠展开、单选/复选、标题即时编辑、域名 Badge 标注、固定标签置顶显示的树状视图
  - **验证**: 导入 2000 个模拟节点，滚动流畅度保持 60fps，折叠展开无卡顿。
- [x] **Task 2.2: 搜索过滤、多选与批量动作浮动条 (`BatchBar.tsx`, `SearchFilter.tsx`)**
  - **负责人**: `frontend-specialist` | **规范**: `frontend-design`
  - **输入**: 选中的 Tab 集合与搜索关键字
  - **输出**: 毫秒级按域名/标题搜索高亮，浮动批量工具栏（支持一键去重、批量移至面板、批量删除、标记 Pinned）
  - **验证**: 批量删除 100 个节点，其关联的子节点正确跟随提升或递归清理，状态不产生孤儿节点。

### Phase 3: AI 比例探查与智能分类系统
- [x] **Task 3.1: 统一 AI 通信适配层 (`aiService.ts`)**
  - **负责人**: `frontend-specialist` | **规范**: `api-patterns`
  - **输入**: API BaseURL、Key、Model Name (支持 OpenAI, Gemini OpenAI 兼容端点, 本地 Ollama)
  - **输出**: 健壮的 JSON 请求/流式解析器，带有错误拦截与网络重试
  - **验证**: 提供内置 Mock 测试，测试连接成功返回 200。
- [x] **Task 3.2: 阶段一：类别比例探查看板 (`ProportionCard.tsx`)**
  - **负责人**: `frontend-specialist` | **规范**: `frontend-design`
  - **输入**: 剔除保护项后的精简标签指纹集
  - **输出**: AI 自动归纳出 4~8 个核心类别及百分比比例（带彩色比例进度条），用户可点击重命名、合并类别或添加新类别
  - **验证**: 触发 AI 分析后，看板准确展示总计 100% 的比例分布，支持用户交互编辑。
- [x] **Task 3.3: 阶段二：批量映射与树重构执行器 (`CategorizeModal.tsx`)**
  - **负责人**: `frontend-specialist` | **规范**: `clean-code`
  - **输入**: 用户确认后的类别列表与快照节点
  - **输出**: 自动为根标签分配对应分类 ID，并在 UI 上呈现“重组前后对比”供确认
  - **验证**: 执行分类后，所有被归类标签归属于对应分类，原有子树层级未被打散。

### Phase 4: 多维重组引擎与合法导出
- [x] **Task 4.1: 结构重组引擎 (`treeOperations.ts` / `exportSerializer.ts`)**
  - **负责人**: `frontend-specialist` | **规范**: `frontend-architecture`
  - **输入**: 带有分类结果的 AST + 目标结构选择（树形父标签 / Sidebery 面板 / 容器）
  - **输出**: 符合 Sidebery 导入规范的标准快照 JSON
  - **验证**: 导出的 JSON 在测试环境中能被 Sidebery 原生反序列化，数据完整合规。
- [x] **Task 4.2: 导出弹窗与本地自动备份流程 (`ExportDialog.tsx`)**
  - **负责人**: `frontend-specialist` | **规范**: `frontend-design`
  - **输入**: 最终编辑完成的快照状态
  - **输出**: 带有预览、统计摘要和一键下载 `.json` 文件的导出弹窗
  - **验证**: 点击下载能够正常触发浏览器保存文件，且 IndexedDB 同步保存历史版本。

---

## 七、 质量与安全验证 (Phase X)

项目在交付前，必须严格通过以下自动化与人工检查：
- [x] **代码质量与类型安全**: `npx.cmd tsc --noEmit` 0 错误
- [x] **样式规范检查**: 确认代码中**零 Tailwind 依赖**，全量遵循 Panda CSS / Park UI 规范
- [x] **自动化单元测试**: `tests/runAll.ts` 11/11 测试全部通过 (快照解析、树还原、去重、子树完整性保留)
- [x] **生产构建测试**: `npm.cmd run build` 成功打包静态输出 (Next.js 15 + Panda CSS)

## ✅ PHASE X COMPLETE
- Type Check: ✅ Pass (0 errors)
- Automated Tests: ✅ 11/11 Passed
- Build: ✅ Success (Next.js 15 App Router Production Bundle)
- Framework: ✅ Next.js + Park UI (Panda CSS, 0 Tailwind)
- Date: 2026-10-29

---

## 八、 实施里程碑 (Milestones)

```
M1 (Day 1): 基础就绪 ── Next.js 15 + Panda CSS + Park UI 初始化，Sidebery 快照解析验证通过
M2 (Day 2): 工作台完成 ── Park UI 树状可视化、搜索过滤、多选与批量去重编辑上线
M3 (Day 3): AI 智能闭环 ── 类别比例探查看板、用户微调、批量智能分类跑通
M4 (Day 4): 导出与交付 ── 三种重构模式导出、全面边界测试与构建验收完成
```
