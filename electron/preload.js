const { contextBridge } = require('electron')

// Expose only what the renderer needs via the context bridge.
// All API calls go through Axios → FastAPI, so no IPC needed at this stage.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
})
