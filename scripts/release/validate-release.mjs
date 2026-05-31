#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const lockPackage = JSON.parse(readFileSync("package-lock.json", "utf8"));

const releaseTag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || "";
const releasePrerelease = process.env.GITHUB_RELEASE_PRERELEASE;
const skipNpmVersionCheck = process.env.SKIP_NPM_VERSION_CHECK === "1";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[release] ${message}`);
}

if (!releaseTag) {
  fail("Release tag is missing. Set RELEASE_TAG or run from a tag ref.");
}

if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(releaseTag)) {
  fail(
    `Release tag "${releaseTag}" must use semver format vX.Y.Z or vX.Y.Z-prerelease.`,
  );
}

const tagVersion = releaseTag.slice(1);
if (rootPackage.version !== tagVersion) {
  fail(
    `Release tag ${releaseTag} does not match package.json version ${rootPackage.version}.`,
  );
}

if (rootPackage.private === true) {
  fail("package.json is marked private and cannot be published to npm.");
}

if (!rootPackage.name) {
  fail("package.json must include a package name.");
}

if (lockPackage.name !== rootPackage.name) {
  fail(
    `package-lock.json name ${lockPackage.name} does not match package.json name ${rootPackage.name}.`,
  );
}

if (lockPackage.version !== rootPackage.version) {
  fail(
    `package-lock.json version ${lockPackage.version} does not match package.json version ${rootPackage.version}.`,
  );
}

const rootLockPackage = lockPackage.packages?.[""];
if (!rootLockPackage) {
  fail("package-lock.json is missing the root package entry.");
}

if (rootLockPackage.name !== rootPackage.name) {
  fail(
    `package-lock.json root package name ${rootLockPackage.name} does not match package.json name ${rootPackage.name}.`,
  );
}

if (rootLockPackage.version !== rootPackage.version) {
  fail(
    `package-lock.json root package version ${rootLockPackage.version} does not match package.json version ${rootPackage.version}.`,
  );
}

const isPrereleaseVersion = rootPackage.version.includes("-");
if (releasePrerelease === "true" && !isPrereleaseVersion) {
  fail(
    "GitHub release is marked as prerelease, but package.json contains a stable version.",
  );
}

if (releasePrerelease === "false" && isPrereleaseVersion) {
  fail(
    "package.json contains a prerelease version, but the GitHub release is not marked as prerelease.",
  );
}

const distTag = isPrereleaseVersion ? "next" : "latest";

if (!skipNpmVersionCheck) {
  try {
    execFileSync(
      "npm",
      [
        "view",
        `${rootPackage.name}@${rootPackage.version}`,
        "version",
        "--json",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    fail(
      `${rootPackage.name}@${rootPackage.version} already exists on npm. Bump the version before publishing.`,
    );
  } catch (error) {
    const stderr = error.stderr?.toString() ?? "";
    const stdout = error.stdout?.toString() ?? "";
    if (!stderr.includes("E404") && !stdout.includes("E404")) {
      fail(
        `Could not verify whether ${rootPackage.name}@${rootPackage.version} already exists on npm. ${stderr || stdout}`.trim(),
      );
    }
  }
}

if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `package_name=${rootPackage.name}\n`,
  );
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `package_version=${rootPackage.version}\n`,
  );
  appendFileSync(process.env.GITHUB_OUTPUT, `dist_tag=${distTag}\n`);
}

info(
  `Validated ${rootPackage.name}@${rootPackage.version} for npm dist-tag "${distTag}".`,
);
