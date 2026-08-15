import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  directivePatchBody,
  isDirectiveFormDirty,
  snapshotFromDirective,
} from '../lib/client-library/directive-edit-dirty';

// The guard's whole job: a dismissal must prompt when there are unsaved edits
// and must NOT prompt otherwise. Wrong in the false direction and the guard
// silently stops firing with no visible symptom — which is why this is a pure
// module rather than a comparison buried in the component.

const ROW = {
  title: 'Chat Started',
  description: null,
  directive_type: 'goal' as const,
  status: 'active' as const,
  project_key: 'NBLYCRO',
};

test('snapshotFromDirective normalises null → empty string', () => {
  // The controls hold strings; null would make them uncontrolled. Because the
  // snapshot AND the initial field values both come from here, the form opens
  // clean — the drift this single-producer arrangement exists to prevent.
  const snap = snapshotFromDirective(ROW);
  assert.equal(snap.description, '');
  assert.equal(snap.title, 'Chat Started');
  assert.equal(snap.projectKey, 'NBLYCRO');
  assert.equal(isDirectiveFormDirty(snap, snap), false, 'an untouched form is never dirty');
});

test('isDirectiveFormDirty: each field independently marks dirty', () => {
  const snap = snapshotFromDirective(ROW);
  // One field per case. A fixture changing two at once cannot tell you that both
  // are actually compared — drop either comparison and it still passes.
  assert.equal(isDirectiveFormDirty(snap, { ...snap, title: 'Renamed' }), true);
  assert.equal(isDirectiveFormDirty(snap, { ...snap, description: 'x' }), true);
  assert.equal(isDirectiveFormDirty(snap, { ...snap, directiveType: 'trigger' }), true);
  assert.equal(isDirectiveFormDirty(snap, { ...snap, status: 'archived' }), true);
  assert.equal(isDirectiveFormDirty(snap, { ...snap, projectKey: 'SPLCRO' }), true);
});

test('isDirectiveFormDirty: edit-then-revert is CLEAN', () => {
  // Dirty is measured against the OPENING SNAPSHOT, not a "was touched" flag.
  // A flag would prompt on a form that exactly matches what is stored.
  const snap = snapshotFromDirective(ROW);
  const edited = { ...snap, title: 'Something else' };
  assert.equal(isDirectiveFormDirty(snap, edited), true);
  assert.equal(isDirectiveFormDirty(snap, { ...edited, title: snap.title }), false);
});

test('directivePatchBody sends ONLY changed fields', () => {
  const snap = snapshotFromDirective(ROW);
  assert.deepEqual(directivePatchBody(snap, snap), {});
  assert.deepEqual(directivePatchBody(snap, { ...snap, title: 'Renamed' }), { title: 'Renamed' });
});

test('directivePatchBody NEVER sends an unchanged project_key', () => {
  // Load-bearing: the route keys its movability check on project_key differing
  // from stored. Sending it unconditionally would still be correct there — but
  // it makes the request describe a move that is not happening, and any future
  // "did the body ask to move?" check would then be wrong for every save.
  const snap = snapshotFromDirective(ROW);
  const body = directivePatchBody(snap, { ...snap, title: 'Renamed', description: 'why' });
  assert.equal('project_key' in body, false);
  assert.deepEqual(Object.keys(body).sort(), ['description', 'title']);
});

test('directivePatchBody maps a cleared description to null, and trims', () => {
  const withDesc = snapshotFromDirective({ ...ROW, description: 'some text' });
  // '' → null so the column goes back to NULL rather than storing an empty
  // string, which would then round-trip as '' and never compare equal to null.
  assert.deepEqual(directivePatchBody(withDesc, { ...withDesc, description: '' }), {
    description: null,
  });
  assert.deepEqual(directivePatchBody(withDesc, { ...withDesc, description: '   ' }), {
    description: null,
  });
  assert.deepEqual(directivePatchBody(withDesc, { ...withDesc, title: '  Padded  ' }), {
    title: 'Padded',
  });
});
