# MVV Historical Discovery And Verification

## 1. 为什么需要第二条线

`scripts/mvv-crawler.mjs` 负责“当前官网监测”，适合稳定地复核 current MVV。

但企业历史版本和三方验证经常出现在这些地方：

- Wayback / archive.today 等网页历史快照。
- 年报、ESG 报告、招股书、投资者关系 PDF。
- 官方公众号、微信文章、微博、视频号、招聘号。
- 新闻稿、媒体采访、咨询文章、招聘平台转述。
- Google / 百度 / 搜狗微信搜索结果中的旧文案线索。

这些来源访问方式不稳定，不能简单地混入自动爬虫。项目应把它们放进“历史发现与证据验证”流程：先进入候选池，经人工确认后才写入正式版本。

## 2. 两条流水线

### A. Current Monitor

用途：定期确认当前官网是否变更。

工具：`scripts/mvv-crawler.mjs`

输出：

- `current.json`
- `versions/YYYY-MM-DD-current.md` 或 `versions/YYYY-MM-DD-change.md`
- `evidence/YYYY-MM-DD/*`
- `crawl-logs/<ISO-timestamp>.json`

规则：无变化只写 crawl log，有变化才新增 version。

### B. Historical Discovery

用途：补企业成立以来的历史 MVV 版本和三方验证。

工具：`scripts/mvv-history-brief.mjs`

输出：

- `research-briefs/YYYY-MM-DD-history-research.md`
- 待人工填入的候选来源、截图、文字摘录和可信度判断。

规则：搜索结果、微信文章、媒体转述只能先做候选；只有证据充分时才转成 `versions/` 正式记录。

## 3. 来源等级

| 等级 | 来源 | 用途 |
| --- | --- | --- |
| A | 官网当前页、官网历史快照、年报、ESG、招股书、官方品牌手册、官方招聘官网 | 可作为正式版本主来源。 |
| B | 官方公众号、官方微博/视频号、CEO/创始人官方公开信、官方新闻稿 | 可作为正式版本主来源或强验证。 |
| C | 主流媒体采访、招聘平台、咨询文章、PR Wire、行业报告 | 只能作为辅助验证或历史线索。 |
| D | 搜索结果摘要、百科、论坛、二手整理、无法访问原文的转载 | 只做线索，不直接入正式版本。 |

## 4. 三方验证规则

1. 如果有 A 级来源，一条 A 级来源加截图/快照即可进入正式版本。
2. 如果只有 B 级来源，可以进入正式版本，但 `review_status` 应保持 `reviewed`，重要结论建议再找一个辅助来源。
3. 如果只有 C 级来源，至少需要两个相互独立来源，并标记 `confidence_level: medium` 或 `low`。
4. D 级来源不能单独进入正式版本，只能写入 research brief 的线索区。
5. 搜索结果摘要只能帮助发现关键词和年份，不能作为 MVV 原文证据。

## 5. 历史版本回溯方法

按这个顺序做，效率最高：

1. 建 current baseline：先确认当前官网版本。
2. 从官方 PDF 往回找：年报、ESG、招股书、招聘手册、品牌手册。
3. 查网页快照：Wayback / archive.today，用官网 about/culture/values URL 回溯。
4. 查官方社媒：中国企业重点查微信公众号、招聘公众号、官方新闻稿。
5. 查搜索引擎：Google / 百度 / 搜狗微信，用年份和术语组合搜索。
6. 查三方验证：主流媒体、PR Wire、招聘平台、咨询文章。
7. 建版本窗口：只在 MVV 表述发生结构或语义变化时新增版本。

## 6. 微信和国内渠道处理

微信、公众号和国内媒介通常无法稳定 headless 抓取，推荐半自动流程：

1. 用 `scripts/mvv-history-brief.mjs --company <id> --write` 生成查询语句。
2. 在浏览器里打开微信搜索、搜狗微信、百度或公众号文章。
3. 保存证据：
   - 页面截图。
   - 文章标题。
   - 公众号名称。
   - 发布时间。
   - 原始链接，优先 `mp.weixin.qq.com`。
   - 可见正文文本摘录。
4. 如果是官方公众号，来源等级记为 B。
5. 如果是媒体或转载，来源等级记为 C 或 D。
6. 转成正式版本前，尽量用官网、年报、招聘官网或其他官方材料交叉确认。

## 7. 候选来源登记模板

候选来源文件放在：

```text
data/companies/<company_id>/candidates/<candidate_id>.md
```

```yaml
candidate_id:
company_id:
found_at:
source_level: A/B/C/D
source_type: official_archive / annual_report / wechat / media / search_snippet / job_site / other
source_title:
source_url:
source_org:
published_date:
language:
raw_mission:
raw_vision:
raw_values:
raw_other_terms:
evidence_assets:
  - 
verification_note:
recommended_action: ignore / needs_more_sources / create_version
```

## 8. 转成正式版本的标准

只有满足以下条件，才从 candidate 转成 `versions/*.md`：

- 能看到原文，不只是搜索摘要。
- 有明确来源机构和发布日期或抓取日期。
- 能区分这是公司正式表述、品牌口号、招聘文化宣传，还是媒体转述。
- 至少保存一个证据文件：截图、PDF、页面文本或网页快照。
- 能说明与上一版本相比是否是实质变化。
