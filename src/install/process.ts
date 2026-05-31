import { spawn } from "node:child_process";

export type RunResult = { exitCode: number; stdout: string; stderr: string };

export async function run(command: string, args: string[], options: { input?: string; timeoutMs?: number } = {}): Promise<RunResult> {
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const timer = options.timeoutMs ? setTimeout(() => child.kill("SIGKILL"), options.timeoutMs) : undefined;
  if (options.input) child.stdin.write(options.input);
  child.stdin.end();
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(typeof code === "number" ? code : 1));
  }).finally(() => {
    if (timer) clearTimeout(timer);
  });
  return { exitCode, stdout, stderr };
}

export async function commandExists(command: string): Promise<boolean> {
  const result = await run("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`]);
  return result.exitCode === 0;
}
