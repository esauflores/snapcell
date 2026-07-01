import { describe, it, expect, vi } from 'vitest';
import { Range, CodeLens, EventEmitter, CancellationToken, mockTextDocument } from './helpers';

const token = new CancellationToken();

vi.mock('vscode', () => ({
  Range,
  CodeLens,
  EventEmitter,
  CancellationToken,
}));

import { snapcellCodeLensProvider } from '../src/codelens';

function lenses(doc: ReturnType<typeof mockTextDocument>): CodeLens[] {
  return snapcellCodeLensProvider.provideCodeLenses(doc as any, token as any) as unknown as CodeLens[];
}

describe('snapcellCodeLensProvider', () => {
  it('returns empty for non-python documents', () => {
    expect(lenses(mockTextDocument(['# %%', 'x = 1'], 'javascript'))).toHaveLength(0);
  });

  it('returns single Run Below for python file with no cell markers', () => {
    const ls = lenses(mockTextDocument(['x = 1', 'y = 2']));
    expect(ls).toHaveLength(1);
    expect(ls[0].command?.title).toBe('Run Below & Snap');
  });

  it('gives first cell only Run Below & Snap', () => {
    const ls = lenses(mockTextDocument(['# %%', 'a = 1', '# %%', 'b = 2']));
    expect(ls).toHaveLength(3);
    expect(ls[0].command?.title).toBe('Run Below & Snap');
    expect(ls[0].command?.command).toBe('snapcell.runBelowCell');
    expect(ls[0].command?.arguments).toEqual([0]);
  });

  it('gives subsequent cells both buttons', () => {
    const ls = lenses(mockTextDocument(['# %%', 'a = 1', '# %%', 'b = 2', '# %%', 'c = 3']));
    expect(ls[0].command?.title).toBe('Run Below & Snap');
    expect(ls[0].command?.arguments).toEqual([0]);
    expect(ls[1].command?.title).toBe('Run Above & Snap');
    expect(ls[1].command?.command).toBe('snapcell.runAboveAndSnapshotCell');
    expect(ls[1].command?.arguments).toEqual([1]);
    expect(ls[2].command?.title).toBe('Run Below & Snap');
    expect(ls[2].command?.arguments).toEqual([1]);
    expect(ls[3].command?.title).toBe('Run Above & Snap');
    expect(ls[3].command?.arguments).toEqual([2]);
    expect(ls[4].command?.title).toBe('Run Below & Snap');
    expect(ls[4].command?.arguments).toEqual([2]);
  });

  it('sets lens range to start of cell marker line', () => {
    const ls = lenses(mockTextDocument(['a = 1', '# %%', 'b = 2']));
    expect(ls[0].range.startLine).toBe(0);
    expect(ls[1].range.startLine).toBe(1);
    expect(ls[2].range.startLine).toBe(1);
  });
});
