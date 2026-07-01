import { describe, it, expect, vi } from 'vitest';

// Build a lightweight vscode mock for extension command handlers
const mockShowInfo = vi.fn();
const mockShowError = vi.fn();
const mockShowWarning = vi.fn();
const mockShowQuickPick = vi.fn();
const mockExecuteCommand = vi.fn();
const mockRegisterCommand = vi.fn();
const mockGetConfiguration = vi.fn();
const mockRegisterCodeLensProvider = vi.fn();

vi.mock('vscode', () => ({
  // Classes used by imports (codelens, cellParser)
  Range: class { constructor() {} },
  CodeLens: class { constructor() {} },
  EventEmitter: class {
    event = () => ({ dispose: () => {} });
    fire() {}
    dispose() {}
  },
  // Window API
  window: {
    showInformationMessage: mockShowInfo,
    showErrorMessage: mockShowError,
    showWarningMessage: mockShowWarning,
    showQuickPick: mockShowQuickPick,
    activeTextEditor: undefined,
  },
  // Commands API
  commands: {
    registerCommand: mockRegisterCommand,
    executeCommand: mockExecuteCommand,
  },
  // Workspace API
  workspace: {
    getConfiguration: mockGetConfiguration,
    workspaceFolders: undefined,
  },
  // Extensions API
  extensions: {
    getExtension: vi.fn(),
  },
  // Languages API
  languages: {
    registerCodeLensProvider: mockRegisterCodeLensProvider,
  },
}));

describe('extension activation', () => {
  it('registers 4 commands on activate', async () => {
    mockGetConfiguration.mockReturnValue({
      get: vi.fn((key: string, fallback: string | number) => fallback),
    });

    const mod = await import('../src/extension');
    const ctx = {
      subscriptions: [] as { dispose(): void }[],
      extensionPath: '/test',
    };

    mod.activate(ctx as any);

    expect(mockRegisterCommand).toHaveBeenCalledTimes(4);
    expect(mockRegisterCommand).toHaveBeenCalledWith(
      'snapcell.snapshot',
      expect.any(Function),
    );
    expect(mockRegisterCommand).toHaveBeenCalledWith(
      'snapcell.restoreSnapshot',
      expect.any(Function),
    );
    expect(mockRegisterCommand).toHaveBeenCalledWith(
      'snapcell.runAboveAndSnapshotCell',
      expect.any(Function),
    );
    expect(mockRegisterCommand).toHaveBeenCalledWith(
      'snapcell.runBelowCell',
      expect.any(Function),
    );
    expect(mockRegisterCodeLensProvider).toHaveBeenCalled();
  });
});
