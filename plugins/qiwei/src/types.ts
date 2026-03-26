/**
 * 企业微信消息类型定义
 */

/** 企微自建应用配置 */
export interface QiweiConfig {
  corpid: string;
  corpsecret: string;
  agentid: number;
  token: string;
  encodingAESKey: string;
  port: number;
}

/** access_token 响应 */
export interface TokenResponse {
  errcode: number;
  errmsg: string;
  access_token: string;
  expires_in: number;
}

/** 发送消息响应 */
export interface SendMessageResponse {
  errcode: number;
  errmsg: string;
  invaliduser?: string;
  invalidparty?: string;
  invalidtag?: string;
  unlicenseduser?: string;
  msgid?: string;
  response_code?: string;
}

/** 上传临时素材响应 */
export interface UploadMediaResponse {
  errcode?: number;
  errmsg?: string;
  type: string;
  media_id: string;
  created_at: string;
}

/** 回调消息 XML 解析后的结构 */
export interface CallbackMessageXml {
  ToUserName: string;
  AgentID: string;
  Encrypt: string;
}

/** 解密后的消息体 */
export interface DecryptedMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: string;
  Content?: string;
  MsgId?: string;
  PicUrl?: string;
  MediaId?: string;
  Format?: string;
  Recognition?: string;
  ThumbMediaId?: string;
  Location_X?: number;
  Location_Y?: number;
  Scale?: number;
  Label?: string;
  AgentID: number;
  /** File message fields */
  FileName?: string;
  FileSize?: number;
}

/** 消息类型枚举 */
export const MsgType = {
  TEXT: "text",
  IMAGE: "image",
  VOICE: "voice",
  VIDEO: "video",
  FILE: "file",
  LOCATION: "location",
} as const;

export type MsgTypeValue = (typeof MsgType)[keyof typeof MsgType];
