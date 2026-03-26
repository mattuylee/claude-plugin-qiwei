/**
 * HTTP 回调服务：接收企微消息推送
 *
 * GET 请求：URL 验证（解密 echostr 返回明文）
 * POST 请求：接收消息推送（验签 → 解密 → 解析 XML → 返回 "success"）
 *
 * 使用 Bun.serve 原生 HTTP 能力。
 */

import { XMLParser } from "fast-xml-parser";
import { verifySignature, decrypt, decryptEchoStr } from "./crypto.js";
import type { QiweiConfig, CallbackMessageXml, DecryptedMessage } from "./types.js";

export type OnMessageCallback = (msg: DecryptedMessage) => Promise<void>;

const xmlParser = new XMLParser({
  // 处理 CDATA
  cdataPropName: "__cdata",
  processEntities: false,
  // 将所有值视为字符串，避免数字转换丢失精度
  parseTagValue: false,
});

/**
 * 解析 XML 字符串，处理 CDATA 包裹
 */
function parseXmlValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "__cdata" in val) {
    return String((val as Record<string, unknown>).__cdata);
  }
  return String(val);
}

/**
 * 启动 HTTP 回调服务
 */
export function startCallbackServer(
  config: QiweiConfig,
  onMessage: OnMessageCallback,
): { server: ReturnType<typeof Bun.serve>; stop: () => void } {
  const port = config.port;

  const httpServer = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname !== "/callback") {
        return new Response("Forbidden", { status: 403 });
      }

      const msgSignature = url.searchParams.get("msg_signature") || "";
      const timestamp = url.searchParams.get("timestamp") || "";
      const nonce = url.searchParams.get("nonce") || "";

      // GET: URL 验证
      if (req.method === "GET") {
        const echostr = url.searchParams.get("echostr") || "";
        if (!echostr) {
          return new Response("Missing echostr", { status: 400 });
        }

        // 验证签名
        const expectedSig = verifySignature(config.token, timestamp, nonce, echostr);
        if (expectedSig !== msgSignature) {
          process.stderr.write(`[qiwei] URL verification failed: signature mismatch\n`);
          return new Response("Signature mismatch", { status: 403 });
        }

        // 解密 echostr
        try {
          const plainEchoStr = decryptEchoStr(echostr, config.encodingAESKey);
          process.stderr.write(`[qiwei] URL verification success\n`);
          return new Response(plainEchoStr, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        } catch (err) {
          process.stderr.write(`[qiwei] URL verification decrypt error: ${err}\n`);
          return new Response("Decrypt failed", { status: 500 });
        }
      }

      // POST: 接收消息
      if (req.method === "POST") {
        try {
          const body = await req.text();

          // 解析外层 XML
          const parsed = xmlParser.parse(body);
          const xml = parsed.xml as CallbackMessageXml;

          if (!xml || !xml.Encrypt) {
            return new Response("Invalid XML", { status: 400 });
          }

          const encryptedMsg = parseXmlValue(xml.Encrypt);

          // 验证签名
          const expectedSig = verifySignature(config.token, timestamp, nonce, encryptedMsg);
          if (expectedSig !== msgSignature) {
            process.stderr.write(`[qiwei] Message signature mismatch\n`);
            return new Response("Signature mismatch", { status: 403 });
          }

          // 解密
          const { message, corpId } = decrypt(encryptedMsg, config.encodingAESKey);

          // 验证 CorpID
          if (corpId !== config.corpid) {
            process.stderr.write(
              `[qiwei] CorpID mismatch: expected ${config.corpid}, got ${corpId}\n`,
            );
            return new Response("CorpID mismatch", { status: 403 });
          }

          // 解析消息 XML
          const msgParsed = xmlParser.parse(message);
          const msgXml = msgParsed.xml;

          if (!msgXml) {
            return new Response("success", {
              status: 200,
              headers: { "Content-Type": "text/plain" },
            });
          }

          const decryptedMsg: DecryptedMessage = {
            ToUserName: parseXmlValue(msgXml.ToUserName),
            FromUserName: parseXmlValue(msgXml.FromUserName),
            CreateTime: Number(parseXmlValue(msgXml.CreateTime)),
            MsgType: parseXmlValue(msgXml.MsgType),
            AgentID: Number(parseXmlValue(msgXml.AgentID)),
          };

          // 根据消息类型提取字段
          const msgType = decryptedMsg.MsgType;

          if (msgType === "text") {
            decryptedMsg.Content = parseXmlValue(msgXml.Content);
            decryptedMsg.MsgId = parseXmlValue(msgXml.MsgId);
          } else if (msgType === "image") {
            decryptedMsg.PicUrl = parseXmlValue(msgXml.PicUrl);
            decryptedMsg.MediaId = parseXmlValue(msgXml.MediaId);
            decryptedMsg.MsgId = parseXmlValue(msgXml.MsgId);
          } else if (msgType === "voice") {
            decryptedMsg.MediaId = parseXmlValue(msgXml.MediaId);
            decryptedMsg.Format = parseXmlValue(msgXml.Format);
            decryptedMsg.Recognition = parseXmlValue(msgXml.Recognition);
            decryptedMsg.MsgId = parseXmlValue(msgXml.MsgId);
          } else if (msgType === "video") {
            decryptedMsg.MediaId = parseXmlValue(msgXml.MediaId);
            decryptedMsg.ThumbMediaId = parseXmlValue(msgXml.ThumbMediaId);
            decryptedMsg.MsgId = parseXmlValue(msgXml.MsgId);
          } else if (msgType === "location") {
            decryptedMsg.Location_X = Number(parseXmlValue(msgXml.Location_X));
            decryptedMsg.Location_Y = Number(parseXmlValue(msgXml.Location_Y));
            decryptedMsg.Scale = Number(parseXmlValue(msgXml.Scale));
            decryptedMsg.Label = parseXmlValue(msgXml.Label);
            decryptedMsg.MsgId = parseXmlValue(msgXml.MsgId);
          } else if (msgType === "file") {
            // 企微文件消息（部分版本通过 event 推送，此处兼容 MsgType=file）
            decryptedMsg.MediaId = parseXmlValue(msgXml.MediaId);
            decryptedMsg.FileName = parseXmlValue(msgXml.FileName);
            decryptedMsg.FileSize = Number(parseXmlValue(msgXml.FileSize));
            decryptedMsg.MsgId = parseXmlValue(msgXml.MsgId);
          }

          // 异步处理消息，不阻塞响应
          onMessage(decryptedMsg).catch((err) => {
            process.stderr.write(`[qiwei] Error processing message: ${err}\n`);
          });

          return new Response("success", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        } catch (err) {
          process.stderr.write(`[qiwei] POST handler error: ${err}\n`);
          return new Response("Internal error", { status: 500 });
        }
      }

      return new Response("Method not allowed", { status: 405 });
    },
  });

  process.stderr.write(`[qiwei] Callback server listening on port ${port}\n`);

  return {
    server: httpServer,
    stop: () => httpServer.stop(),
  };
}
