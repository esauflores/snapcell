import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

function snapshotDir(workspaceRoot: string): string {
  const config = vscode.workspace.getConfiguration('snapcell');
  const relPath = config.get<string>('snapshotPath', '.snapcell/snapshots');
  const dir = path.join(workspaceRoot, relPath);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function snapshotCode(filepath: string): string {
  const escaped = filepath.replace(/\\/g, '\\\\');
  return `try:
    import dill as pickle
except ImportError:
    import pickle
import os, types, traceback
_user_ns = dict(globals())
_skip = {'In', 'Out', 'exit', 'quit', 'get_ipython'}
for _k in _skip:
    _user_ns.pop(_k, None)
_data = {}
for _k, _v in _user_ns.items():
    if _k.startswith('_'): continue
    if isinstance(_v, types.ModuleType): continue
    if isinstance(_v, type): continue
    if callable(_v): continue
    try:
        pickle.dumps(_v)
        _data[_k] = _v
    except (TypeError, pickle.PicklingError, AttributeError):
        pass
try:
    os.makedirs(os.path.dirname(r"${escaped}"), exist_ok=True)
    with open(r"${escaped}", 'wb') as _f:
        pickle.dump(_data, _f, protocol=pickle.HIGHEST_PROTOCOL)
    open(r"${escaped}.done", 'w').close()
    print(f"[snapcell] saved {len(_data)} vars")
except Exception as _e:
    print(f"[snapcell] snapshot failed: {_e}")
    traceback.print_exc()
    raise
`;
}

function importsCode(allImports: string): string {
  return allImports;
}

function restoreCode(filepath: string): string {
  const escaped = filepath.replace(/\\/g, '\\\\');
  return `try:
    import dill as pickle
except ImportError:
    import pickle
import traceback
try:
    _user_ns = globals()
    with open(r"${escaped}", 'rb') as _f:
        _data = pickle.load(_f)
    for _k, _v in _data.items():
        _user_ns[_k] = _v
    open(r"${escaped}.done", 'w').close()
    print(f"[snapcell] restored {len(_data)} vars")
except Exception as _e:
    print(f"[snapcell] restore failed: {_e}")
    traceback.print_exc()
    raise
`;
}

function indexFile(workspaceRoot: string): string {
  return path.join(snapshotDir(workspaceRoot), '.index.json');
}

interface IndexEntry {
  cell: number;
  label?: string;
}

function readIndex(workspaceRoot: string): Record<string, IndexEntry> {
  try {
    const raw = JSON.parse(fs.readFileSync(indexFile(workspaceRoot), 'utf-8'));
    const index: Record<string, IndexEntry> = {};
    for (const [k, v] of Object.entries(raw)) {
      index[k] = typeof v === 'number' ? { cell: v } : v as IndexEntry;
    }
    return index;
  } catch {
    return {};
  }
}

function writeIndex(workspaceRoot: string, index: Record<string, IndexEntry>): void {
  fs.writeFileSync(indexFile(workspaceRoot), JSON.stringify(index, null, 2));
}

function setLabel(workspaceRoot: string, filename: string, label: string): void {
  const index = readIndex(workspaceRoot);
  if (index[filename]) {
    index[filename].label = label;
    writeIndex(workspaceRoot, index);
  }
}

function waitForSentinel(filepath: string, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const dir = path.dirname(filepath);
    const sentinel = path.basename(filepath) + '.done';
    const watcher = fs.watch(dir, (_event, f) => {
      if (f === sentinel && fs.existsSync(filepath + '.done')) {
        clearTimeout(timeout);
        watcher.close();
        fs.unlinkSync(filepath + '.done');
        resolve();
      }
    });
    const timeout = setTimeout(() => {
      watcher.close();
      reject(new Error('Timed out waiting for kernel.'));
    }, timeoutMs);
    if (fs.existsSync(filepath + '.done')) {
      clearTimeout(timeout);
      watcher.close();
      fs.unlinkSync(filepath + '.done');
      resolve();
    }
  });
}

async function executeInKernel(code: string): Promise<void> {
  await vscode.commands.executeCommand('jupyter.execSelectionInteractive', code);
}

async function executeCell(_workspaceRoot: string, _cellIndex: number, code: string): Promise<void> {
  await executeInKernel(code);
  await new Promise((r) => setTimeout(r, 500));
}

async function takeSnapshot(workspaceRoot: string, atCell: number, sourceFile: string): Promise<string> {
  const dir = snapshotDir(workspaceRoot);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filepath = path.join(dir, `snap_${sourceFile}_cell${atCell + 1}_${ts}.pkl`);

  await executeInKernel(snapshotCode(filepath));
  await waitForSentinel(filepath, 60000);

  if (!fs.existsSync(filepath)) {
    throw new Error('Snapshot file not written by kernel.');
  }

  const filename = path.basename(filepath);
  const index = readIndex(workspaceRoot);
  index[filename] = { cell: atCell };

  const max = vscode.workspace.getConfiguration('snapcell').get<number>('maxSnapshots', 10);
  const all = await listSnapshots(workspaceRoot);
  for (const s of all.reverse().slice(0, all.length - max)) {
    fs.unlinkSync(path.join(dir, s.filename));
    delete index[s.filename];
  }

  writeIndex(workspaceRoot, index);
  return filename;
}

async function restoreSnapshot(workspaceRoot: string, filename: string): Promise<void> {
  const dir = snapshotDir(workspaceRoot);
  const filepath = path.join(dir, filename);
  if (!fs.existsSync(filepath)) throw new Error(`Snapshot not found: ${filename}`);

  await executeInKernel(restoreCode(filepath));
  await waitForSentinel(filepath, 60000);
}

interface SnapshotEntry {
  filename: string;
  display: string;
}

async function listSnapshots(workspaceRoot: string): Promise<SnapshotEntry[]> {
  const dir = snapshotDir(workspaceRoot);
  const index = readIndex(workspaceRoot);
  try {
    const files = fs.readdirSync(dir);
    return files
      .filter((f) => f.startsWith('snap_') && f.endsWith('.pkl'))
      .sort()
      .reverse()
      .map((f) => ({ filename: f, display: index[f]?.label || f }));
  } catch {
    return [];
  }
}

export { takeSnapshot, restoreSnapshot, listSnapshots, executeInKernel, executeCell, importsCode, setLabel };
