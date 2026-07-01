import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({}));

import { importsCode as snapImportsCode } from '../src/snapshots';

// snapshotCode and restoreCode aren't exported — test via takeSnapshot/restoreSnapshot patterns
// but we can test importsCode which is exported

describe('importsCode', () => {
  it('returns imports unchanged', () => {
    const result = snapImportsCode('import os\nimport sys');
    expect(result).toBe('import os\nimport sys');
  });

  it('handles empty string', () => {
    const result = snapImportsCode('');
    expect(result).toBe('');
  });
});
