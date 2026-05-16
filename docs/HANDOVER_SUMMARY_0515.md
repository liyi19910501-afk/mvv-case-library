# 交接总结文档 (Handover Summary)

**时间**：2026-05-15
**接收对象**：负责后续接手本项目的核心 AI 助手
**核心目标**：梳理最新项目状态、已完成动作及下一阶段的核心任务，确保无缝接手。

---

## 一、名单与范围重构 (Tracking List Update)

根据最新讨论，重新确立了《首批正式跟踪名单》。更新内容已覆写在 `docs/首批正式跟踪名单建议.md` 文件中。

### 核心变动：
1. **删除**：达能 (Danone)、通义千问 (Qwen)。
2. **新增**：PDD (拼多多)、Disney (迪士尼)、Costco (好市多)、泡泡玛特 (Pop Mart)、安踏 (Anta)、招商银行 (CMB)。
3. **验证保留**：验证了 DeepSeek 具备独立的企业级文化表达（“探索未至之境”、“长期主义”等），予以保留。
4. **重新定档**：将 Patagonia 提至 Wave 1，确保首批跑通流程。

### 最终 Wave 分布定版（共 29 家）：
*   **Wave 1 (样板期, 8家)**：IKEA, Nike, 安克创新, OPPO, 华润集团, Google, OpenAI, Patagonia。
*   **Wave 2 (横向比较, 11家)**：Starbucks, P&G, Unilever, 华为, 小米, vivo, 阿里巴巴, 腾讯, 泡泡玛特, 安踏, PDD。
*   **Wave 3 (完整主库, 10家)**：Apple, L'Oreal, Coca-Cola, Anthropic, 字节跳动, 海底捞, 华住, Costco, 招商银行, DeepSeek, Disney。

---

## 二、代码与数据层修改 (Code & Data Modifications)

### 1. 废弃数据清理
*   执行 `rm -rf data/companies/danone`，彻底清除了不再跟踪的达能历史数据。

### 2. 开发并打通动态前端数据绑定 (`scripts/build-data.mjs`)
*   **动作**：编写了一个零外部依赖的 Node.js 自动化脚本。
*   **逻辑**：它遍历 `data/companies/` 目录，通过正则表达式提取各家公司 `profile.md` 中的 YAML 前置数据以及 Mission/Vision/Values 等区块内容，并自动定位 `assets/` 中的证据图片路径。
*   **结果**：脚本会将提取的 JSON 数据直接注入并替换掉 `index.html` 末尾原先硬编码的假数据。
*   **状态**：已成功运行。目前打开 `index.html`，页面真实呈现了 Wave 1 全部 8 家公司的精准状态。

---

## 三、抓取证据盘点与发现的问题 (Evidence Verification)

在复核上一个版本跑出来的 `evidence-check-2026-05-15.json` 日志时，发现了目前全自动爬虫 (`scripts/capture-evidence.mjs`) 的几项致命缺陷：

1. **链接死链**：华润集团的链接 (`prepsite.crc.com.cn`) 为 404。
2. **遭遇反爬拦截**：OpenAI 因为 Cloudflare 防护，Headless 浏览器请求直接报 403 Forbidden。
3. **截图定位失效**：OPPO, Google, Patagonia 虽然状态码 200，但脚本并未在 DOM 中成功找到预设的 `needle` 文本。导致截图只是页面顶部，无法作为真正的 MVV 证据（假阳性问题）。

**结论**：原爬虫逻辑过于简单，无法作为长期的“确定版本爬虫工具”使用。

---

## 四、下一阶段计划移交 (Next Steps & Implementation Plan)

目前系统底层架构（数据分离+UI展示）已经跑通，接下来的**第一核心要务是重构抓取工具**。

我已经规划好了下一版的实施计划草案，请接手的 AI 按照以下方向推进：

### 目标：开发确定的企业级 MVV 爬虫并执行第一波纠错
1. **废弃老抓取脚本**：重写 `scripts/crawler.mjs`。
2. **改为配置驱动**：不再在 JS 里硬编码公司链接。新脚本应该去读取每家公司 `profile.md` 里的 `official_urls` 和 `language_scope`（根据要求，中国企业爬中文/英文，海外企业仅爬英文）。
3. **模糊查找与高亮截图**：采用更聪明的 DOM 模糊匹配算法绕过隐藏标签，找到目标文本后**注入红框高亮**，随后再截图。确保证据明确可视。
4. **执行 Wave 1 纠错**：新爬虫写好后，立即修复并重跑华润、OPPO、Google、Patagonia 的截图。
5. **半自动兜底策略**：针对 OpenAI 的 403 问题，如新爬虫伪装依旧失败，应采取 Browser Subagent 模拟人类浏览器进行人工/半人工留证。

---
*注：本项目定位为严谨的“研究操作系统”，凡事必须有确凿证据截图支撑。UI 架构已预留了版本迭代能力，未来可进一步开发时间轴组件以展示 `versions/` 目录下的历史演变。*
