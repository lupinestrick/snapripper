# SnapRipper

本地优先的 Firefox [Sidebery](https://github.com/mbnuqw/sidebery) 快照编辑器与标签架构重构工具。  
导入 Sidebery Snapshot JSON → 清洗、规则分类与 AI 重构 → 差分确认后导出可恢复的 JSON 快照。

---

## 模块分工

| 模块 | 职责 |
| :--- | :--- |
| **工作台** | 树形/扁平浏览标签结构、搜索与容器筛选、级联勾选、批量移动或新建分组 |
| **处理中心** | URL 去重、同域名合并、规则批处理；所有修改均先生成差分（Diff）预览再应用 |
| **规则引擎** | 组合条件匹配（域名、路径、标题、正则与排除规则）、阴影冲突检测与 AI 规则生成 |
| **AI 架构师** | 本地预聚类为全覆盖微簇（`microClusters`），结合多模型接口生成可微调的重组方案 |
| **系统设置** | 主题切换、模型供应商管理与置顶、整理豁免偏好、本地缓存清理与配置 JSON 导入/导出 |

---

## 本地运行

```bash
npm install
npm run dev
```

常用命令：

| 命令 | 用途 |
| :--- | :--- |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 生成 Panda CSS tokens 并执行 Next.js 生产构建 |
| `npx tsx tests/runAll.ts` | 运行全部单元测试 |

---

## 数据与隐私

- 快照、规则与模型配置均保存在浏览器本地，不依赖外部数据库。
- 模型请求通过本地 `/api/ai/proxy` 转发，支持 OpenAI、Anthropic、Gemini 协议及自定义兼容接口。
