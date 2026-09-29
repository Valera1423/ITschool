import { describe, it, expect } from 'vitest';
import { VersionsService } from '../src/services/versions.service.js';

describe('VersionsService', () => {
  it('сохраняет и читает версию', async () => {
    const entityId = '00000000-0000-0000-0000-000000000001';

    await VersionsService.save(
      '__test_versions__',
      entityId,
      { foo: 'bar', v: 1 },
      { note: 'test' },
      { authorId: null, authorName: 'test', comment: 'init' },
    );

    const list = await VersionsService.list('__test_versions__', entityId);
    expect(list.length).toBeGreaterThan(0);

    const full = await VersionsService.get('__test_versions__', entityId, list[0].version);
    expect(full?.snapshot).toEqual({ foo: 'bar', v: 1 });
  });

  it('диффит две версии', async () => {
    const entityId = '00000000-0000-0000-0000-000000000002';

    await VersionsService.save('__test_diff__', entityId, { x: 1 }, {}, {
      authorId: null, authorName: 't', comment: 'v1',
    });
    await VersionsService.save('__test_diff__', entityId, { x: 2 }, {}, {
      authorId: null, authorName: 't', comment: 'v2',
    });

    const d = await VersionsService.diff('__test_diff__', entityId, 1, 2);
    expect(d?.changes.length).toBe(1);
    expect(d?.changes[0].field).toBe('x');
    expect(d?.changes[0].before).toBe(1);
    expect(d?.changes[0].after).toBe(2);
  });
});