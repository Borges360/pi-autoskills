import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('Pi Autoskills specialization copies are identical and owned by this project', () => {
  const skill = read('.agents/skills/pi-autoskills/SKILL.md');
  const cursorSkill = read('.cursor/skills/pi-autoskills/SKILL.md');
  const metadata = read('.agents/skills/pi-autoskills/metadata.yaml');
  const cursorMetadata = read('.cursor/skills/pi-autoskills/metadata.yaml');
  assert.ok(skill.length > 0);
  assert.equal(cursorSkill, skill);
  assert.equal(cursorMetadata, metadata);
  for (const field of ['id: pi-autoskills', 'owner: pi-autoskills', 'version: 1.0.0', 'product-local; Pi, Codex and Cursor']) {
    assert.ok(metadata.includes(field), field);
  }
});

test('local product context names the skill without claiming shared design-system adoption', () => {
  const agents = read('AGENTS.md');
  const harness = agents.indexOf('<!-- harness:start -->');
  assert.ok(harness > 0);
  const preamble = agents.slice(0, harness);
  assert.ok(preamble.includes('.agents/skills/pi-autoskills/SKILL.md'));
  assert.ok(preamble.includes('do not infer'));
  assert.doesNotMatch(preamble, /INTEIRO/i);
});

test('specialization preserves the trusted-source and no-sibling-dependency rules', () => {
  const skill = read('.agents/skills/pi-autoskills/SKILL.md');
  const extension = read('src/extension.ts');
  const catalog = read('src/common/catalog.ts');
  assert.ok(extension.includes('register(pi, "pi-autoskills", "autoskills"'));
  assert.ok(catalog.includes('provenance-hash-mismatch'));
  for (const phrase of ['expected content hash', 'successful static audit', 'mandatory runtime dependency', 'trusted project', 'Ctrl+S']) {
    assert.ok(skill.includes(phrase), phrase);
  }
});
