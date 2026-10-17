import assert from 'node:assert/strict';
import { test } from 'node:test';
import { streamingDiagram, withoutDiagrams } from '../src/features/projects/draft.ts';

const candidate = {
  schema_version: 1, diagram_type: 'dataflow', meta: { title: 'Request pipeline' },
  stages: [{ label: 'Input' }, { label: 'Output' }],
  nodes: [{ id: 'input', type: 'frontend', label: 'Input', stage: 0, row: 0 }],
  flows: [],
};
test('A single candidate fence survives preview and final submission without duplicate JSON', () => {
  const text = 'Tracing the input to output.\n```json\n' + JSON.stringify(candidate) + '\n```';
  assert.deepEqual(streamingDiagram(text)?.diagram, candidate);
  // Tool progress is separate from assistant text; later narration must not clear the candidate.
  assert.deepEqual(streamingDiagram(text + '\nRead left to right.')?.diagram, candidate);
  assert.equal(withoutDiagrams(text + '\nRead left to right.'), 'Tracing the input to output.\n\nRead left to right.');
});
test('A corrected preview replaces the previous candidate and an incomplete retry does not become a diagram', () => {
  const first = '```json\n' + JSON.stringify(candidate) + '\n```';
  const corrected = { ...candidate, meta: { title: 'Corrected pipeline' } };
  assert.deepEqual(streamingDiagram(first + '\n```json\n' + JSON.stringify(corrected) + '\n```')?.diagram, corrected);
  assert.equal(streamingDiagram(first + '\n```json\n{"schema_version":1,'), null);
});
