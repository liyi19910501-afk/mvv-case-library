# MVV 个人研究档案库蓝图

## 1. 项目定位

### 当前阶段定位
- 这是一个以你个人长期研究为核心的 `MVV` 档案库，而不是一个先追求公开传播的网站。
- 它的首要目标不是“覆盖尽可能多的公司”，而是“持续、可信、可追溯地记录重点公司的使命、愿景、价值观及其演化”。
- 任何未来的公开产品，都应建立在这套个人研究档案和数据标准之上。

### 这一阶段要解决的问题
- 把你已经在手工做的 `公司 + 日期 + 来源 + 截图 + 变化判断` 变成稳定方法。
- 让每一次新增或更新记录都有统一格式，后续可以复用、比较、筛选。
- 降低你为了查找历史表述、回看旧版本、整理项目样本所花的重复劳动。

### 不急着解决的问题
- 不急着做成完整网站。
- 不急着追求全自动抓取与全自动判断。
- 不急着覆盖大而全的行业和公司库。

## 2. 北极星与成功标准

### 北极星
建立一个你愿意长期使用的 `MVV 研究操作系统`。

### 第一阶段成功标准
- 你可以快速查看任意重点公司的当前 `MVV` 表述。
- 你可以清楚看到某家公司历史上发生过哪些表达变化。
- 你能追溯每一条判断背后的来源和证据。
- 你能把公司分成“长期观察池”和“项目临时池”来管理。
- 新增一家公司档案的时间被压缩到可接受范围。

## 3. 研究原则

### 来源原则
1. 官方来源优先。
2. 辅助来源用于补史、佐证和交叉验证。
3. 无法确认的历史信息必须明确标注不确定性。

### 判断原则
1. 页面改版不等于 `MVV` 改版。
2. 文案微调不一定代表战略变化。
3. 只有当语义、结构或对外正式表述发生显著变化时，才标记为有效版本更新。

### 记录原则
1. 每条记录都尽量保留日期、链接、摘录、截图或快照信息。
2. 每次记录都区分“原始文本事实”和“你的分析判断”。
3. 研究结论应可回看、可复核、可反驳。

## 4. 范围设计

### A. 长期观察池
长期观察池是你的主库，建议第一批控制在 `30-60` 家。

#### 推荐筛选规则
- 全球范围内品牌层面极其成功的大中型企业。
- 顶级消费品、零售、生活方式品牌。
- 明显以使命、文化、价值观驱动著称的企业。
- 中国市场具有代表性的消费品牌、AI 公司、服务型企业。

#### 推荐子类
- 全球品牌标杆
- 全球顶级消费品与零售
- 中国消费品牌
- 中国 AI 与科技
- 中国服务与文化驱动型企业

### B. 项目临时池
项目临时池用于短期专题研究。

#### 特点
- 进入和退出都应灵活。
- 可以围绕某个行业、咨询项目、品牌分析、内容选题临时建立。
- 不要求长期维护频率与深度与主库相同。

## 5. 第一批公司池建议

以下不是最终名单，而是建议的起步方向。目标是先建立一个“够代表性、又不至于太大”的样本池。

### 品牌使命与文化标杆
- Nike
- IKEA
- Patagonia
- Starbucks
- Google

### 消费品与零售
- P&G
- Unilever
- L'Oreal
- Danone
- Coca-Cola

### 消费科技与电子品牌
- Apple
- 安克创新
- 华为
- 小米
- OPPO
- vivo

### AI 品牌
- OpenAI
- Anthropic
- DeepSeek
- 通义千问

### 互联网科技平台
- 阿里巴巴
- 腾讯
- 字节跳动

### 服务与文化驱动型企业
- 华润集团
- 海底捞
- 华住

### 起步建议
- 第一轮不要超过 `40` 家。
- 其中 `20-25` 家进入高优先级深度档案。
- 剩余公司先建立轻量档案，后续逐步补全。

### 建议先深挖的 P1 样本池
如果你希望先做出一版“代表性强、又能尽快看出方法价值”的样本，建议优先从以下对象开始：

- Nike
- IKEA
- Patagonia
- Google
- OpenAI
- P&G
- Unilever
- Danone
- 安克创新
- 华为
- OPPO
- vivo
- 阿里巴巴
- 腾讯
- 华润集团
- 海底捞

## 6. 数据结构设计

### 6.1 公司档案层
每家公司应有一个主档案页，用于汇总长期稳定信息。

#### 必备字段
- `company_id`: 稳定唯一标识，建议英文 slug。
- `company_name_cn`
- `company_name_en`
- `country_or_region`
- `industry_primary`
- `industry_secondary`
- `pool_type`: `core` 或 `project`
- `status`: `active` / `paused`
- `official_urls`
- `priority_level`: `P1` / `P2` / `P3`
- `tracking_start_date`
- `current_mission`
- `current_vision`
- `current_values`
- `related_terms`: 如 `purpose`、`beliefs`、`principles`
- `source_policy_note`
- `research_notes`
- `last_reviewed_at`

#### 推荐附加字段
- `brand_positioning_note`
- `why_track`
- `competitor_group`
- `language_scope`
- `confidence_overview`

### 6.2 版本记录层
每次发现新表述、旧表述、重要佐证或疑似变更时，新增一条版本记录。

#### 必备字段
- `record_id`
- `company_id`
- `record_date`
- `captured_at`
- `effective_period_guess`
- `source_type`
- `source_title`
- `source_url`
- `source_org`
- `language`
- `raw_mission`
- `raw_vision`
- `raw_values`
- `raw_other_terms`
- `normalized_mission`
- `normalized_vision`
- `normalized_values`
- `change_type`
- `change_summary`
- `evidence_assets`
- `confidence_level`
- `review_status`
- `analyst_note`

#### 字段说明
- `record_date`: 这条记录所对应的页面或材料日期。
- `captured_at`: 你实际抓取/录入的日期。
- `effective_period_guess`: 如果是历史记录，可写大致生效期，如 `2021-2023?`。
- `change_type`: 建议枚举为 `new`、`update`、`rewording`、`removed`、`uncertain`。
- `confidence_level`: 建议枚举为 `high`、`medium`、`low`。
- `review_status`: 建议枚举为 `raw`、`reviewed`、`confirmed`。

## 7. 术语映射规则

不是所有公司都会标准地写 `Mission / Vision / Values`，因此需要映射层。

### 可直接归入 Mission 的常见表述
- mission
- purpose
- our purpose
- 企业使命
- 公司使命

### 可直接归入 Vision 的常见表述
- vision
- aspiration
- 愿景
- 长期愿景

### 可直接归入 Values 的常见表述
- values
- core values
- principles
- beliefs
- value set
- 价值观
- 核心价值观
- 行为准则

### 需要单独保留、暂不强行并入的表述
- business idea
- brand promise
- culture code
- leadership principles
- purpose statement 周边的补充说明

### 建议策略
- 保留原词，不要为了统一而过度改写。
- 一条记录里可以同时存在“原始术语”和“归类后的结构化字段”。

## 8. 来源分级

### A 级：强官方
- 官网 about / culture / values 页面
- 年报、ESG 报告、品牌手册、招聘官网
- 创始人或 CEO 在官网正式发布的公开信

### B 级：弱官方
- 官方公众号文章
- 官方视频、采访、演讲实录
- 官方招聘宣传物料

### C 级：辅助验证
- 主流媒体采访
- 咨询文章引用
- 第三方转述页面
- 论坛、百科、二手整理

### 使用规则
- 当前正式版本尽量只以 A 级和部分 B 级来源确认为准。
- 历史追溯可以用 C 级线索，但要尽量补回更高等级来源。

## 9. 文件组织建议

建议先用 `Markdown + 资源文件夹`，保持足够简单。

```text
docs/
  MVV个人研究档案库蓝图.md

templates/
  company-profile-template.md
  version-record-template.md

data/
  companies/
    nike/
      profile.md
      versions/
        2020-12-15.md
        2025-03-11.md
      assets/
    ikea/
      profile.md
      versions/
      assets/
  projects/
    2026-q2-consumer-brand-study/
      README.md
```

## 10. 工作流建议

### 新增公司
1. 创建公司主档案。
2. 填写基本信息与跟踪原因。
3. 补 1 条当前版本记录。
4. 如有明确历史信息，再补 1-3 条关键历史版本。

### 更新公司
1. 抓取当前官方页面。
2. 与上一版本比对。
3. 若无实质变化，只更新复核日期。
4. 若有疑似变化，新增版本记录并附证据。

### 历史回溯
1. 先找强官方历史材料。
2. 再用辅助来源补线索。
3. 无法完全确认时，记录为 `uncertain`。

## 11. 第一阶段 MVP

第一阶段先解决“你自己长期用得顺”。

### MVP 功能
- 公司档案创建
- 版本记录模板化
- 来源分级
- 当前版本汇总
- 历史版本时间线
- 变更摘要
- 项目池与长期池分类

### 暂不做
- 自动全网抓取
- 自动判定真实战略变化
- 公开前台网站
- 实时消息通知

## 12. 后续演进路线

### Phase 1
手工为主，模板化整理，建立标准。

### Phase 2
加入半自动采集：
- 自动拉取网页正文
- 自动保存页面快照
- 自动文本 diff
- 自动生成版本草稿

### Phase 3
加入分析视图：
- 按行业对比
- 按年份查看
- 查看某类价值观高频词
- 识别显著改写事件

### Phase 4
如果未来产品化，再做公开站：
- 公司页面
- 时间轴
- 更新提醒
- 专题简报
- 企业横向对比

## 13. 当前最重要的下一步

不要先决定技术栈，先把以下三件事定清楚：

1. 第一批 `30-40` 家公司名单。
2. 公司档案模板是否够用。
3. 版本记录模板是否能覆盖你现有资料。

当这三件事稳定以后，再决定是否做脚本、数据库或网站，成本会低很多。
