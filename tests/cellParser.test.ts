import { describe, it, expect } from 'vitest';
import { parseCells } from '../src/cellParser';

describe('parseCells', () => {
  it('returns single cell for text with no # %% markers', () => {
    const cells = parseCells('x = 1\ny = 2\nprint(x + y)');
    expect(cells).toHaveLength(1);
    expect(cells[0].index).toBe(0);
    expect(cells[0].code).toBe('x = 1\ny = 2\nprint(x + y)');
    expect(cells[0].range.startLine).toBe(0);
    expect(cells[0].range.endLine).toBe(3);
  });

  it('splits on # %% markers', () => {
    const cells = parseCells('a = 1\n# %%\nb = 2\n# %%\nc = 3');
    expect(cells).toHaveLength(3);
    expect(cells[0].code).toBe('a = 1');
    expect(cells[1].code).toBe('b = 2');
    expect(cells[2].code).toBe('c = 3');
  });

  it('strips the marker line from cell code', () => {
    const cells = parseCells('# %%\nx = 42');
    expect(cells).toHaveLength(1);
    expect(cells[0].code).toBe('x = 42');
  });

  it('handles indented # %% markers', () => {
    const cells = parseCells('  # %%\nx = 1\n  #  %%  \ny = 2');
    expect(cells).toHaveLength(2);
    expect(cells[0].code).toBe('x = 1');
    expect(cells[1].code).toBe('y = 2');
  });

  it('handles empty cells between markers', () => {
    const cells = parseCells('a = 1\n# %%\n\n# %%\nb = 2');
    expect(cells).toHaveLength(3);
    expect(cells[1].code).toBe('');
    expect(cells[2].code).toBe('b = 2');
  });

  it('handles empty input', () => {
    const cells = parseCells('');
    expect(cells).toHaveLength(1);
    expect(cells[0].code).toBe('');
  });

  it('handles multiline cell content', () => {
    const cells = parseCells(
      '# %%\nimport pandas as pd\ndf = pd.DataFrame({"a": [1, 2]})\nprint(df)\n# %%\nprint("done")',
    );
    expect(cells).toHaveLength(2);
    expect(cells[0].code).toBe(
      'import pandas as pd\ndf = pd.DataFrame({"a": [1, 2]})\nprint(df)',
    );
    expect(cells[1].code).toBe('print("done")');
  });

  it('sets correct cell indices', () => {
    const cells = parseCells('# %%\n# %%\n# %%');
    expect(cells).toHaveLength(3);
    expect(cells[0].index).toBe(0);
    expect(cells[1].index).toBe(1);
    expect(cells[2].index).toBe(2);
  });

  it('sets correct line ranges', () => {
    const cells = parseCells('a\nb\n# %%\nc\nd\ne\n# %%\nf');
    expect(cells[0].range).toEqual({ startLine: 0, endLine: 2 });
    expect(cells[1].range).toEqual({ startLine: 2, endLine: 6 });
    expect(cells[2].range).toEqual({ startLine: 6, endLine: 8 });
  });
});
