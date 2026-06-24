const { app, BrowserWindow } = require('electron')
const path = require('path')
const { startPython, stopPython } = require('./python-bridge')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'))
  }
}

app.whenReady().then(async () => {
  await startPython()
  createWindow()
})

app.on('window-all-closed', async () => {
  await stopPython()
  if (process.platform !== 'darwin') app.quit()
})
