/**
 * 企业微信消息加解密
 *
 * 签名算法：SHA1(sort(Token, timestamp, nonce, encrypt_msg))
 * 加密算法：AES-256-CBC
 * 密钥：Base64Decode(EncodingAESKey + "=")，得到 32 字节
 * IV：密钥前 16 字节
 * 填充：PKCS#7
 * 明文格式：随机16字节 + msg_len(4字节网络字节序) + msg + CorpID
 */

import { createHash, createDecipheriv, createCipheriv, randomBytes } from "node:crypto";

/**
 * 验证企微回调签名
 */
export function verifySignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
): string {
  const arr = [token, timestamp, nonce, encrypt].sort();
  return createHash("sha1").update(arr.join("")).digest("hex");
}

/**
 * 从 EncodingAESKey 导出 AES 密钥和 IV
 */
function deriveKeyAndIv(encodingAESKey: string): { key: Buffer; iv: Buffer } {
  const key = Buffer.from(encodingAESKey + "=", "base64");
  const iv = key.subarray(0, 16);
  return { key, iv };
}

/**
 * PKCS#7 去填充
 */
function pkcs7Unpad(buf: Buffer): Buffer {
  const pad = buf[buf.length - 1];
  if (pad < 1 || pad > 32) return buf;
  return buf.subarray(0, buf.length - pad);
}

/**
 * PKCS#7 填充
 */
function pkcs7Pad(buf: Buffer, blockSize: number = 32): Buffer {
  const padLen = blockSize - (buf.length % blockSize);
  const padBuf = Buffer.alloc(padLen, padLen);
  return Buffer.concat([buf, padBuf]);
}

/**
 * 解密企微消息
 * @returns { message: 解密后的消息明文, corpId: 消息中的 CorpID }
 */
export function decrypt(
  encrypted: string,
  encodingAESKey: string,
): { message: string; corpId: string } {
  const { key, iv } = deriveKeyAndIv(encodingAESKey);

  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(false);

  const encryptedBuf = Buffer.from(encrypted, "base64");
  const decrypted = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
  const unpadded = pkcs7Unpad(decrypted);

  // 明文格式：随机16字节 + msg_len(4字节网络字节序) + msg + CorpID
  const msgLen = unpadded.readUInt32BE(16);
  const message = unpadded.subarray(20, 20 + msgLen).toString("utf-8");
  const corpId = unpadded.subarray(20 + msgLen).toString("utf-8");

  return { message, corpId };
}

/**
 * 加密消息（用于响应企微验证请求）
 */
export function encrypt(message: string, encodingAESKey: string, corpId: string): string {
  const { key, iv } = deriveKeyAndIv(encodingAESKey);

  const randomBuf = randomBytes(16);
  const msgBuf = Buffer.from(message, "utf-8");
  const msgLenBuf = Buffer.alloc(4);
  msgLenBuf.writeUInt32BE(msgBuf.length, 0);
  const corpIdBuf = Buffer.from(corpId, "utf-8");

  const plaintext = Buffer.concat([randomBuf, msgLenBuf, msgBuf, corpIdBuf]);
  const padded = pkcs7Pad(plaintext);

  const cipher = createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(false);

  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
  return encrypted.toString("base64");
}

/**
 * 解密 echostr（URL 验证用）
 */
export function decryptEchoStr(echostr: string, encodingAESKey: string): string {
  const { message } = decrypt(echostr, encodingAESKey);
  return message;
}
