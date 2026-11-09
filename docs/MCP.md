# 在 Codex 和 Hermes 中使用 Odoo MCP

通用 MCP 服务提供七个只读工具，可查询 CRM、销售、采购、库存和采购来源。连接设置页和页面联动由 DeepSeek Harness 工作台提供。独立 MCP 使用自己的本地配置。

将发行包解压到固定位置，并安装 Node.js 20.19 或更新版本。复制包内的 `.env.example` 到本机私有文件，例如 `/absolute/path/odoo.env`，按示例填写 Odoo 地址、数据库、API Key 和授权公司 ID。将文件权限设为 0600。Odoo 和 MCP 进程需能互相访问。本机 `localhost` 地址适用于同一台机器上的进程。

## Codex

在桌面应用的 MCP 服务器设置中添加 STDIO 服务，命令为 `node`。传入两个参数 `--env-file=/absolute/path/odoo.env` 和 `/absolute/path/package/dist/mcp/stdio.js`。如果桌面应用找不到 `node`，填写 Node 的绝对路径。

CLI 的等效配置为：

```sh
codex mcp add pw-odoo -- node --env-file=/absolute/path/odoo.env /absolute/path/package/dist/mcp/stdio.js
```

保存后重启客户端，在 `/mcp` 中检查服务。见 [OpenAI 官方 MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。

## Hermes Agent

将下面的服务器条目合并到 `~/.hermes/config.yaml` 的 `mcp_servers` 中：

```yaml
mcp_servers:
  pw-odoo:
    command: node
    args:
      - --env-file=/absolute/path/odoo.env
      - /absolute/path/package/dist/mcp/stdio.js
```

重启 Hermes 或使用 `/reload-mcp`。见 [Hermes MCP 文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)。

先调用 `pw_odoo_status` 检查实际数据库与公司范围，再查询 CRM。发行包使用标准 MCP SDK 验证握手、工具列表及调用，实际客户端可用性还取决于本机配置与客户端版本。
