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

function readIndex(workspaceRoot: string): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(indexFile(workspaceRoot), 'utf-8'));
  } catch {
    return {};
  }
}

function writeIndex(workspaceRoot: string, index: Record<string, number>): void {
  fs.writeFileSync(indexFile(workspaceRoot), JSON.stringify(index, null, 2));
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

async function executeCell(_workspaceRoot: string, cellIndex: number, code: string): Promise<void> {
  await executeInKernel(`# %% [snapcell] cell ${cellIndex}\n${code}`);
  await new Promise((r) => setTimeout(r, 300));
}

async function takeSnapshot(workspaceRoot: string, atCell: number): Promise<void> {
  const dir = snapshotDir(workspaceRoot);
  const filepath = path.join(dir, `snap_${new Date().toISOString().replace(/[:.]/g, '-')}.pkl`);

  await executeInKernel(snapshotCode(filepath));
  await waitForSentinel(filepath, 60000);

  if (!fs.existsSync(filepath)) {
    throw new Error('Snapshot file not written by kernel.');
  }

  const filename = path.basename(filepath);
  const index = readIndex(workspaceRoot);
  index[filename] = atCell;

  const max = vscode.workspace.getConfiguration('snapcell').get<number>('maxSnapshots', 10);
  const snapshots = await listSnapshots(workspaceRoot);
  for (const f of snapshots.reverse().slice(0, snapshots.length - max)) {
    fs.unlinkSync(path.join(dir, f));
    delete index[f];
  }

  writeIndex(workspaceRoot, index);
}

async function restoreSnapshot(workspaceRoot: string, filename: string): Promise<void> {
  const dir = snapshotDir(workspaceRoot);
  const filepath = path.join(dir, filename);
  if (!fs.existsSync(filepath)) throw new Error(`Snapshot not found: ${filename}`);

  await executeInKernel(restoreCode(filepath));
  await waitForSentinel(filepath, 60000);
}

async function listSnapshots(workspaceRoot: string): Promise<string[]> {
  const dir = snapshotDir(workspaceRoot);
  try {
    const files = fs.readdirSync(dir);
    return files
      .filter((f) => f.startsWith('snap_') && f.endsWith('.pkl'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export { takeSnapshot, restoreSnapshot, listSnapshots, executeInKernel, executeCell, importsCode };
