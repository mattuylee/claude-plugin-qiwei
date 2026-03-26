# claude-plugin-qiwei

WeCom (企业微信) channel plugin for Claude Code.

通过企业微信自建应用，将企微消息桥接到 Claude Code 会话中。你可以在企微里直接和 Claude Code 对话。

## Features

- 接收企微消息：文本、图片、语音、视频、文件、位置
- 发送回复：文本 + 图片/文件附件
- 消息加解密：AES-256-CBC，符合企微规范
- access_token 自动缓存和刷新
- 访问控制：配对码 + 白名单机制

## Prerequisites

- [Claude Code](https://claude.ai/code) v2.1.80+
- [Bun](https://bun.sh/) runtime
- 企业微信管理员权限（创建自建应用）
- 一个可被企微服务器访问的回调地址（公网 IP / 反向代理 / 内网穿透）

## Installation

**1. 添加 marketplace 并安装插件**

在 Claude Code 中运行：

```
/plugin marketplace add mattuylee/claude-plugin-qiwei
/plugin install qiwei@claude-plugin-qiwei
```

**2. 创建企微自建应用**

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)
2. 进入 **应用管理** → **自建** → **创建应用**
3. 记录 `AgentId` 和 `Secret`
4. 在 **我的企业** → **企业信息** 中记录 `CorpID`
5. 在应用的 **接收消息** → **API 接收** 中设置：
   - **URL**：你的回调地址（如 `https://your-domain.com/callback`）
   - **Token**：自定义字符串（记住它）
   - **EncodingAESKey**：随机生成（记住它）

**3. 配置插件**

在 Claude Code 中运行 `/qiwei:configure`，按提示填入：

| 配置项 | 说明 |
|-------|------|
| `corpid` | 企业 ID |
| `corpsecret` | 应用 Secret |
| `agentid` | 应用 AgentId |
| `token` | 接收消息的 Token |
| `encodingAESKey` | 接收消息的 EncodingAESKey（43 位） |
| `port` | 本地监听端口（默认 31098） |

**4. 配置回调地址**

插件监听本地端口（默认 `31098`），你需要通过反向代理将企微的回调请求转发到该端口。

Nginx 示例：

```nginx
location /callback {
    proxy_pass http://127.0.0.1:31098/callback;
}
```

**5. 启动**

```bash
claude --dangerously-load-development-channels plugin:qiwei@claude-plugin-qiwei
```

## Usage

### 发消息

在企微中给自建应用发消息，消息会自动推送到 Claude Code 会话。

### 访问控制

首次有用户发消息时，插件会发送一个 6 位配对码给该用户。在 Claude Code 终端中确认：

```
/qiwei:access pair 123456
```

其他命令：

```
/qiwei:access allow <userId>     # 手动添加用户到白名单
/qiwei:access remove <userId>    # 移除用户
/qiwei:access policy <mode>      # 设置策略：pairing / allowlist / disabled
/qiwei:access status             # 查看当前配置
```

### 清除配置

```
/qiwei:configure clear
```

## Configuration

配置文件存储在 `~/.claude/channels/qiwei/config.json`（权限 600）。

端口可通过以下方式配置（优先级从高到低）：
1. config.json 中的 `port` 字段
2. 环境变量 `QIWEI_PORT`
3. 默认值 `31098`

## Known Limitations

- 企微文本消息限制 2048 字节，超长消息暂未做分段
- 临时素材有效期 3 天，过期后无法下载
- 语音识别需在企微后台开启，否则只能获取 media_id

详见 [ISSUES.md](plugins/qiwei/ISSUES.md)。

## License

MIT
