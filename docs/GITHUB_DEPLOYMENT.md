# GitHub Versioning And Temporary Public Link

## 1. 推荐方式

这个项目是静态页面加本地数据文件，适合用 GitHub 仓库做版本管理，并用 GitHub Pages 生成临时公开访问链接。

推荐流程：

1. 本地初始化 git 仓库。
2. 创建 GitHub 远程仓库。
3. 推送 `main` 分支。
4. 在 GitHub 仓库中启用 Pages，来源选择 GitHub Actions。
5. 等待 `.github/workflows/pages.yml` 发布完成。

## 2. 本地命令

```bash
git init
git branch -M main
git add .
git commit -m "Initial MVV case library"
```

创建远程仓库后：

```bash
git remote add origin git@github.com:<github-user>/<repo-name>.git
git push -u origin main
```

如果使用 HTTPS：

```bash
git remote add origin https://github.com/<github-user>/<repo-name>.git
git push -u origin main
```

## 3. 临时访问链接

GitHub Pages 发布成功后，访问链接通常是：

```text
https://<github-user>.github.io/<repo-name>/
```

如果仓库名是 `mvv-case-library`，用户是 `example`，则链接是：

```text
https://example.github.io/mvv-case-library/
```

## 4. 发布前检查

每次推送前建议运行：

```bash
node scripts/mvv-db-sync.mjs --rebuild --json
node scripts/build-data.mjs
node scripts/mvv-audit.mjs --json
```

当前 GitHub Pages 发布的是静态文件；SQLite 数据库不会在页面里执行，但会作为可下载的数据快照保存在仓库中。

