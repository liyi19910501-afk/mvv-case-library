# Wave 1 Historical MVV Status

生成日期：2026-05-16

## 总览

Wave 1 当前包含 8 家公司。全部公司均已建立当前 MVV 基线，并至少拥有 1 条正式历史版本记录。当前数据库同步后共有：

- 公司：8
- 当前快照：8
- 正式版本记录：20
- 历史候选来源：10
- 证据资产：105

## 公司状态

| 公司 | 当前状态 | 已入库历史锚点 | 仍建议补强 |
| --- | --- | --- | --- |
| 安克创新 | 标准 MVV | 2024 年年度报告披露使命、愿景、价值观升级。 | 继续回溯 2011-2023 年官网、招股书和招聘文化材料，确认升级前是否已有稳定表述。 |
| 华润集团 | 标准 MVV | 2016 年企业文化体系官方页面。 | 补 2000 年前后集团重组时期材料，以及微信公众号/官网历史快照交叉验证。 |
| Google | 非标准 MVV | 1998 创始 mission；2026 current mission。 | 用 Wayback 或早期官方页面补强 1998 原始网页证据；Values 可能长期不以标准 MVV 形式存在。 |
| IKEA | 非标准 MVV | 1976 创始愿景。 | 补 `The Testament of a Furniture Dealer` 可访问 PDF 或官方文本，确认早期 values/principles 的原文边界。 |
| Nike | 非标准 MVV | 2021 Form 10-K mission。 | 继续回溯 1990s-2010s 年报、品牌手册和招聘文化页，确认 mission 是否换词。 |
| OpenAI | 非标准 MVV | 2015 founding goal；2018 Charter mission；当前 About mission。 | 补 2023-2025 charter / mission wording 的公开过渡材料，尤其是 governance 事件后的表述变化。 |
| OPPO | 非标准 MVV | 2020 INNO DAY 品牌使命。 | 补中文官网、招聘官网和官方公众号对“本分 / 用户导向 / 创造热情”的历史表达。 |
| Patagonia | 非标准 MVV | 2018 mission change；2022 core values update；当前 mission/core values。 | 补 1991 mission statement 与更早企业文化材料，形成环保使命变化链条。 |

## 判断

Wave 1 已达到“可在前端展示、可追溯证据、可继续版本管理”的阶段。下一步不是再扩 UI，而是继续增强历史链条的覆盖深度：

1. 对每家公司补 1-2 个更早的高价值历史锚点。
2. 优先找 A/B 级官方来源，C 级来源只做交叉验证。
3. 每次新增正式版本后运行数据库同步和 audit。

