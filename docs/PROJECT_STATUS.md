# Project Status

更新日期：2026-05-16

## 当前状态

项目已经完成 Wave 1 的当前 MVV 基线、历史版本锚点、证据资产、SQLite 同步、静态前端展示和 GitHub Pages 发布。

- 线上页面：https://liyi19910501-afk.github.io/mvv-case-library/
- GitHub 仓库：https://github.com/liyi19910501-afk/mvv-case-library
- 当前主分支：`main`
- 当前数据规模：8 家公司、20 条正式版本记录、10 条历史候选来源、105 个证据资产

## 当前工程约定

数据管线：

```text
profile.md + current.json + versions/*.md + candidates/*.md + evidence/*
  -> npm run sync
  -> data/mvv-ui-data.json
  -> data/mvv-ui-data.js
  -> index.html
```

关键约定：

- `data/mvv-ui-data.json` 是机器可读的规范导出。
- `data/mvv-ui-data.js` 是同一份数据的浏览器包装，用于 `file://` 和 GitHub Pages。
- `index.html` 不内嵌公司数据，也不使用 `fetch` 加载数据。
- `data/mvv.sqlite` 是本地派生数据库，不提交到 git。
- 修改数据后运行 `npm run sync && npm run build && npm run audit`。
- CI 会运行脚本语法检查、同步、前端数据加载校验和 strict audit。

## 已解决的关键工程债

- 前端数据从 `index.html` 拆出，避免数据变更污染 HTML diff。
- `build-data.mjs` 不再解析 Markdown 或回写 HTML，只做前端数据加载约束校验。
- 补齐 `package.json` 标准命令和 Node 版本约束。
- GitHub Pages 部署前会重建数据并运行 audit。
- `mvv.sqlite` 已从 git 追踪中移除。
- 本地双击 `index.html` 可直接查看页面。

## 当前待办

1. GitHub 仓库 About 的 Website 字段手动填入 Pages 链接。
2. Wave 2 企业建档：先建当前官方 MVV 基线，再做历史版本发现。
3. 逐步把版本/候选记录的关键字段前移到 frontmatter，减少正文正则解析依赖。
4. 清理各公司 `profile.md` 中可能过时的手写版本索引，避免与 `versions/` 目录重复维护。

