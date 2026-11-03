# kv-clipboard

基于 [kv-cache](https://github.com/RavelloH/kv-cache) 的在线剪切板前端。

## Cloudflare Workers 部署

项目是纯静态前端，不需要后端 Worker。原项目使用 `404.html` 处理任意剪切板地址（例如 `/abcd`）；构建脚本将其复制为 `dist/index.html`，再由 Cloudflare Static Assets 的 SPA 回退为这些地址返回页面。

在 Cloudflare Workers 的 Git 构建配置中填写：

- **Root directory**：`/`
- **Build command**：`npm run build`
- **Deploy command**：`npx wrangler deploy`
- **Production branch**：`main`

Wrangler 的 `wrangler.jsonc` 已配置 Worker 名称、`./dist` 资源目录与 `single-page-application` 回退。不要把整个仓库目录直接用作静态资产目录。

本地构建与部署：

```sh
npm ci --include=dev
npm run build
npm run deploy
```

要本地预览 Workers 静态资源路由，可先运行 `npm run build`，然后执行 `npx wrangler dev`。前端数据读写仍访问现有的 kv-cache API，不会迁移存储。
