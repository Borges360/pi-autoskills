import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  catalogs,
  isLocale,
  loadProjectLocale,
  locales,
  messageKeys,
  saveProjectLocale,
  translate,
} from "../dist/common/i18n.js";

const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();

test("English and pt-BR catalogs have identical keys and placeholders", () => {
  assert.deepEqual(locales, ["en", "pt-BR"]);
  assert.deepEqual(Object.keys(catalogs.en).sort(), Object.keys(catalogs["pt-BR"]).sort());
  assert.deepEqual([...messageKeys].sort(), Object.keys(catalogs.en).sort());
  for (const key of messageKeys)
    assert.deepEqual(placeholders(catalogs.en[key]), placeholders(catalogs["pt-BR"][key]), key);
  assert.equal(translate("en", "notice.modeSaved", { mode: "Observe" }), "Saved mode: Observe.");
  assert.equal(translate("pt-BR", "notice.modeSaved", { mode: "Observar" }), "Modo salvo: Observar.");
  assert.equal(isLocale("pt-BR"), true);
  assert.equal(isLocale("pt"), false);
});

test("locale is project-scoped, trust-gated, and defaults to English", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-autoskills-i18n-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = join(root, "project-one");
  const second = join(root, "project-two");
  await Promise.all([mkdir(first), mkdir(second)]);

  assert.deepEqual(await loadProjectLocale(first, true), { locale: "en", invalid: false });
  await saveProjectLocale(first, true, "pt-BR");
  const persisted = join(first, ".pi", "pi-autoskills.locale.json");
  assert.deepEqual(JSON.parse(await readFile(persisted, "utf8")), { locale: "pt-BR", schemaVersion: 1 });
  assert.deepEqual(await loadProjectLocale(first, true), { locale: "pt-BR", invalid: false });
  assert.deepEqual(await loadProjectLocale(second, true), { locale: "en", invalid: false });
  assert.deepEqual(await loadProjectLocale(first, false), { locale: "en", invalid: false });
  await assert.rejects(saveProjectLocale(second, false, "pt-BR"), /trusted-project-required/);
  await assert.rejects(stat(join(second, ".pi")), { code: "ENOENT" });
});

test("missing and malformed project locales fail closed to English", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-autoskills-locale-invalid-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pref = join(root, ".pi", "pi-autoskills.locale.json");
  await mkdir(join(root, ".pi"));
  assert.deepEqual(await loadProjectLocale(root, true), { locale: "en", invalid: false });
  await writeFile(pref, "{broken", "utf8");
  assert.deepEqual(await loadProjectLocale(root, true), { locale: "en", invalid: true });
  await writeFile(pref, JSON.stringify({ schemaVersion: 1, locale: "fr" }), "utf8");
  assert.deepEqual(await loadProjectLocale(root, true), { locale: "en", invalid: true });
});

test("aborted or failed writes leave the locale draft available and no temporary file", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-autoskills-locale-write-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(saveProjectLocale(root, true, "pt-BR", abort.signal), /operation-cancelled/);
  await assert.rejects(stat(join(root, ".pi")), { code: "ENOENT" });

  const blocked = join(root, ".pi", "pi-autoskills.locale.json");
  await mkdir(blocked, { recursive: true });
  await assert.rejects(saveProjectLocale(root, true, "pt-BR"));
  assert.equal((await stat(blocked)).isDirectory(), true);
  assert.deepEqual(await readdir(join(root, ".pi")), ["pi-autoskills.locale.json"]);
});
