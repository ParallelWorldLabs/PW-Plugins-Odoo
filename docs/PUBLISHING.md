# 发布 PW-Plugins-Odoo

0.5.2 是首个公开发行候选版本，采用 MIT 许可，版权署名 ParallelWorldLabs。公开源码仓库为 [ParallelWorldLabs/PW-Plugins-Odoo](https://github.com/ParallelWorldLabs/PW-Plugins-Odoo)。插件目录作为独立仓库根目录发布。

公开包名为 `pw-plugins-odoo`，DSH 兼容声明为已验收的 `0.2.2-rc.1`。发行包包含预构建 Host、Client、MCP 和 Typert 契约。连接、API Key 与测试数据均由用户在本地配置。

## 构建并检查发行包

使用 Node 24 环境，在本仓库根目录运行：

```sh
npm ci
npm test
mkdir -p artifacts
npm pack --pack-destination artifacts
```

用独立 DSH profile 安装打出的 tgz，验证插件启动、设置、公司范围及 CRM。具备本地 Odoo 19/20 配置时可运行 `npm run test:matrix`、`npm run test:frontend` 和 `npm run test:settings`。归档验收完成后，使用同一份 tgz 发布。确认包内包含 LICENSE、图标、locale、dist、生成的 Typert 文件和 `cordis.patch.yml`，并检查本机凭据和测试数据库未被打包。

## 发布到 npm

用发布账号在本机进行网页登录，并完成 npm 要求的双重验证：

```sh
npm login --registry=https://registry.npmjs.org --auth-type=web
npm whoami --registry=https://registry.npmjs.org
npm publish ./artifacts/pw-plugins-odoo-0.5.2.tgz --access public --registry=https://registry.npmjs.org
```

验证仓库返回的版本与验收归档一致。npm 账号和令牌只在本机配置。公开发布需要包写权限，并受 npm 双重验证策略约束。见 [npm 发布要求](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)。

## 上线插件索引

npm 公开版本可下载后运行：

```sh
npm run release:site -- ./artifacts/pw-plugins-odoo-0.5.2.tgz
```

脚本核对注册表中的归档完整性和精确版本，使用 DSH 官方校验器生成 `artifacts/release-site`。将该目录发布到独立公开仓库的 `gh-pages` 分支根目录，并启用 GitHub Pages。上线后确认 `index.json` 直接返回成功状态，再从独立 DSH profile 测试发现和安装。

用户在 DSH 启用实验性“自定义插件索引”，进入“发现 → 添加索引源”，填写已上线的索引地址 `https://parallelworldlabs.github.io/PW-Plugins-Odoo/index.json`。索引源保存在当前 profile。见 [DSH 插件索引说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md)。
