export interface AdminEnv {
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
}

export interface FunctionContext {
  request: Request;
  env: AdminEnv;
  params: Record<string, string | undefined>;
}

export class ConfigError extends Error {}

const REQUIRED = ['ADMIN_PASSWORD', 'ADMIN_SECRET', 'GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'] as const;

export function requireEnv(env: AdminEnv): Record<string, string> {
  const values: Record<string, string> = { GITHUB_BRANCH: 'main' };
  const missing: string[] = [];
  for (const key of REQUIRED) {
    const value = env[key]?.trim();
    if (value) values[key] = value;
    else missing.push(key);
  }
  if (missing.length) {
    throw new ConfigError('后台尚未完成服务端配置，缺少环境变量：' + missing.join('、'));
  }
  return values;
}
