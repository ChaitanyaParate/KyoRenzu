const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

// Linux portability & sandbox switches
if (process.platform === 'linux') {
  // Support Wayland and X11 seamlessly via Chromium Ozone
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
  // Safe unprivileged user namespace fallback for Ubuntu 24.04+ / Fedora AppArmor
  app.commandLine.appendSwitch('no-sandbox');
}

let mainWindow;
let pythonProcess = null;
let activePort = 8000;

function getAvailablePort(startPort, callback) {
  const server = net.createServer();
  server.unref();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      getAvailablePort(startPort + 1, callback);
    } else {
      callback(startPort);
    }
  });
  server.listen(startPort, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => {
      callback(port);
    });
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'logo.png')
  });

  // Hide menu bar
  mainWindow.setMenuBarVisibility(false);

  // In production, load the built React app with port query parameter. In dev, load localhost:5173
  const isDev = !app.isPackaged;
  if (isDev) {
    const devUrl = (process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173') + `?port=${port}`;
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'web/dist/index.html'), {
      query: { port: String(port) }
    });
  }

  // Pre-seed window global variables once DOM begins loading
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(
      `window.__KYORENZU_PORT__ = ${port}; window.__KYORENZU_API_BASE__ = 'http://localhost:${port}';`
    ).catch(() => {});
  });
}

function startPythonBackend(port) {
  const isDev = !app.isPackaged;

  if (isDev) {
    console.log(`Running in dev mode. Assuming Python backend is running on port ${port} or started manually.`);
  } else {
    const binaryPath = path.join(process.resourcesPath, 'api', 'api');
    
    console.log(`Starting bundled Python backend on port ${port}:`, binaryPath);
    pythonProcess = spawn(binaryPath, [], {
      detached: true,
      stdio: 'pipe',
      env: {
        ...process.env,
        KYORENZU_PORT: String(port)
      }
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python stdout: ${data}`);
    });
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      pythonProcess = null;
    });
  }
}

function teardownPythonBackend() {
  if (pythonProcess && pythonProcess.pid) {
    try {
      if (process.platform !== 'win32') {
        // Send SIGTERM to process group so api.py lifespan and atexit fire cleanly
        process.kill(-pythonProcess.pid, 'SIGTERM');
      } else {
        pythonProcess.kill();
      }
    } catch (e) {
      // Process might already be dead
    }
    pythonProcess = null;
  }
}

function waitForServer(url, timeout, callback) {
  const start = Date.now();
  
  function ping() {
    http.get(url, (res) => {
      if (res.statusCode === 200 || res.statusCode === 404) { // Server is up
        callback();
      } else {
        retry();
      }
    }).on('error', retry);
  }

  function retry() {
    if (Date.now() - start > timeout) {
      console.error('Timeout waiting for python server to start');
      callback(); // Try anyway
      return;
    }
    setTimeout(ping, 500);
  }
  
  ping();
}

app.whenReady().then(() => {
  const preferredPort = parseInt(process.env.KYORENZU_PORT || '8000', 10);
  getAvailablePort(preferredPort, (selectedPort) => {
    activePort = selectedPort;
    startPythonBackend(activePort);
    
    // Wait for the FastAPI server to come up before loading the UI (avoid blank screen / API errors)
    waitForServer(`http://127.0.0.1:${activePort}/api/system/status`, 30000, () => {
      createWindow(activePort);
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(activePort);
    }
  });
});

app.on('window-all-closed', () => {
  teardownPythonBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  teardownPythonBackend();
});

process.on('SIGINT', () => {
  teardownPythonBackend();
  process.exit(0);
});

process.on('SIGTERM', () => {
  teardownPythonBackend();
  process.exit(0);
});
