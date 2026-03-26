/**
 * 企业微信临时素材上传/下载
 *
 * 上传：POST multipart/form-data，有效期 3 天
 * 下载：GET 返回文件二进制
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { tmpdir } from "node:os";
import { getAccessToken } from "./token.js";
import type { UploadMediaResponse } from "./types.js";

const UPLOAD_URL = "https://qyapi.weixin.qq.com/cgi-bin/media/upload";
const DOWNLOAD_URL = "https://qyapi.weixin.qq.com/cgi-bin/media/get";

/** 根据文件扩展名推断素材类型 */
function inferMediaType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
  const voiceExts = [".amr", ".mp3", ".silk"];
  const videoExts = [".mp4", ".avi", ".mov"];

  if (imageExts.includes(ext)) return "image";
  if (voiceExts.includes(ext)) return "voice";
  if (videoExts.includes(ext)) return "video";
  return "file";
}

/**
 * 上传临时素材
 * @returns media_id
 */
export async function uploadMedia(
  corpid: string,
  corpsecret: string,
  filePath: string,
  type?: string,
): Promise<string> {
  const token = await getAccessToken(corpid, corpsecret);
  const mediaType = type || inferMediaType(filePath);
  const url = `${UPLOAD_URL}?access_token=${token}&type=${mediaType}`;

  const fileData = readFileSync(filePath);
  const fileName = basename(filePath);

  const formData = new FormData();
  const blob = new Blob([fileData]);
  formData.append("media", blob, fileName);

  const resp = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const data = (await resp.json()) as UploadMediaResponse;
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`Upload media failed: ${data.errcode} ${data.errmsg}`);
  }

  process.stderr.write(`[qiwei] Uploaded ${fileName} as ${mediaType}, media_id=${data.media_id}\n`);
  return data.media_id;
}

/**
 * 下载临时素材到本地临时目录
 * @returns 本地文件路径
 */
export async function downloadMedia(
  corpid: string,
  corpsecret: string,
  mediaId: string,
): Promise<string> {
  const token = await getAccessToken(corpid, corpsecret);
  const url = `${DOWNLOAD_URL}?access_token=${token}&media_id=${mediaId}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Download media failed: HTTP ${resp.status}`);
  }

  // 检查是否返回了错误 JSON
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const errData = (await resp.json()) as { errcode: number; errmsg: string };
    throw new Error(`Download media failed: ${errData.errcode} ${errData.errmsg}`);
  }

  const data = Buffer.from(await resp.arrayBuffer());

  // 从 Content-Disposition 提取文件名
  const disposition = resp.headers.get("content-disposition") || "";
  let fileName = `media_${mediaId}`;
  const match = disposition.match(/filename="?([^";\s]+)"?/);
  if (match) {
    fileName = match[1];
  } else {
    // 根据 content-type 推断扩展名
    if (contentType.includes("image/jpeg")) fileName += ".jpg";
    else if (contentType.includes("image/png")) fileName += ".png";
    else if (contentType.includes("video/mp4")) fileName += ".mp4";
    else if (contentType.includes("audio/amr")) fileName += ".amr";
    else fileName += ".bin";
  }

  const dir = join(tmpdir(), "qiwei-media");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const filePath = join(dir, fileName);
  writeFileSync(filePath, data);

  process.stderr.write(`[qiwei] Downloaded media ${mediaId} → ${filePath}\n`);
  return filePath;
}
