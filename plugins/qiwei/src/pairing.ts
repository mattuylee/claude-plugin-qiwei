/**
 * 配对码 + allowlist 访问控制
 * 逻辑与微信插件一致：pairing / allowlist / disabled 三种策略
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStateDir } from "./accounts.js";

export interface AccessConfig {
  policy: "pairing" | "allowlist" | "disabled";
  allowFrom: string[];
}

interface PendingEntry {
  userId: string;
  expiresAt: number;
}

function configPath(): string {
  return join(getStateDir(), "access.json");
}

function pendingPath(): string {
  return join(getStateDir(), "pending-pairings.json");
}

function loadPending(): Record<string, PendingEntry> {
  const p = pendingPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}

function savePending(data: Record<string, PendingEntry>): void {
  writeFileSync(pendingPath(), JSON.stringify(data, null, 2), "utf-8");
}

export function loadAccessConfig(): AccessConfig {
  const p = configPath();
  if (!existsSync(p)) {
    return { policy: "pairing", allowFrom: [] };
  }
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as AccessConfig;
  } catch {
    return { policy: "pairing", allowFrom: [] };
  }
}

export function saveAccessConfig(config: AccessConfig): void {
  writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf-8");
}

export function isAllowed(userId: string): boolean {
  const config = loadAccessConfig();
  if (config.policy === "disabled") return true;
  return config.allowFrom.includes(userId);
}

/** 生成 6 位配对码 */
export function addPendingPairing(userId: string): string {
  const pending = loadPending();
  const now = Date.now();

  // 清理过期
  for (const code of Object.keys(pending)) {
    if (pending[code].expiresAt < now) delete pending[code];
  }

  // 检查用户是否已有待确认的码
  for (const [code, entry] of Object.entries(pending)) {
    if (entry.userId === userId) {
      savePending(pending);
      return code;
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  pending[code] = { userId, expiresAt: now + 10 * 60 * 1000 }; // 10 分钟
  savePending(pending);
  return code;
}

/** 确认配对码，返回 userId */
export function confirmPairing(code: string): string | null {
  const pending = loadPending();
  const entry = pending[code];
  if (!entry || entry.expiresAt < Date.now()) {
    delete pending[code];
    savePending(pending);
    return null;
  }
  delete pending[code];
  savePending(pending);

  const config = loadAccessConfig();
  if (!config.allowFrom.includes(entry.userId)) {
    config.allowFrom.push(entry.userId);
    saveAccessConfig(config);
  }
  return entry.userId;
}
