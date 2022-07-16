const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portgasAPI', {
  saveAPIKeys: (object) => ipcRenderer.invoke('settings:saveKeys', object),
  homeRefresh: () => ipcRenderer.invoke('home:refreshWindow'),
  getAPIKeys: (object) => ipcRenderer.invoke('settings:getKeys', object),
  queryAPIKeys: () => ipcRenderer.invoke('settings:queryKeys'),
  toolSetStatus: (object) =>
    ipcRenderer.invoke('settings:saveToolStatus', object),
  toolGetStatus: () => ipcRenderer.invoke('settings:getStatus'),
  lookupIOC: (object) => ipcRenderer.sendSync('search:lookupIOC', object),
  lookupResults: () => ipcRenderer.sendSync('search:iocResults'),
  downloadResults: () => ipcRenderer.invoke('dialog:downloadResults'),
  showContextMenu: (object) => ipcRenderer.send('show-context-menu', object),
  returnContextMenuData: (type, object) =>
    ipcRenderer.once('context-menu-command', type, object),
  getResults: () => ipcRenderer.sendSync('results:get'),
});
