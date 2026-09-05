const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let pythonProcess = null;

function createWindow() {
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

  // In production, load the built React app. In dev, load localhost:3000
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'web/dist/index.html'));
  }
}

function startPythonBackend() {
  const isDev = !app.isPackaged;
  let scriptPath;

  if (isDev) {
    // In dev, assuming the user manually starts `uvicorn api:app`
    // Or we could spawn `python api.py`
    console.log("Running in dev mode. Assuming Python backend is running or will be started manually.");
  } else {
    // In production, execute the bundled PyInstaller binary
    // The PyInstaller binary will be placed inside the resources folder or alongside the app
    const binaryPath = path.join(process.resourcesPath, 'api', 'api');
    
    console.log("Starting bundled Python backend:", binaryPath);
    pythonProcess = spawn(binaryPath, [], { stdio: 'pipe' });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python stdout: ${data}`);
    });
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
    });
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
  startPythonBackend();
  
  // Wait for the FastAPI server to come up before loading the UI (avoid blank screen / API errors)
  waitForServer('http://127.0.0.1:8000/docs', 10000, () => {
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
