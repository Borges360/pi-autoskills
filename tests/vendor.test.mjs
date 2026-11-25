import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { verifyVendor } from "../src/vendor/inteiro-terminal/verify-vendor.mjs";

const root = new URL("../", import.meta.url);
const vendorDir = new URL("src/vendor/inteiro-terminal/", root);

test("vendored terminal adapter matches its manifest hashes (no IDS checkout needed)", () => {
  const result = verifyVendor(fileURLToPath(vendorDir));
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
  const m = result.manifest;
  assert.equal(m.version, "2.0.0-rc.1");
  assert.equal(m.format, "ts");
  assert.equal(m.source.dirty, false);
  assert.deepEqual(m.patches, []);
  // Only the Pi host is external: no width library, no prompts/linear adapters.
  assert.deepEqual(m.externals, ["@earendil-works/pi-tui"]);
  assert.ok(m.files.every((f) => f.sha256 === f.upstreamSha256));
});

test("vendored copy carries no design-system tokens, palette or fixed colors", async () => {
  const files = (await readdir(vendorDir)).filter((f) => f.endsWith(".ts"));
  assert.ok(
    !files.includes("roles.ts") && !files.includes("catalog.ts") && !files.includes("prompts.ts"),
  );
  for (const file of files) {
    const source = await readFile(new URL(file, vendorDir), "utf8");
    assert.doesNotMatch(source, /\\x1b\[[0-9;]*m|\\u001b\[[0-9;]*m/, `${file} has fixed ANSI color`);
    assert.doesNotMatch(source, /color\.identity|SEMANTIC_ROLES/, `${file} imports tokens`);
  }
});

test("package peer range covers the vendored adapter and the installed host", async () => {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(pkg.peerDependencies["@earendil-works/pi-tui"], ">=1.5.2 <1.7.0");
  assert.equal(pkg.peerDependencies["@earendil-works/pi-coding-agent"], ">=1.5.2 <1.7.0");
  assert.equal(pkg.devDependencies["@earendil-works/pi-tui"], "1.6.0");
  assert.equal(pkg.devDependencies["@earendil-works/pi-coding-agent"], "1.6.0");
  assert.ok(!("string-width" in (pkg.dependencies ?? {})));
});

test("no design-system mark, slogan or attribution ships outside the vendored adapter", async () => {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const walk = async (rel) => {
    let entries;
    try {
      entries = await readdir(new URL(rel, root), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOTDIR") return [rel];
      if (error.code === "ENOENT") return [];
      throw error;
    }
    return (
      await Promise.all(entries.map((e) => (e.isDirectory() ? walk(`${rel}/${e.name}`) : [`${rel}/${e.name}`])))
    ).flat();
  };
  const shipped = (await Promise.all(pkg.files.filter((p) => !p.startsWith("!")).map(walk)))
    .flat()
    .filter((path) => !/(^|\/)vendor(\/|$)/.test(path));
  assert.ok(shipped.includes("README.md") && shipped.some((p) => p.startsWith("dist/")));
  for (const path of shipped) {
    assert.doesNotMatch(path, /inteiro|mark\.svg/i, `${path} ships a design-system asset`);
    const text = await readFile(new URL(path, root), "utf8");
    assert.doesNotMatch(text, /INTEIRO|Não eliminar a tensão/, `${path} carries the design-system mark or slogan`);
  }
});

test("consumer README does not advertise the design system or its mark", async () => {
  const readme = await readFile(new URL("README.md", root), "utf8");
  assert.doesNotMatch(readme, /inteiro/i);
});