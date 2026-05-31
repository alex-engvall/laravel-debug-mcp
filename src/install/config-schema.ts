import { z } from "zod";

export const installConfigSchema = z.object({
  profile: z.string().min(1).regex(/^[A-Za-z0-9._-]+$/),
  host: z.string().min(1),
  port: z.number().int().positive().default(22),
  setupUser: z.string().min(1).default("root"),
  diagUser: z.string().min(1).default("codexdiag"),
  appDir: z.string().min(1),
  healthUrl: z.string().min(1).default("http://127.0.0.1/up"),
  keyPath: z.string().min(1).optional(),
  publicKeyPath: z.string().min(1).optional(),
  remoteCommand: z.string().min(1).default("/usr/local/bin/laravel-diag"),
  enableMutations: z.boolean().default(false),
  maxOutputChars: z.number().int().positive().default(200_000),
  toolTimeoutSec: z.number().int().positive().default(45),
  codex: z
    .object({
      configure: z.boolean().default(true),
      serverName: z.string().min(1).optional(),
    })
    .default({ configure: true }),
});

export type InstallConfig = z.infer<typeof installConfigSchema>;

export type ProfileConfig = InstallConfig & {
  serverName: string;
  createdAt: string;
};
