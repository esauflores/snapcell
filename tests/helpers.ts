// Minimal mocks for vscode classes used by codelens.ts and snapshots.ts
export class Range {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number,
  ) {}
}

export class CodeLens {
  public readonly range: Range;
  public readonly command?: { title: string; command: string; arguments?: unknown[] };
  constructor(
    range: Range,
    command?: { title: string; command: string; arguments?: unknown[] },
  ) {
    this.range = range;
    this.command = command;
  }
}

export class EventEmitter<T> {
  event = (_cb: (e: T) => void) => ({ dispose: () => {} });
  fire(): void {}
  dispose(): void {}
}

export class CancellationToken {
  isCancellationRequested = false;
  onCancellationRequested = (_cb: (e: unknown) => void) => ({ dispose: () => {} });
}

export function mockTextDocument(lines: string[], languageId = 'python') {
  return {
    languageId,
    getText: () => lines.join('\n'),
  };
}
