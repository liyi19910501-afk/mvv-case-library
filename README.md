# MVV Case Library

企业 Mission / Vision / Values 的官方表述、历史版本、证据截图和来源链接索引。

## 本地查看

```bash
python3 -m http.server 8765
```

然后打开：

```text
http://127.0.0.1:8765/index.html
```

## 数据同步

修改公司档案、版本记录或证据后，运行：

```bash
npm run sync
npm run build
npm run audit
```

## 核心目录

- `index.html`: 静态前端入口。
- `data/companies/`: 公司档案、当前快照、历史版本、候选来源和证据资产。
- `data/mvv-ui-data.json`: 前端静态数据导出。
- `data/mvv.sqlite`: 本地生成的结构化数据库快照，不提交到 git。
- `scripts/`: 爬虫、历史 brief、数据库同步和审计脚本。
- `docs/`: 数据规则、爬虫规则和研究流程文档。

## GitHub Pages

仓库推送到 GitHub 后，`main` 分支会先运行数据重建和 audit，再通过 `.github/workflows/pages.yml` 自动发布静态页面。发布地址通常是：

```text
https://<github-user>.github.io/<repo-name>/
```
