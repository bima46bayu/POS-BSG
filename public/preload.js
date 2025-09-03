// Preload script for secure communication between main and renderer processes
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Add any APIs you want to expose to the renderer process here
  // Example: openFile: () => ipcRenderer.invoke('dialog:openFile')
});
