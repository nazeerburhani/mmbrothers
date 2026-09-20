const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    readDB: (key) => ipcRenderer.sendSync('read-db', key),
    writeDB: (key, value) => ipcRenderer.sendSync('write-db', key, value),
    printReceipt: (options) => ipcRenderer.send('print-receipt', options),
    exportDB: () => ipcRenderer.invoke('export-db'),
    importDB: () => ipcRenderer.invoke('import-db'),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    copyImageToClipboard: (dataUrl) => ipcRenderer.invoke('copy-image-clipboard', dataUrl),
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
