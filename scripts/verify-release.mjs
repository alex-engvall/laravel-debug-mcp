#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";

const expectedPackageName = "@alex-engvall/laravel-debug-mcp";
const expectedRepositoryUrl = "git+https://github.com/alex-engvall/laravel-debug-mcp.git";
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const root = new URL("../", import.meta.url);
const failures = [];

function readText(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function extract(pattern, text, label) {
  const match = text.match(pattern);
  if (!match) {
    failures.push(`Could not find ${label}.`);
    return undefined;
  }
  return match[1];
}

const packageJson = readJson("package.json");
const version = packageJson.version;
const tag = argValue("--tag");
const releasePrerelease = argValue("--release-prerelease");
const semver = typeof version === "string" ? version.match(semverPattern) : undefined;
const isPrereleaseVersion = Boolean(semver?.[4]);

check(packageJson.name === expectedPackageName, `package.json name must be ${expectedPackageName}.`);
check(packageJson.private === false, "package.json private must be false.");
check(packageJson.repository?.url === expectedRepositoryUrl, `package.json repository.url must be ${expectedRepositoryUrl}.`);
check(Boolean(semver), `package.json version must be valid semver, got ${String(version)}.`);

if (tag) {
  check(tag === `v${version}`, `Release tag must be v${version}, got ${tag}.`);
}

if (releasePrerelease !== undefined) {
  check(["true", "false"].includes(releasePrerelease), "--release-prerelease must be true or false.");
  if (releasePrerelease === "true") {
    check(isPrereleaseVersion, "GitHub prerelease releases must use a semver prerelease version.");
  }
  if (releasePrerelease === "false") {
    check(!isPrereleaseVersion, "Stable GitHub releases must not use a semver prerelease version.");
  }
}

const cliVersion = extract(/const VERSION = "([^"]+)";/, readText("src/cli.ts"), "CLI version");
const serverVersion = extract(/version: "([^"]+)"/, readText("src/index.ts"), "MCP server version");

check(cliVersion === version, `src/cli.ts version must match package.json (${version}), got ${cliVersion}.`);
check(serverVersion === version, `src/index.ts version must match package.json (${version}), got ${serverVersion}.`);

if (failures.length > 0) {
  console.error("Release verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Release verification passed for ${packageJson.name}@${version}.`);
