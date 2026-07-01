import * as vscode from 'vscode';
import { parseCells } from './cellParser';

const snapcellCodeLensProvider: vscode.CodeLensProvider = {
  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    if (document.languageId !== 'python') return [];

    const cells = parseCells(document.getText());
    const lenses: vscode.CodeLens[] = [];

    for (const cell of cells) {
      const range = new vscode.Range(cell.range.startLine, 0, cell.range.startLine, 0);

      if (cell.index > 0) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: 'Run Above & Snap',
            command: 'snapcell.runAboveAndSnapshotCell',
            arguments: [cell.index],
          }),
        );
      }

      lenses.push(
        new vscode.CodeLens(range, {
          title: 'Run Below & Snap',
          command: 'snapcell.runBelowCell',
          arguments: [cell.index],
        }),
      );
    }

    return lenses;
  },
};

export { snapcellCodeLensProvider };
