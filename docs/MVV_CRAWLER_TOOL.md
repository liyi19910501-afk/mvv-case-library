# MVV Crawler Tool

## 1. 目标

`scripts/mvv-crawler.mjs` 是本项目的后端核心工具，用于把企业官网上的使命、愿景、价值观表述转成可复核、可比较、可长期跟踪的数据。

它的设计目标不是“尽可能多抓网页”，而是：

- 优先抓官方来源。
- 按公司语言规则抓取，中国企业优先中文，海外企业优先英文。
- 把网页文本结构化为 `Mission / Vision / Values`。
- 保存源链接、页面文本、截图和抓取元数据，方便人类复核。
- 与上一版结构化结果比较；无实质变化不新增版本，有变化才写入版本记录。
- 生成简洁的战略与文化解读草稿。

抓取策略是浏览器优先、HTTP fetch 兜底。浏览器模式可以保存截图；fetch 模式可以保存源链接、页面文本和抓取 metadata，但不能生成截图，因此适合在浏览器不可用、CI、其他 AI agent 或受限环境里继续产出可审查线索。

## 2. 精简分类规则

系统只保留两个分类：

| 分类 | 含义 |
| --- | --- |
| `standard_mvv` | 同时抓到 Mission、Vision、Values，或中文对应的使命、愿景、价值观。 |
| `partial_mvv` | 没有完整标准 MVV；抓到什么就填什么，空缺字段保持为空。 |

术语映射保持简单：

| 结构化字段 | 可归入的原始术语 |
| --- | --- |
| `mission` | mission, purpose, belief, our belief, 使命, 企业使命, 宗旨, 信念 |
| `vision` | vision, aspiration, 愿景, 长期愿景 |
| `values` | values, core values, value set, 价值观, 核心价值观 |

如果官网只写了 `purpose` 或 `belief`，就放入 `mission`。不要为了凑齐 MVV 而推断 `vision`。

`principles / 准则 / 行为准则` 容易出现在导航、合规页或 AI 原则页里，自动爬虫不默认把它们当作 Values。只有当 `profile.md` 中已经有明确可验证文本，或人工确认该页面就是公司价值观/原则页时，才归入 `values`。

历史版本、Google / 百度搜索、微信、媒体报道和三方验证不由 current crawler 直接写入正式版本；先使用 `scripts/mvv-history-brief.mjs` 生成历史研究 brief，再按 `docs/MVV_HISTORICAL_DISCOVERY.md` 的规则人工确认。

## 3. 推荐目录

每家公司目录可以逐步演进为：

```text
data/companies/google/
  profile.md
  current.json
  versions/
    2026-05-15-current.md
  evidence/
    2026-05-15/
      mission-about-google.png
      page-text-about-google.txt
      metadata.json
  crawl-logs/
    2026-05-15T08-21-29-347Z.json
```

`profile.md` 给人看，`current.json` 给脚本比较，`versions/` 保存有意义的正式记录，`evidence/` 保存证据，`crawl-logs/` 保存每次运行结果。

## 4. 命令行用法

抓取单家公司并实际写入：

```bash
node scripts/mvv-crawler.mjs --company google --write
```

抓取所有公司并实际写入：

```bash
node scripts/mvv-crawler.mjs --all --write
```

只做 dry run，不写入版本和证据：

```bash
node scripts/mvv-crawler.mjs --company google --dry-run
```

只输出 JSON，方便其他 AI 或脚本调用：

```bash
node scripts/mvv-crawler.mjs --company google --json --dry-run
```

允许无变化时也保存证据：

```bash
node scripts/mvv-crawler.mjs --company google --write --save-unchanged-evidence
```

强制抓取所有官方链接，即使前面的链接已经抓齐标准 MVV：

```bash
node scripts/mvv-crawler.mjs --company anker-innovations --write --all-sources
```

只使用 HTTP fetch，不启动浏览器：

```bash
node scripts/mvv-crawler.mjs --company google --dry-run --json --fetch-only
```

浏览器失败时默认会自动降级到 fetch。如果希望浏览器失败就直接失败：

```bash
node scripts/mvv-crawler.mjs --company google --dry-run --json --no-fetch-fallback
```

## 5. 输出判断

每家公司运行后会得到一个 `change_status`：

| 状态 | 含义 |
| --- | --- |
| `new` | 没有历史 `current.json`，首次建立基线。 |
| `changed` | 结构化 MVV 哈希变化，需要新增版本记录。 |
| `unchanged` | 结构化 MVV 未变化，不新增版本记录。 |
| `failed` | 页面无法抓取或没有得到可用文本。 |

无变化时，工具只记录运行日志；有变化时，工具会写入：

- `current.json`
- `versions/YYYY-MM-DD-current.md` 或 `versions/YYYY-MM-DD-change.md`
- `evidence/YYYY-MM-DD/*`
- `crawl-logs/<ISO-timestamp>.json`

JSON 输出中还会包含便于上游 agent 判断质量的字段：

| 字段 | 含义 |
| --- | --- |
| `browser_available` | 本次运行是否成功启动浏览器。 |
| `browser_launch_error` | 浏览器不可用时的简短错误摘要。 |
| `source_results[].transport` | `browser` 或 `fetch`。 |
| `source_results[].fallback_from` | 例如 `browser_unavailable` 或 `browser_error`。 |
| `source_results[].failure_type` | `network`、`http_status`、`timeout`、`blocked`、`browser`、`empty_text`、`unknown` 等。 |
| `source_results[].failure_reason` | 可读的失败摘要。 |
| `source_results[].score` | 来源质量分，用于排序和复核优先级。 |
| `source_results[].score_signals` | 质量分来源，例如官方 URL、about/culture 路径、文本长度、提取字段数。 |

## 6. Audit 检查

修改爬虫、数据库、前端导出或公司数据后，先跑：

```bash
node scripts/mvv-audit.mjs --json
```

如果要让 CI 或自动化任务在发现 warning 时也失败：

```bash
node scripts/mvv-audit.mjs --strict
```

Audit 会检查：

- 公司 profile、logo、当前快照、版本记录、候选来源和证据文件是否齐全。
- `data/mvv-ui-data.json` 与 SQLite 记录数量是否对齐。
- 前端是否还残留旧标签，例如 `叙事型表达`、`Current Snapshot`。
- 证据文件是否误指向 logo 等非 MVV 页面资产。

## 7. 给其他 AI 的调用约定

其他 AI 不需要理解前端，只需要按以下顺序调用：

1. 确认或更新目标公司的 `profile.md`，尤其是 `official_urls` 与 `language_scope`。
2. 运行：

```bash
node scripts/mvv-crawler.mjs --company <company_id> --write --json
```

3. 读取 JSON 输出中的：
   - `structured`
   - `classification`
   - `change_status`
   - `evidence_assets`
   - `version_file`
   - `analyst_note`
4. 如果 `browser_available` 为 `false` 或某个来源的 `transport` 是 `fetch`，要知道该来源没有浏览器截图；仍可先用页面文本和 metadata 判断，但正式确认前建议补跑浏览器证据。
5. 如果 `review_status` 是 `needs_review`，必须人工复核截图和源链接后再把结论当作确认版本。

## 8. 人工复核原则

爬虫负责发现和记录，不能替代最终研究判断。以下情况必须人工确认：

- 官网出现反爬、等待页、地区跳转或语言跳转。
- 抓到的 MVV 来自招聘页、新闻页、ESG 页等非主 about/culture 页面。
- 页面只出现品牌口号，无法确认是否为正式使命或价值观。
- Values 与 principles / code of conduct 边界不清。
- 中国企业只有英文页可用，或海外企业只有非英文页可用。
