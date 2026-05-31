#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const releaseType = process.env.RELEASE_TYPE;
const customVersion = process.env.CUSTOM_VERSION?.trim();
const prereleaseIdentifier = (process.env.PRERELEASE_IDENTIFIER || "rc").trim();
const semverPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function parseVersion(version) {
  const match = semverPattern.exec(version);
  if (!match) {
    fail(`Invalid semver version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || "",
  };
}

function formatVersion(version) {
  const base = `${version.major}.${version.minor}.${version.patch}`;
  return version.prerelease ? `${base}-${version.prerelease}` : base;
}

function compareVersions(a, b) {
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) {
      return a[key] > b[key] ? 1 : -1;
    }
  }

  if (a.prerelease === b.prerelease) {
    return 0;
  }

  if (!a.prerelease) {
    return 1;
  }

  if (!b.prerelease) {
    return -1;
  }

  return a.prerelease > b.prerelease ? 1 : -1;
}

function nextPrereleaseIdentifier(currentPrerelease) {
  const parts = currentPrerelease.split(".");
  const lastPart = parts.at(-1);
  if (lastPart && /^\d+$/.test(lastPart)) {
    parts[parts.length - 1] = String(Number(lastPart) + 1);
    return parts.join(".");
  }

  return `${prereleaseIdentifier}.0`;
}

if (
  !["patch", "minor", "major", "prerelease", "custom"].includes(
    releaseType || "",
  )
) {
  fail(
    "RELEASE_TYPE must be one of patch, minor, major, prerelease, or custom.",
  );
}

if (!/^[0-9A-Za-z-]+$/.test(prereleaseIdentifier)) {
  fail("PRERELEASE_IDENTIFIER may only contain letters, numbers, and hyphens.");
}

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const lockPackage = JSON.parse(readFileSync("package-lock.json", "utf8"));
const currentVersion = parseVersion(rootPackage.version);
let nextVersion;

switch (releaseType) {
  case "major":
    nextVersion = {
      major: currentVersion.major + 1,
      minor: 0,
      patch: 0,
      prerelease: "",
    };
    break;
  case "minor":
    nextVersion = {
      major: currentVersion.major,
      minor: currentVersion.minor + 1,
      patch: 0,
      prerelease: "",
    };
    break;
  case "patch":
    nextVersion = {
      major: currentVersion.major,
      minor: currentVersion.minor,
      patch: currentVersion.patch + 1,
      prerelease: "",
    };
    break;
  case "prerelease":
    if (currentVersion.prerelease) {
      nextVersion = {
        ...currentVersion,
        prerelease: nextPrereleaseIdentifier(currentVersion.prerelease),
      };
    } else {
      nextVersion = {
        major: currentVersion.major,
        minor: currentVersion.minor,
        patch: currentVersion.patch + 1,
        prerelease: `${prereleaseIdentifier}.0`,
      };
    }
    break;
  case "custom":
    if (!customVersion) {
      fail("CUSTOM_VERSION is required when RELEASE_TYPE is custom.");
    }
    nextVersion = parseVersion(customVersion.replace(/^v/, ""));
    break;
}

if (compareVersions(nextVersion, currentVersion) <= 0) {
  fail(
    `Next version ${formatVersion(nextVersion)} must be greater than current version ${rootPackage.version}.`,
  );
}

const version = formatVersion(nextVersion);
rootPackage.version = version;
lockPackage.version = version;
lockPackage.name = rootPackage.name;

if (lockPackage.packages?.[""]) {
  lockPackage.packages[""].name = rootPackage.name;
  lockPackage.packages[""].version = version;
}

writeFileSync("package.json", `${JSON.stringify(rootPackage, null, 2)}\n`);
writeFileSync("package-lock.json", `${JSON.stringify(lockPackage, null, 2)}\n`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `tag=v${version}\n`);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `is_prerelease=${String(version.includes("-"))}\n`,
  );
}

console.log(`[release] Prepared ${rootPackage.name}@${version}.`);
