/**
 * Docker Dev Extension
 *
 * - Bash runs inside the `dev` container via `docker compose exec dev bash`
 *   when the project directory contains a compose.yaml with a `dev` service
 * - Fails early if that `dev` service exists but isn't running
 * - Falls back to local bash otherwise
 * - File tools (read, write, edit, glob, grep) are restricted to the project directory
 *
 * Usage: pi -e ./docker-dev.ts
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BashOperations, ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createBashTool, createLocalBashOperations } from "@mariozechner/pi-coding-agent";

function dockerBashOps(projectDir: string): BashOperations {
	return {
		exec: (command, cwd, { onData, signal, timeout }) =>
			new Promise((res, rej) => {
				const child = spawn(
					"docker",
					["compose", "exec", "-T", "dev", "bash", "-c", `cd ${JSON.stringify(cwd)} && ${command}`],
					{ cwd: projectDir, stdio: ["ignore", "pipe", "pipe"] },
				);
				let timedOut = false;
				const timer = timeout ? setTimeout(() => { timedOut = true; child.kill(); }, timeout * 1000) : undefined;
				child.stdout.on("data", onData);
				child.stderr.on("data", onData);
				child.on("error", (e) => { if (timer) clearTimeout(timer); rej(e); });
				const onAbort = () => child.kill();
				signal?.addEventListener("abort", onAbort, { once: true });
				child.on("close", (code) => {
					if (timer) clearTimeout(timer);
					signal?.removeEventListener("abort", onAbort);
					if (signal?.aborted) rej(new Error("aborted"));
					else if (timedOut) rej(new Error(`timeout:${timeout}`));
					else res({ exitCode: code });
				});
			}),
	};
}

function hasDevService(projectDir: string): boolean {
	const composePath = join(projectDir, "compose.yaml");
	if (!existsSync(composePath)) return false;

	const lines = readFileSync(composePath, "utf8").split(/\r?\n/);
	let inServices = false;
	let servicesIndent = 0;
	let serviceIndent: number | undefined;

	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+#.*$/, "");
		if (!inServices) {
			const match = line.match(/^(\s*)services:\s*$/);
			if (!match) continue;
			inServices = true;
			servicesIndent = match[1].length;
			continue;
		}
		if (!line.trim()) continue;

		const indent = line.match(/^\s*/)?.[0].length ?? 0;
		if (indent <= servicesIndent) break;

		const match = line.match(/^(\s*)([A-Za-z0-9._-]+):\s*$/);
		if (!match) continue;
		serviceIndent ??= match[1].length;
		if (match[1].length !== serviceIndent) continue;
		if (match[2] === "dev") return true;
	}

	return false;
}

function isDevRunning(projectDir: string): boolean {
	const result = spawnSync("docker", ["compose", "ps", "--services", "--status", "running", "dev"], {
		cwd: projectDir,
		encoding: "utf8",
	});
	if (result.error) throw new Error(`docker-dev: checking running services: ${result.error.message}`);
	if (result.status !== 0) {
		throw new Error(`docker-dev: checking running services: ${result.stderr.trim() || `exit code ${result.status}`}`);
	}
	return result.stdout.split(/\r?\n/).some((line) => line.trim() === "dev");
}

function resolveBashMode(projectDir: string): { ops: BashOperations; status: string; useDocker: boolean } {
	if (!existsSync(join(projectDir, "compose.yaml")) || !hasDevService(projectDir)) {
		return { ops: createLocalBashOperations(), status: "bash → local", useDocker: false };
	}
	if (!isDevRunning(projectDir)) {
		throw new Error(`docker-dev: service "dev" is defined in compose.yaml but is not running in ${projectDir}`);
	}
	return { ops: dockerBashOps(projectDir), status: "bash → docker compose exec dev", useDocker: true };
}

const FILE_TOOL_PATH_KEYS: Record<string, string[]> = {
	read: ["path"],
	write: ["path"],
	edit: ["path"],
	glob: ["path"],
	grep: ["path"],
};

const SECRET_ENV_KEY = /^(?:.*(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|API_KEY|ACCESS_KEY)|DATABASE_URL)$/i;

function resolveToolPath(cwd: string, raw: string): string {
	return resolve(cwd, raw.replace(/^@/, ""));
}

function isInsideProject(projectDir: string, abs: string): boolean {
	return abs === projectDir || abs.startsWith(projectDir + "/");
}

function isProjectEnvFile(projectDir: string, abs: string): boolean {
	return abs === join(projectDir, ".env");
}

function redactEnvValue(value: string): string {
	const quote = value.match(/^\s*(['"])/)?.[1];
	if (quote === '"') return '"<redacted>"';
	if (quote === "'") return "'<redacted>'";
	return "<redacted>";
}

function redactEnvLine(line: string): string {
	const match = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);
	if (!match) return line;
	const [, prefix, key, separator, value] = match;
	if (!SECRET_ENV_KEY.test(key)) return line;
	const suffix = value.match(/(\s+#.*)$/)?.[1] ?? "";
	return `${prefix}${key}${separator}${redactEnvValue(value)}${suffix}`;
}

function redactEnvText(text: string): string {
	return text.split(/\r?\n/).map(redactEnvLine).join("\n");
}

function redactToolContent(content: { type: string; text?: string }[]) {
	return content.map((part) => part.type === "text" && typeof part.text === "string" ? { ...part, text: redactEnvText(part.text) } : part);
}

export default function (pi: ExtensionAPI) {
	const projectDir = process.cwd();
	const { ops, status, useDocker } = resolveBashMode(projectDir);
	const redactedToolCalls = new Set<string>();

	pi.registerTool(createBashTool(projectDir, { operations: ops }));

	pi.on("user_bash", () => useDocker ? { operations: ops } : undefined);

	pi.on("tool_call", async (event, ctx) => {
		const keys = FILE_TOOL_PATH_KEYS[event.toolName];
		if (!keys) return;

		for (const key of keys) {
			const raw = event.input[key] as string | undefined;
			if (!raw) continue;
			const abs = resolveToolPath(ctx.cwd, raw);
			if (!isInsideProject(projectDir, abs)) {
				return { block: true, reason: `Path "${raw}" is outside the project directory` };
			}
			if (event.toolName === "read" && isProjectEnvFile(projectDir, abs)) {
				redactedToolCalls.add(event.toolCallId);
			}
		}
	});

	pi.on("tool_result", async (event) => {
		if (event.toolName !== "read" || !redactedToolCalls.has(event.toolCallId)) return;
		redactedToolCalls.delete(event.toolCallId);
		return { content: redactToolContent(event.content) };
	});

	pi.on("tool_execution_end", async (event) => {
		redactedToolCalls.delete(event.toolCallId);
	});

	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setStatus("docker-dev", ctx.ui.theme.fg("accent", status));
	});
}
