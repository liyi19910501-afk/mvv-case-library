# MVV Database

## 1. 定位

本项目采用“双层数据”：

- Markdown / JSON / 截图：人类可读、可复核的研究档案。
- SQLite：给脚本、其他 AI、前端导出和后续自动化使用的结构化索引。

SQLite 不替代原始证据。任何结论都必须能回到版本记录、截图、页面文本或 PDF。

## 2. 文件

```text
data/mvv.sqlite
data/mvv-ui-data.json
```

`data/mvv.sqlite` 是结构化数据库。

`data/mvv-ui-data.json` 是前端静态页面可读取/注入的数据导出。

公司 logo 仍保存在各公司目录下，例如：

```text
data/companies/<company_id>/assets/logo.svg
```

`profile.md` 中的 `logo_asset`、`logo_source_url` 和 `logo_note` 会同步进入 SQLite 与前端导出。logo 是展示资产，不作为 MVV 证据来源。

## 3. 同步命令

```bash
node scripts/mvv-db-sync.mjs --rebuild
```

同步完成后再更新前端：

```bash
node scripts/build-data.mjs
```

完成同步后建议跑一次全量检查：

```bash
node scripts/mvv-audit.mjs --json
```

## 4. 核心表

| 表 | 含义 |
| --- | --- |
| `companies` | 公司基本信息与追踪状态。 |
| `current_snapshots` | 当前结构化 MVV。 |
| `version_records` | 正式版本记录，含来源等级、审核状态、解读。 |
| `evidence_assets` | 截图、页面文本、metadata、PDF 等证据文件。 |
| `crawl_logs` | 每次自动抓取日志。 |
| `research_briefs` | 历史回溯 brief。 |
| `source_candidates` | 后续历史发现候选来源，默认先不进入正式版本。 |

## 5. 历史补全原则

历史 MVV 不直接写进 `current_snapshots`。流程是：

1. 生成 research brief。
2. 搜索官网历史快照、PDF、微信、媒体和招聘渠道。
3. 把线索登记为 `source_candidates`。
4. 人工确认后创建 `versions/*.md`。
5. 重新运行 `mvv-db-sync`，正式版本进入 `version_records`。

候选来源文件位置：

```text
data/companies/<company_id>/candidates/*.md
```
