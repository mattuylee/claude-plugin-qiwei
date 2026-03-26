---
name: qiwei-configure
description: Configure WeCom (企业微信) self-built app connection
user-invocable: true
argument-hint: "[clear]"
---

# WeCom Configure

配置企业微信自建应用连接。

## Instructions

如果用户传入 `clear` 参数，删除配置文件：

```bash
rm -f ~/.claude/channels/qiwei/config.json
```

然后告诉用户配置已清除。

否则，通过交互式问答收集以下信息：

1. **corpid** — 企业 ID（在企业微信管理后台 > 我的企业 > 企业信息 中查看）
2. **corpsecret** — 应用的 Secret（在应用管理 > 自建应用详情中查看）
3. **agentid** — 应用的 AgentId（整数，在应用详情中查看）
4. **token** — 接收消息的 Token（在应用 > 接收消息 > API接收 中设置）
5. **encodingAESKey** — 接收消息的 EncodingAESKey（同上位置设置，43 个字符）
6. **port** — 回调监听端口（默认 31098，可选修改）

### 收集完毕后

将信息保存为 JSON 写入 `~/.claude/channels/qiwei/config.json`：

```bash
mkdir -p ~/.claude/channels/qiwei && cat > ~/.claude/channels/qiwei/config.json << 'QWEOF'
{
  "corpid": "<用户输入>",
  "corpsecret": "<用户输入>",
  "agentid": <用户输入的数字>,
  "token": "<用户输入>",
  "encodingAESKey": "<用户输入>",
  "port": <用户输入或默认31098>
}
QWEOF
chmod 600 ~/.claude/channels/qiwei/config.json
```

### 配置完成后

告诉用户：

1. 配置已保存
2. 在企业微信管理后台 > 应用 > 接收消息中，将 URL 设置为指向本机的回调地址（用户自行配置反向代理，插件监听本地端口）
3. 重启 Claude Code 以加载插件：
   ```
   claude --dangerously-load-development-channels plugin:qiwei@claude-plugin-qiwei
   ```

**注意**：不要主动帮用户填入默认值，每个配置项都需要用户确认。port 可以建议默认值 31098。
