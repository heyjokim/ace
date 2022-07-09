const os = require('os');
const crypto = require('crypto');
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  dialog,
  Notification,
} = require('electron');
const Store = require('electron-store');
const path = require('path');
const https = require('https');

const MENUTEMPLATE = [
  {
    label: 'Ace',
    submenu: [
      {
        label: 'About Ace',
        selector: 'orderFrontStandardAboutPanel:',
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: () => {
          app.quit();
        },
      },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
      { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
      { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        selector: 'selectAll:',
      },
    ],
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'GitHub Link',
        click: async () => {
          const { shell } = require('electron');
          await shell.openExternal('https://github.com/heyjokim');
        },
      },
      {
        label: 'Twitter Link',
        click: async () => {
          const { shell } = require('electron');
          await shell.openExternal('https://twitter.com/heyjokim');
        },
      },
    ],
  },
];

function showNotification(msg) {
  new Notification({ title: 'Ace', body: msg }).show();
}

const RANDOMKEYGEN = crypto
  .createHash('md5')
  .update(os.hostname())
  .digest('hex');

const store = new Store({ encryptionKey: RANDOMKEYGEN });

async function dowloadResults() {
  const fs = require('fs');
  const options = {
    title: 'Download',
    filters: [{ name: 'Javascript', extensions: ['js', 'json'] }],
    properties: ['openFile'],
  };

  const outputFile = await dialog.showSaveDialog(options);
  if (outputFile.canceled) {
    return;
  }
  const output = store.get('results');
  fs.writeFile(outputFile.filePath, JSON.stringify(output, null, 4), (err) => {
    if (err) {
      console.log(err);
    } else {
      showNotification(`file ${outputFile.filePath} created`);
    }
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 730,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const menu = Menu.buildFromTemplate(MENUTEMPLATE);
  Menu.setApplicationMenu(menu);

  // mainWindow.openDevTools({ mode: 'detach' });
  mainWindow.loadFile('index.html');

  ipcMain.handle('dialog:downloadResults', dowloadResults);
  ipcMain.handle('settings:saveKeys', (event, object) => {
    return store.set(object);
  });

  ipcMain.handle('home:refreshWindow', () => {
    return mainWindow.reload();
  });

  ipcMain.handle('settings:queryKeys', () => {
    return store.get('api');
  });

  ipcMain.handle('settings:saveToolStatus', (event, object) => {
    return store.set(object);
  });

  ipcMain.handle('settings:getStatus', () => {
    return store.get('active');
  });

  ipcMain.handle('settings:getKeys', (event, object) => {
    return store.get(`api.${object}`);
  });

  ipcMain.on('search:iocResults', (event) => {
    event.returnValue = store.get('results');
  });

  ipcMain.on('search:lookupIOC', (event, object) => {
    store.delete('results');
    let activeTools = store.get('active');

    let activeToolsUrls = Object.entries(activeTools).map(([key, value]) => {
      if (value) {
        return srcLookup(object, key);
      }
    });
    Promise.allSettled(
      activeToolsUrls.map(async (e) => {
        for (let [key, value] of Object.entries(e)) {
          let intelResponse = await getRequest(value);
          store.set(`results.${key}`, intelResponse);
        }
      })
    ).then(() => {
      event.returnValue = store.get('results');
    });
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

function srcLookup(object, source) {
  let collectionID, nodeId;
  for (let [key, value] of Object.entries(object)) {
    collectionID = key;
    nodeId = value;
  }
  let obj = {};
  let baseHost = '';
  let basePath = '';
  let apiKey = store.get(`api.${source}`);
  let requestHeaders = {};
  let requestMethod = true;
  let queryStatus = false;
  let msgBody = {};

  switch (source) {
    case 'VirusTotal':
      baseHost = 'www.virustotal.com';
      basePath = '/api/v3/';
      Object.assign(requestHeaders, {
        Accept: 'application/json',
        'x-apikey': apiKey,
      });
      break;
    case 'PassiveTotal':
      baseHost = 'api.riskiq.net';
      basePath = '/pt/v2/';
      Object.assign(requestHeaders, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Basic ' + new Buffer.from(apiKey).toString('base64'),
      });
      break;
    case 'GreyNoise':
      baseHost = 'api.greynoise.io';
      basePath = '/v3/';
      Object.assign(requestHeaders, {
        Accept: 'application/json',
        key: apiKey,
      });
      break;
    case 'censys':
      baseHost = 'search.censys.io';
      basePath = '/api/';
      Object.assign(requestHeaders, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Basic ' + new Buffer.from(apiKey).toString('base64'),
      });
      break;
    case 'BinaryEdge':
      baseHost = 'api.binaryedge.io';
      basePath = '/v2/';
      Object.assign(requestHeaders, {
        Accept: 'application/json',
        'X-Key': apiKey,
      });
      break;
    case 'HybridAnalysis':
      requestMethod = false;
      baseHost = 'hybrid-analysis.com';
      basePath = '/api/v2/';
      Object.assign(requestHeaders, {
        Accept: 'application/json',
        'api-key': apiKey,
        'User-Agent': 'Falcon Sandbox',
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      break;
    case 'Shodan':
      baseHost = 'api.shodan.io';
      basePath = '';
      Object.assign(requestHeaders, {
        Accept: 'application/json',
      });
      break;
    case 'AlienVault':
      baseHost = 'otx.alienvault.com';
      basePath = '/api/v1/';
      Object.assign(requestHeaders, {
        'X-OTX-API-KEY': apiKey,
        Accept: 'application/json',
      });
      break;
    case 'MalwareBazaar':
      baseHost = 'mb-api.abuse.ch';
      basePath = '/api/v1/';
      Object.assign(requestHeaders, {
        'API-KEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      break;
    case 'Triage':
      baseHost = 'api.tria.ge';
      basePath = '/v0/';
      Object.assign(requestHeaders, {
        Authorization: `Bearer ${apiKey}`,
      });
      break;
    default:
      console.log(`unsupported ${source}`);
  }

  if (source === 'VirusTotal') {
    switch (collectionID) {
      case 'domain':
        basePath += 'domains/' + nodeId;
        queryStatus = true;
        break;
      case 'ipaddress':
        basePath += 'ip_addresses/' + nodeId;
        queryStatus = true;
        break;
      case 'hash':
        basePath += 'files/' + nodeId;
        queryStatus = true;
        break;
    }
  } else if (source === 'PassiveTotal') {
    switch (collectionID) {
      case 'domain':
        basePath += 'dns/passive?query=' + nodeId;
        queryStatus = true;
        break;
      case 'ipaddress':
        basePath += 'services?query=' + nodeId;
        queryStatus = true;
        break;
    }
  } else if (source === 'GreyNoise') {
    switch (collectionID) {
      case 'ipaddress':
        basePath += 'community/' + nodeId;
        queryStatus = true;
        break;
    }
  } else if (source === 'censys') {
    switch (collectionID) {
      case 'ipaddress':
        basePath += 'v2/hosts/' + nodeId;
        queryStatus = true;
        break;
      case 'certificate':
        basePath += 'v1/view/certificates/' + nodeId;
        queryStatus = true;
        break;
    }
  } else if (source === 'BinaryEdge') {
    switch (collectionID) {
      case 'ipaddress':
        basePath += 'query/ip/' + nodeId;
        queryStatus = true;
        break;
      case 'domain':
        basePath += 'query/domains/dns/' + nodeId;
        queryStatus = true;
        break;
    }
  } else if (source === 'HybridAnalysis') {
    switch (collectionID) {
      case 'hash':
        queryStatus = true;
        requestMethod = false;
        basePath += 'search/hash';
        Object.assign(msgBody, { query: `hash=${nodeId}` });
        break;
      case 'ipaddress':
        queryStatus = true;
        requestMethod = false;
        basePath += 'search/terms';
        Object.assign(msgBody, { query: `host=${nodeId}` });
        break;
      case 'domain':
        queryStatus = true;
        requestMethod = false;
        basePath += 'search/terms';
        Object.assign(msgBody, { query: `domain=${nodeId}` });
        break;
    }
  } else if (source === 'Shodan') {
    switch (collectionID) {
      case 'ipaddress':
        queryStatus = true;
        basePath += `/shodan/host/${nodeId}?key=${apiKey}`;
        break;
      case 'domain':
        queryStatus = true;
        basePath += `/dns/domain/${nodeId}?key=${apiKey}`;
        break;
    }
  } else if (source === 'AlienVault') {
    switch (collectionID) {
      case 'ipaddress':
        queryStatus = true;
        basePath += `indicators/IPv4/${nodeId}/general`;
        break;
      case 'domain':
        queryStatus = true;
        basePath += `indicators/domain/${nodeId}/general`;
        break;
      case 'hash':
        queryStatus = true;
        basePath += `indicators/file/${nodeId}/analysis`;
        break;
    }
  } else if (source === 'MalwareBazaar') {
    switch (collectionID) {
      case 'hash':
        queryStatus = true;
        requestMethod = false;
        Object.assign(msgBody, {
          query: `query=get_info&hash=${nodeId}`,
        });
    }
  } else if (source === 'Triage') {
    switch (collectionID) {
      case 'hash':
        queryStatus = true;
        basePath += `search?query=md5:${nodeId}`;
        break;
      case 'domain':
        queryStatus = true;
        basePath += `search?query=domain:${nodeId}`;
        break;
      case 'ipaddress':
        queryStatus = true;
        basePath += `search?query=ip:${nodeId}`;
        break;
    }
  }

  let options = {
    hostname: baseHost,
    port: 443,
    path: basePath,
    method: requestMethod ? 'GET' : 'POST',
    headers: requestHeaders,
  };

  if (queryStatus) obj[source] = options;
  options.data = msgBody;

  return obj;
}

function getRequest(options) {
  const { data, ...option } = options;
  const postData = data.query;

  return new Promise((resolve, reject) => {
    const req = https
      .request(option, (res) => {
        console.log(`${res.statusCode} - ${option.hostname}${option.path}`);
        let chunks = [];
        if (res.statusCode !== 200) {
          reject(res.statusCode);
        }
        res
          .on('data', (d) => {
            chunks.push(d);
          })
          .on('end', () => {
            try {
              let data = Buffer.concat(chunks);
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e.message);
            }
          });
      })
      .on('error', (err) => {
        reject(`Error message: ${err.message}`);
      });

    if (postData && postData.length > 0) {
      req.write(postData);
    }
    req.end();
  });
}
