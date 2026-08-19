import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { COMMISSION_PERCENT, DEFAULT_COMMISSION_PERCENT, isValidCommissionPercent } from "../../lib/commission";

export const CONFIG_KEYS = {
  SIMULATED_PAYMENT_GATEWAY: "SIMULATED_PAYMENT_GATEWAY_MODE",
  COMMISSION_PERCENT: "PLATFORM_COMMISSION_PERCENT",
  
  MARKETPLACE_NAME: "MARKETPLACE_NAME",
  MARKETPLACE_DESCRIPTION: "MARKETPLACE_DESCRIPTION",
  BRAND_LOGO_URL: "BRAND_LOGO_URL",
  BRAND_FAVICON_URL: "BRAND_FAVICON_URL",
  TIMEZONE: "MARKETPLACE_TIMEZONE",
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

export const WRITABLE_CONFIG_KEYS = Object.values(CONFIG_KEYS);

export const PUBLIC_SETTING_DEFAULTS: Record<string, string> = {
  [CONFIG_KEYS.MARKETPLACE_NAME]: "NeedBuy",
  [CONFIG_KEYS.MARKETPLACE_DESCRIPTION]: "",
  [CONFIG_KEYS.BRAND_LOGO_URL]: "",
  [CONFIG_KEYS.BRAND_FAVICON_URL]: "",
};

export interface ConfigItem {
  key: string;
  value: string;
  updatedAt: Date;
}

export interface GetConfigResponse {
  simulatedPaymentGateway: boolean;
}

export interface SetConfigInput {
  key: string;
  value: string;
}

export async function getConfig(key: ConfigKey): Promise<string | null> {
  const config = await prisma.adminConfig.findUnique({ where: { key } });
  return config?.value ?? null;
}

export async function getAllConfigs(): Promise<ConfigItem[]> {
  return prisma.adminConfig.findMany({ orderBy: { key: "asc" } });
}

export async function getConfigMap(): Promise<Record<string, string>> {
  const rows = await getAllConfigs();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  const map = await getConfigMap();
  return Object.fromEntries(
    Object.entries(PUBLIC_SETTING_DEFAULTS).map(([key, fallback]) => [key, map[key] || fallback])
  );
}

export async function setConfig(key: ConfigKey, value: string): Promise<ConfigItem> {
  return prisma.adminConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function toggleSimulatedPaymentGateway(enabled: boolean): Promise<boolean> {
  await setConfig(CONFIG_KEYS.SIMULATED_PAYMENT_GATEWAY, String(enabled));
  return enabled;
}

export async function isSimulatedPaymentGatewayEnabled(): Promise<boolean> {
  const value = await getConfig(CONFIG_KEYS.SIMULATED_PAYMENT_GATEWAY);
  return value === "true";
}

export async function getCommissionPercent(): Promise<number> {
  // Tarifnya dikunci di COMMISSION_PERCENT. Nilai yang mungkin pernah
  // tersimpan di config sengaja tidak dibaca supaya angka yang ditagihkan ke
  // penjual selalu sama dengan yang ditampilkan di dashboard admin.
  return COMMISSION_PERCENT;
}

