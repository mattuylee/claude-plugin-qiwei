/**
 * 企业微信发送消息 API
 *
 * 企微自建应用不支持被动回复，必须主动调用发送 API。
 * 发送回复时只用 text 类型（不用 markdown），附件用对应类型发送。
 */

import { getAccessToken } from "./token.js";
import type { SendMessageResponse } from "./types.js";

const SEND_URL = "https://qyapi.weixin.qq.com/cgi-bin/message/send";

/**
 * 发送文本消息
 */
export async function sendTextMessage(
  corpid: string,
  corpsecret: string,
  agentid: number,
  touser: string,
  content: string,
): Promise<SendMessageResponse> {
  const token = await getAccessToken(corpid, corpsecret);
  const url = `${SEND_URL}?access_token=${token}`;

  const body = {
    touser,
    msgtype: "text",
    agentid,
    text: { content },
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
  return data;
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
