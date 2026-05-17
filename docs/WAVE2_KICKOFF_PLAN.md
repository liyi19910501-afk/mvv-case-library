# Wave 2 Kickoff Plan

更新日期：2026-05-16

## 目标

Wave 2 的目标不是单纯增加公司数量，而是补齐横向比较维度：

- 中西企业 MVV 表达差异
- 消费品牌与科技平台的文化叙事差异
- 全球品牌与中国本土品牌的使命/愿景/价值观结构差异
- 标准 MVV 与非标准 purpose / belief / principles 表达的可比性

## Wave 2 公司池

| 优先级 | 公司 | 中文名 | 主要对照价值 | 语言优先级 |
| --- | --- | --- | --- | --- |
| P0 | Starbucks | 星巴克 | 服务文化、员工伙伴叙事、品牌体验 | en |
| P0 | Huawei | 华为 | 中国科技组织文化、长期主义、奋斗者叙事 | zh |
| P0 | Xiaomi | 小米 | 中国消费科技品牌、使命/愿景较稳定 | zh |
| P0 | Alibaba | 阿里巴巴 | 平台型企业价值观和组织文化版本变化 | zh |
| P0 | Tencent | 腾讯 | 平台科技企业 mission / vision / values 对照 | zh |
| P1 | P&G | 宝洁 | 全球消费品公司 purpose / values 标杆 | en |
| P1 | Unilever | 联合利华 | 可持续发展、purpose-led business 对照 | en |
| P1 | vivo | vivo | 与 OPPO / 小米形成中国手机品牌对照 | zh |
| P1 | Anta | 安踏 | 与 Nike 形成运动品牌文化对照 | zh |
| P1 | Pop Mart | 泡泡玛特 | 潮玩、新消费、IP 文化企业表达 | zh |
| P2 | PDD | 拼多多 | 中国电商平台表达，可能来源分散，需谨慎 | zh |

## 建档顺序

建议分三小批推进：

1. **Wave 2A：高确定性基线**
   - Starbucks
   - Huawei
   - Xiaomi
   - Alibaba
   - Tencent

2. **Wave 2B：全球消费品对照**
   - P&G
   - Unilever
   - Anta
   - vivo

3. **Wave 2C：高噪声或新消费样本**
   - Pop Mart
   - PDD

## 每家公司进入主库的最低标准

进入前端展示前，每家公司至少需要：

- `profile.md`
- `current.json`
- 当前官方来源 URL
- 当前官方页面截图或 PDF/页面文本证据
- `versions/YYYY-MM-DD-current.md`
- `research-briefs/YYYY-MM-DD-history-research.md`
- 至少一条历史候选或明确说明“暂未发现高可信历史版本”

如果当前官网抓不到完整标准 MVV：

- 有 mission / purpose / belief 就填 `mission`
- 有 vision / aspiration 就填 `vision`
- 有 values / core values 就填 `values`
- 不为了凑齐 MVV 做推断

## 推荐工作流

对每家公司执行：

```bash
node scripts/mvv-history-brief.mjs --company <company_id> --write
node scripts/mvv-crawler.mjs --company <company_id> --write --json
npm run sync
npm run build
npm run audit
```

当前环境如浏览器或网络受限，可先人工补 `profile.md` 与候选来源，再在可用浏览器环境中补证据截图。

## 风险点

- 中国企业官网可能存在多套口径：集团官网、招聘官网、ESG 报告、公众号口径不完全一致。
- 全球企业常使用 `purpose` 而非 `mission`，要按本项目规则归入 `mission`，不要强行补 `vision`。
- PDD 和部分新消费企业可能没有稳定、标准的 MVV 页面，需要更多三方验证。
- Wave 2 开始公司数量增加，必须坚持每次新增后跑 audit，避免证据资产和前端导出脱节。

