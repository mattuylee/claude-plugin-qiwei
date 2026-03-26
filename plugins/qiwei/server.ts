#!/usr/bin/env bun
/**
 * 企业微信 Channel MCP Server for Claude Code
 *
 * 通过企微自建应用的回调接口接收消息，桥接到 Claude Code 会话。
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { existsSync } from "node:fs";

import { loadConfig } from "./src/accounts.js";
import { startCallbackServer } from "./src/callback.js";
import { isAllowed, addPendingPairing } from "./src/pairing.js";
import { sendTextMessage, sendImageMessage, sendFileMessage } from "./src/send.js";
import { uploadMedia, downloadMedia } from "./src/media.js";
import type { DecryptedMessage } from "./src/types.js";

const server = new Server(
  { name: "qiwei", version: "0.1.0" },
  {
    capabilities: {
      experimental: { "claude/channel": {} },
      tools: {},
    },
    instructions: `Messages from WeCom arrive as <channel source="plugin:qiwei" chat_id="..." sender_id="..." message_id="...">.
Reply using the reply tool, passing the chat_id back.
You can attach files using the files parameter (absolute paths only).
Text messages are sent as plain text (not markdown).`,
  },
);

// --- Tools ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "reply",
      description: "Reply to a WeCom message. Pass the chat_id from the channel tag.",
      inputSchema: {
        type: "object" as const,
        properties: {
          chat_id: {
            type: "string",
            description: "The chat_id (user ID) from the channel notification",
          },
          text: { type: "string", description: "The reply text (sent as plain text)" },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Optional absolute file paths to attach (images/files)",
          },
        },
        required: ["chat_id", "text"],
      },
    },
    {
      name: "download_attachment",
      description: "Download a WeCom temporary media file by media_id to local disk.",
      inputSchema: {
        type: "object" as const,
        properties: {
          media_id: {
            type: "string",
            description: "The media_id from the incoming message",
          },
        },
        required: ["media_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const config = loadConfig();
  if (!config) {
    return {
      content: [{ type: "text", text: "WeCom not configured. Run /qiwei:configure first." }],
      isError: true,
    };
  }

  switch (name) {
    case "reply": {
      const chatId = args?.chat_id as string;
      const text = args?.text as string;
      const files = args?.files as string[] | undefined;

      if (!chatId || !text) {
        return {
          content: [{ type: "text", text: "Missing chat_id or text parameter." }],
          isError: true,
        };
      }

      try {
        // 发送文本消息
        await sendTextMessage(config.corpid, config.corpsecret, config.agentid, chatId, text);

        // 发送附件
        if (files && files.length > 0) {
          for (const filePath of files) {
            if (!existsSync(filePath)) {
              return {
                content: [{ type: "text", text: `File not found: ${filePath}` }],
                isError: true,
              };
            }

            // 上传素材并发送
            const ext = filePath.split(".").pop()?.toLowerCase() || "";
            const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];
            const mediaId = await uploadMedia(config.corpid, config.corpsecret, filePath);

            if (imageExts.includes(ext)) {
              await sendImageMessage(
                config.corpid,
                config.corpsecret,
                config.agentid,
                chatId,
                mediaId,
              );
            } else {
              await sendFileMessage(
                config.corpid,
                config.corpsecret,
                config.agentid,
                chatId,
                mediaId,
              );
            }
          }
        }

        return { content: [{ type: "text", text: "Message sent." }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to send: ${err}` }],
          isError: true,
        };
      }
    }

    case "download_attachment": {
      const mediaId = args?.media_id as string;
      if (!mediaId) {
        return {
          content: [{ type: "text", text: "Missing media_id parameter." }],
          isError: true,
        };
      }

      try {
        const localPath = await downloadMedia(config.corpid, config.corpsecret, mediaId);
        return {
          content: [{ type: "text", text: `Downloaded to: ${localPath}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to download: ${err}` }],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// --- Startup ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const config = loadConfig();
  if (!config) {
    process.stderr.write(
      "[qiwei] No config found. Run /qiwei:configure to set up your WeCom app.\n",
    );
    return;
  }

  process.stderr.write("[qiwei] Config loaded, starting callback server...\n");

  // 启动 HTTP 回调服务
  const { stop } = startCallbackServer(config, async (msg: DecryptedMessage) => {
    const fromUser = msg.FromUserName;
    if (!fromUser) return;

    // 访问控制
    if (!isAllowed(fromUser)) {
      const code = addPendingPairing(fromUser);
      try {
        await sendTextMessage(
          config.corpid,
          config.corpsecret,
          config.agentid,
          fromUser,
          `Your pairing code is: ${code}\n\nAsk the operator to confirm:\n/qiwei:access pair ${code}`,
        );
      } catch (err) {
        process.stderr.write(`[qiwei] Failed to send pairing code: ${err}\n`);
      }
      return;
    }

    // 构建消息内容
    let textContent = "";
    const meta: Record<string, string> = {
      chat_id: fromUser,
      sender_id: fromUser,
      message_id: msg.MsgId || String(msg.CreateTime),
    };

    switch (msg.MsgType) {
      case "text":
        textContent = msg.Content || "";
        break;

      case "image":
        textContent = "(image)";
        if (msg.MediaId) meta.media_id = msg.MediaId;
        if (msg.PicUrl) meta.pic_url = msg.PicUrl;
        break;

      case "voice":
        textContent = msg.Recognition
          ? `[Voice recognition]: ${msg.Recognition}`
          : "(voice message)";
        if (msg.MediaId) meta.media_id = msg.MediaId;
        break;

      case "video":
        textContent = "(video)";
        if (msg.MediaId) meta.media_id = msg.MediaId;
        break;

      case "file":
        textContent = msg.FileName ? `(file: ${msg.FileName})` : "(file)";
        if (msg.MediaId) meta.media_id = msg.MediaId;
        break;

      case "location":
        textContent = `[Location]: ${msg.Label || ""} (${msg.Location_X}, ${msg.Location_Y})`;
        break;

      default:
        textContent = `(unsupported message type: ${msg.MsgType})`;
        break;
    }

    if (!textContent) return;

    // 推送到 Claude Code
    try {
      await server.notification({
        method: "notifications/claude/channel",
        params: {
          content: textContent,
          meta,
        },
      });
    } catch (err) {
      process.stderr.write(`[qiwei] Failed to push notification: ${err}\n`);
    }
  });

  // 优雅关闭
  const shutdown = () => {
    process.stderr.write("[qiwei] Shutting down...\n");
    stop();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGHUP", shutdown);

  // 检测父进程是否还活着
  const ppid = process.ppid;
  const parentCheck = setInterval(() => {
    try {
      process.kill(ppid, 0);
    } catch {
      process.stderr.write("[qiwei] Parent process exited, shutting down...\n");
      clearInterval(parentCheck);
      shutdown();
    }
  }, 5000);
}

main().catch((err) => {
  process.stderr.write(`[qiwei] Fatal error: ${err}\n`);
  process.exit(1);
});
