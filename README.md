# Snapcell

Checkpoint your Python `# %%` cells. Save kernel state as a snapshot, restore it, and skip re-running upstream code.

## Usage

Open a `.py` file with `# %%` cell markers in VS Code. Run any cell to start the Python kernel.

Each cell gets two CodeLens buttons above it:

| Button               | What it does                                                                          |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Run Above & Snap** | Runs every cell above the current one, then pickles all variables into a snapshot     |
| **Run Below & Snap** | Pick a snapshot → restores its variables → runs the current cell and everything below |

You can also use the command palette (`Ctrl+Shift+P`):

- **Snapcell: Take Snapshot** — save the kernel's current variables at the cursor's cell
- **Snapcell: Restore Snapshot** — pick a snapshot and load its variables into the kernel

### Keybindings

| Command          | Shortcut           |
| ---------------- | ------------------ |
| Take Snapshot    | `Ctrl+Shift+Alt+S` |
| Restore Snapshot | `Ctrl+Shift+Alt+R` |

### Configuration

| Setting                 | Default               | Description                                   |
| ----------------------- | --------------------- | --------------------------------------------- |
| `snapcell.snapshotPath` | `.snapcell/snapshots` | Where to store snapshot files                 |
| `snapcell.maxSnapshots` | `10`                  | Oldest snapshots are pruned beyond this limit |

### Requirements

- VS Code ≥ 1.85
- [Jupyter extension](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter) (`ms-toolsai.jupyter`)
- Python ≥ 3.11 with `ipykernel<7`

---

## How it works

### Architecture

```
User .py file (# %% cells)
        │
        ▼
  VS Code Python editor
        │
   ┌────┴──────┐
   │  CodeLens │  ← "Run Above & Snap" / "Run Below & Snap"
   └────┬──────┘
        │
   ┌────┴───────────┐
   │  extension.ts  │  ← command handlers
   └────┬───────────┘
        │
   ┌────┴────────────┐
   │  cellParser.ts  │  ← parse # %% cells into { index, range, code }
   │  snapshots.ts   │  ← pickle/restore logic + cleanup
   └────┬────────────┘
        │
   ┌────┴───────────────────────────┐
   │  ms-toolsai.jupyter extension  │  ← kernel execution
   │  (Python ≥ 3.11, ipykernel)    │
   └────────────────────────────────┘
        │
   .snapcell/snapshots/
       ├── snap_<timestamp>.pkl    ← pickled variable namespaces
       └── .index.json             ← { filename: cellIndex }
```

### Source files

| File                            | Role                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/extension.ts`              | Entry point. Registers 4 commands, the CodeLens provider, and the `ensureActive` guard that checks for the Jupyter extension.                                                                                                                                                                  |
| `src/cellParser.ts`             | Splits document text on `# %%` into `Cell[]` with line ranges and code. `extractAllImports()` spawns `python3 extract_imports.py` as a subprocess, piping all cell source via stdin and reading back a JSON object with the combined import statements extracted via `ast`.                    |
| `src/snapshots.ts`              | Core engine. Builds Python snippets that `pickle.dump()` / `pickle.load()` the kernel's `globals()` dict, filtering out modules, types, callables, and unpicklable objects. Tracks which cell each snapshot belongs to in `.index.json`. Prunes old snapshots when `maxSnapshots` is exceeded. |
| `src/codelens.ts`               | Plain `CodeLensProvider` object. Returns a "Run Below & Snap" button on every cell, plus "Run Above & Snap" on every cell except the first.                                                                                                                                                    |
| `src/python/extract_imports.py` | Reads Python source from stdin, uses `ast.parse()` + `ast.unparse()` to collect top-level `import`/`from` statements, prints them as JSON. Handles multi-line imports correctly.                                                                                                               |

### Snapshot flow

**Taking a snapshot** (`takeSnapshot`):

1. Build a Python snippet that iterates `globals()`, skips builtins/private/module/type/callable variables, tests each with `pickle.dumps()` for picklability, then `pickle.dump()` to a `.pkl` file.
2. Send the snippet to the Jupyter kernel via `jupyter.execSelectionInteractive`.
3. Verify the `.pkl` file exists on disk — if not, throw `No active Python kernel`.
4. Record `{ filename: cellIndex }` in `.index.json`.
5. Prune oldest snapshots if count exceeds `maxSnapshots`, deleting files and index entries.

**Restoring a snapshot** (`restoreSnapshot`):

1. Extract all `import`/`from` statements from every cell in the document using the Python AST helper.
2. Send the imports to the kernel with a `# %% [snapcell] imports` marker so they appear as a labeled cell in the Interactive Window.
3. Send a restore snippet to the kernel (`pickle.load()` → assign each key to `globals()`), prefixed with `# %% [snapcell] restore`.
4. If restoring via "Run Below & Snap" (CodeLens), run every cell from the current position to the end of the file.

### Dill fallback

Both the snapshot and restore Python snippets try `import dill as pickle` first. If `dill` is installed, it can serialize a wider range of Python objects (lambdas, closures, generators). Falls back to stdlib `pickle` if not installed.

### Tests

17 vitest tests in `tests/`:

| Test file            | Covers                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `cellParser.test.ts` | `# %%` splitting, code extraction, line ranges, empty cells, indices                              |
| `snapshots.test.ts`  | `importsCode` prefix wrapping                                                                     |
| `codelens.test.ts`   | Non-python → empty, first cell → Run Below only, subsequent cells → both buttons, range positions |
| `extension.test.ts`  | `activate()` registers 4 commands + CodeLens provider                                             |

Run with `just test` or `npm test`.
