import { execFile } from 'child_process';

interface CellRange {
  startLine: number;
  endLine: number;
}

interface Cell {
  index: number;
  range: CellRange;
  code: string;
}

function parseCells(documentText: string): Cell[] {
  const lines = documentText.split('\n');
  const cellBoundaries: number[] = [0];

  for (let i = 0; i < lines.length; i++) {
    if (/^#\s*%%/.test(lines[i].trim()) && i > 0) {
      cellBoundaries.push(i);
    }
  }

  const cells: Cell[] = [];
  for (let i = 0; i < cellBoundaries.length; i++) {
    const startLine = cellBoundaries[i];
    const endLine = i + 1 < cellBoundaries.length ? cellBoundaries[i + 1] : lines.length;
    const cellLines = lines.slice(startLine, endLine);
    const code = cellLines
      .filter((l) => !/^\s*#\s*%%/.test(l.trim()))
      .join('\n')
      .trim();

    cells.push({
      index: i,
      range: { startLine, endLine },
      code,
    });
  }

  return cells;
}

function extractAllImports(cells: Cell[], extensionPath: string): Promise<string> {
  return new Promise((resolve) => {
    const fullSource = cells.map((c) => c.code).join('\n');
    if (!fullSource.trim()) {
      resolve('');
      return;
    }

    const script = `${extensionPath}/src/python/extract_imports.py`;
    const child = execFile('python3', [script], { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        resolve('');
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result.imports || '');
      } catch {
        resolve('');
      }
    });

    child.stdin?.write(fullSource);
    child.stdin?.end();
  });
}

export { parseCells, extractAllImports };
