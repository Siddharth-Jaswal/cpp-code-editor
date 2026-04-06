const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const nodeCommand = process.execPath;
const viteEntry = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const electronEntry = path.join(rootDir, 'node_modules', 'electron', 'cli.js');
const rendererUrl = 'http://127.0.0.1:5173';

let viteProcess = null;
let electronProcess = null;
let shuttingDown = false;

function spawnManagedProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: rootDir,
    stdio: 'ignore',
    windowsHide: true,
    ...options,
  });
}

function killProcessTree(processHandle) {
  if (!processHandle || processHandle.killed) {
    return;
  }

  if (isWindows) {
    const killer = spawn('taskkill', ['/pid', String(processHandle.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('error', () => {});
    return;
  }

  try {
    process.kill(-processHandle.pid, 'SIGTERM');
  } catch {
    try {
      processHandle.kill('SIGTERM');
    } catch {}
  }
}

function waitForRenderer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(tryConnect, 300);
      });

      request.setTimeout(2000, () => {
        request.destroy();
      });
    };

    tryConnect();
  });
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  killProcessTree(electronProcess);
  killProcessTree(viteProcess);

  setTimeout(() => {
    process.exit(code);
  }, 300);
}

async function main() {
  viteProcess = spawnManagedProcess(
    nodeCommand,
    [viteEntry, '--host', '127.0.0.1', '--port', '5173'],
    {
      detached: !isWindows,
    }
  );

  viteProcess.once('error', (error) => {
    console.error(error.message || error);
    shutdown(1);
  });

  viteProcess.once('exit', (code) => {
    if (!shuttingDown) {
      shutdown(code ?? 1);
    }
  });

  await waitForRenderer(rendererUrl);

  electronProcess = spawnManagedProcess(
    nodeCommand,
    [electronEntry, '.'],
    {
      detached: !isWindows,
      env: {
        ...process.env,
        ELECTRON_DEV_RUNNER: '1',
      },
    }
  );

  electronProcess.once('error', (error) => {
    console.error(error.message || error);
    shutdown(1);
  });

  electronProcess.once('exit', (code) => {
    shutdown(code ?? 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => {
  killProcessTree(electronProcess);
  killProcessTree(viteProcess);
});

main().catch((error) => {
  console.error(error.message || error);
  shutdown(1);
});
