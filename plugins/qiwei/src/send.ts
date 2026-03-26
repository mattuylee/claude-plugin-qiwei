/**
 * 企业微信发送消息 API
 *
 * 企微自建应用不支持被动回复，必须主动调用发送 API。
 * 发送回复时只用 text 类型（不用 markdown），附件用对应类型发送。
 */

import { getAccessToken } from "./token.js";
import type { SendMessageResponse } from "./types.js";

const SEND_URL = "https://qyapi.weixin.qq.com/cgi-bin/message/send";
const MAX_TEXT_BYTES = 2048;

/**
 * 按字节长度分段文本，优先从换行符打断，保证不截断多字节字符
 */
function splitText(text: string, maxBytes: number = MAX_TEXT_BYTES): string[] {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= maxBytes) return [text];

  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const bytes = encoder.encode(remaining);
    if (bytes.length <= maxBytes) {
      segments.push(remaining);
      break;
    }

    // 从 maxBytes 位置向前找安全的字符边界
    let cutChars = 0;
    let cutBytes = 0;
    for (const char of remaining) {
      const charBytes = encoder.encode(char).length;
      if (cutBytes + charBytes > maxBytes) break;
      cutBytes += charBytes;
      cutChars += char.length; // handle surrogate pairs
    }

    let cutPoint = cutChars;

    // 优先从换行符打断：在 cut 范围内找最后一个换行
    const candidate = remaining.slice(0, cutPoint);
    const lastNewline = candidate.lastIndexOf("\n");
    if (lastNewline > 0) {
      cutPoint = lastNewline + 1; // 换行符留在当前段
    }

    segments.push(remaining.slice(0, cutPoint));
    remaining = remaining.slice(cutPoint);
  }

  return segments;
}

/**
 * 发送文本消息（自动分段）
 */
export async function sendTextMessage(
  corpid: string,
  corpsecret: string,
  agentid: number,
  touser: string,
  content: string,
): Promise<SendMessageResponse> {
  const segments = splitText(content);
  let lastResponse: SendMessageResponse | undefined;

  for (const segment of segments) {
    const token = await getAccessToken(corpid, corpsecret);
    const url = `${SEND_URL}?access_token=${token}`;

    const body = {
      touser,
      msgtype: "text",
      agentid,
      text: { content: segment },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await resp.json()) as SendMessageResponse;
    if (data.errcode !== 0) {
      throw new Error(`Send text failed: ${data.errcode} ${data.errmsg}`);
    }
    lastResponse = data;
  }

  return lastResponse!;
}

/**
 * 发送图片消息
 */
export async function sendImageMessage(
  corpid: string,
  corpsecret: string,
  agentid: number,
  touser: string,
  mediaId: string,
): Promise<SendMessageResponse> {
  const token = await getAccessToken(corpid, corpsecret);
  const url = `${SEND_URL}?access_token=${token}`;

  const body = {
    touser,
    msgtype: "image",
    agentid,
    image: { media_id: mediaId },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await resp.json()) as SendMessageResponse;
  if (data.errcode !== 0) {
    throw new Error(`Send image failed: ${data.errcode} ${data.errmsg}`);
  }
  return data;
}

/**
 * 发送文件消息
 */
export async function sendFileMessage(
  corpid: string,
  corpsecret: string,
  agentid: number,
  touser: string,
  mediaId: string,
): Promise<SendMessageResponse> {
  const token = await getAccessToken(corpid, corpsecret);
  const url = `${SEND_URL}?access_token=${token}`;

  const body = {
    touser,
    msgtype: "file",
    agentid,
    file: { media_id: mediaId },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await resp.json()) as SendMessageResponse;
  if (data.errcode !== 0) {
    throw new Error(`Send file failed: ${data.errcode} ${data.errmsg}`);
  }
  return data;
}
