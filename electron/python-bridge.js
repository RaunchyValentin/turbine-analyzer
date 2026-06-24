const { spawn } = require('child_process')
const path = require('path')

let pythonProcess = null

async function startPython() {
  const backendDir = path.join(__dirname, '../backend')
  const pythonExe = process.platform === 'win32' ? 'python' : 'python3'

  pythonProcess = spawn(pythonExe, ['main.py'], {
    cwd: backendDir,
    stdio: 'inherit',
  })

  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python backend:', err)
  })

  // Give FastAPI time to bind its port before the window loads.
  await new Promise((resolve) => setTimeout(resolve, 1500))
}

async function stopPython() {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
}

module.exports = { startPython, stopPython }
