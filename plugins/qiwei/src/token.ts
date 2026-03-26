/**
 * 企业微信 access_token 获取与缓存
 *
 * access_token 有效期 7200 秒（2 小时），提前 5 分钟刷新。
 */

import type { TokenResponse } from "./types.js";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

/**
 * 获取 access_token，带缓存和自动刷新
 */
export async function getAccessToken(corpid: string, corpsecret: string): Promise<string> {
  const now = Date.now();

  // 提前 5 分钟刷新
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.accessToken;
  }

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpid)}&corpsecret=${encodeURIComponent(corpsecret)}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to get access_token: HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as TokenResponse;

  if (data.errcode !== 0) {
    throw new Error(`Failed to get access_token: ${data.errcode} ${data.errmsg}`);
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  process.stderr.write(`[qiwei] access_token refreshed, expires in ${data.expires_in}s\n`);
  return cachedToken.accessToken;
}

/**
 * 清除缓存的 token（用于强制刷新）
 */
export function clearTokenCache(): void {
  cachedToken = null;
}
