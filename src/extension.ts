import * as vscode from 'vscode';
import * as path from 'path';
import { parseCells, extractAllImports } from './cellParser';
import {
  takeSnapshot,
  restoreSnapshot,
  listSnapshots,
  executeInKernel,
  executeCell,
  importsCode as snapImportsCode,
  setLabel,
} from './snapshots';
import { snapcellCodeLensProvider } from './codelens';

let active = false;
let extensionPath = '';

async function ensureActive(): Promise<boolean> {
  if (active) return true;

  const jupyterExt = vscode.extensions.getExtension('ms-toolsai.jupyter');
  if (!jupyterExt) {
    vscode.window.showErrorMessage('Snapcell: Jupyter extension required (ms-toolsai.jupyter)');
    return false;
  }

  active = true;
  await vscode.commands.executeCommand('setContext', 'snapcell.reactive', true);
  return true;
}

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getCellAtCursor(): number | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const cells = parseCells(editor.document.getText());
  const line = editor.selection.active.line;
  const cell = cells.find((c) => line >= c.range.startLine && line < c.range.endLine);
  return cell?.index;
}

async function handleSnapshot(): Promise<void> {
  if (!(await ensureActive())) return;
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('No workspace folder');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'python') return;

  const atCell = getCellAtCursor();
  if (atCell === undefined) {
    vscode.window.showErrorMessage('Cursor not inside a cell');
    return;
  }

  const sourceFile = path.basename(editor.document.fileName, path.extname(editor.document.fileName));

  try {
    const filename = await takeSnapshot(root, atCell, sourceFile);
    const label = await vscode.window.showInputBox({
      prompt: 'Snapshot label (optional)',
      placeHolder: 'e.g. after data load',
    });
    if (label) {
      setLabel(root, filename, label);
    }
    vscode.window.showInformationMessage(`Snapshot saved at cell ${atCell + 1}`);
  } catch (err) {
    vscode.window.showErrorMessage(`Snapshot failed: ${err}`);
  }
}

async function handleRunAboveAndSnapshotCell(cellIndex: number): Promise<void> {
  if (!(await ensureActive())) return;
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('No workspace folder');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'python') return;

  const cells = parseCells(editor.document.getText());
  const sourceFile = path.basename(editor.document.fileName, path.extname(editor.document.fileName));

  try {
    for (const cell of cells) {
      if (cell.index >= cellIndex) break;
      if (!cell.code) continue;
      await executeCell(root, cell.index, cell.code);
    }
    await takeSnapshot(root, cellIndex, sourceFile);
    vscode.window.showInformationMessage(`Snapcell: Ran above + snapshot at cell ${cellIndex + 1}`);
  } catch (err) {
    vscode.window.showErrorMessage(`Snapcell: ${err}`);
  }
}

async function handleRunBelowCell(cellIndex: number): Promise<void> {
  if (!(await ensureActive())) return;
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('No workspace folder');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'python') return;

  const cells = parseCells(editor.document.getText());
  if (cells.length === 0) {
    vscode.window.showWarningMessage('No # %% cells found');
    return;
  }

  const snapshots = await listSnapshots(root);
  if (snapshots.length === 0) {
    vscode.window.showInformationMessage('No snapshots found');
    return;
  }

  const pick = await vscode.window.showQuickPick(
    snapshots.map((s) => s.display),
    { placeHolder: 'Select snapshot to restore' },
  );
  if (!pick) return;

  const entry = snapshots.find((s) => s.display === pick);
  if (!entry) return;

  try {
    const allImports = await extractAllImports(cells, extensionPath);
    if (allImports) {
      await executeInKernel(snapImportsCode(allImports));
    }

    await restoreSnapshot(root, entry.filename);

    for (const cell of cells) {
      if (cell.index < cellIndex) continue;
      if (!cell.code) continue;
      await executeCell(root, cell.index, cell.code);
    }
    const runCount = cells.filter((c) => c.index >= cellIndex && c.code).length;
    vscode.window.showInformationMessage(
      `Snapcell: Restored + ran ${runCount} cells from cell ${cellIndex + 1}`,
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Snapcell: ${err}`);
  }
}

async function handleRestoreSnapshot(): Promise<void> {
  if (!(await ensureActive())) return;
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('No workspace folder');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'python') return;

  const cells = parseCells(editor.document.getText());
  if (cells.length === 0) {
    vscode.window.showWarningMessage('No # %% cells found');
    return;
  }

  const snapshots = await listSnapshots(root);
  if (snapshots.length === 0) {
    vscode.window.showInformationMessage('No snapshots found');
    return;
  }

  const pick = await vscode.window.showQuickPick(
    snapshots.map((s) => s.display),
    { placeHolder: 'Select snapshot to restore' },
  );
  if (!pick) return;

  const entry = snapshots.find((s) => s.display === pick);
  if (!entry) return;

  try {
    const allImports = await extractAllImports(cells, extensionPath);
    if (allImports) {
      await executeInKernel(snapImportsCode(allImports));
    }

    await restoreSnapshot(root, entry.filename);

    vscode.window.showInformationMessage('Snapshot restored');
  } catch (err) {
    vscode.window.showErrorMessage(`Restore failed: ${err}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  extensionPath = context.extensionPath;

  context.subscriptions.push(vscode.commands.registerCommand('snapcell.snapshot', handleSnapshot));
  context.subscriptions.push(
    vscode.commands.registerCommand('snapcell.restoreSnapshot', handleRestoreSnapshot),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'snapcell.runAboveAndSnapshotCell',
      handleRunAboveAndSnapshotCell,
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('snapcell.runBelowCell', handleRunBelowCell),
  );

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: 'python' }, snapcellCodeLensProvider),
  );
}
