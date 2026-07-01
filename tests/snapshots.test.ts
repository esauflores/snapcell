import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({}));

import { importsCode as snapImportsCode } from '../src/snapshots';

// snapshotCode and restoreCode aren't exported — test via takeSnapshot/restoreSnapshot patterns
// but we can test importsCode which is exported

describe('importsCode', () => {
  it('wraps imports with # %% [snapcell] prefix', () => {
    const result = snapImportsCode('import os\nimport sys');
    expect(result).toBe('# %% [snapcell] imports\nimport os\nimport sys');
  });

  it('handles empty string', () => {
    const result = snapImportsCode('');
    expect(result).toBe('# %% [snapcell] imports\n');
  });
});
