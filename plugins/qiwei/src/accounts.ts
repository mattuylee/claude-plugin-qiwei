/**
 * 配置持久化
 * 存储路径：~/.claude/channels/qiwei/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { QiweiConfig } from "./types.js";

export const DEFAULT_PORT = 31098;

export function getStateDir(): string {
  const dir = process.env.QIWEI_STATE_DIR || join(homedir(), ".claude", "channels", "qiwei");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function configPath(): string {
  return join(getStateDir(), "config.json");
}

export function loadConfig(): QiweiConfig | null {
  const p = configPath();
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8"));
    return {
      corpid: raw.corpid,
      corpsecret: raw.corpsecret,
      agentid: Number(raw.agentid),
      token: raw.token,
      encodingAESKey: raw.encodingAESKey,
      port: Number(raw.port) || Number(process.env.QIWEI_PORT) || DEFAULT_PORT,
    };
  } catch {
    return null;
  }
}

export function saveConfig(config: QiweiConfig): void {
  const p = configPath();
  writeFileSync(p, JSON.stringify(config, null, 2), "utf-8");
  chmodSync(p, 0o600);
}

export function clearConfig(): void {
  const p = configPath();
  if (existsSync(p)) {
    unlinkSync(p);
  }
}
