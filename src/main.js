const os = require('os');
const crypto = require('crypto');
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
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
    ],
  },
];

const RANDOMKEYGEN = crypto
  .createHash('md5')
  .update(os.hostname())
  .digest('hex');

const store = new Store({ encryptionKey: RANDOMKEYGEN });

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
  let collectionID, nodeID;
  for (let [key, value] of Object.entries(object)) {
    collectionID = key;
    nodeID = value;
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

    default:
      console.log(`unsupported ${source}`);
  }

  if (source === 'VirusTotal') {
    switch (collectionID) {
      case 'domain':
        basePath += 'domains/' + nodeID;
        queryStatus = true;
        break;
      case 'ipaddress':
        basePath += 'ip_addresses/' + nodeID;
        queryStatus = true;
        break;
      case 'hash':
        basePath += 'files/' + nodeID;
        queryStatus = true;
        break;
    }
  } else if (source === 'PassiveTotal') {
    switch (collectionID) {
      case 'domain':
        basePath += 'dns/passive?query=' + nodeID;
        queryStatus = true;
        break;
      case 'ipaddress':
        basePath += 'services?query=' + nodeID;
        queryStatus = true;
        break;
    }
  } else if (source === 'GreyNoise') {
    switch (collectionID) {
      case 'ipaddress':
        basePath += 'community/' + nodeID;
        queryStatus = true;
        break;
    }
  } else if (source === 'censys') {
    switch (collectionID) {
      case 'ipaddress':
        basePath += 'v2/hosts/' + nodeID;
        queryStatus = true;
        break;
      case 'certificate':
        basePath += 'v1/view/certificates/' + nodeID;
        queryStatus = true;
        break;
    }
  } else if (source === 'BinaryEdge') {
    switch (collectionID) {
      case 'ipaddress':
        basePath += 'query/ip/' + nodeID;
        queryStatus = true;
        break;
      case 'domain':
        basePath += 'query/domains/dns/' + nodeID;
        queryStatus = true;
        break;
    }
  } else if (source === 'HybridAnalysis') {
    switch (collectionID) {
      case 'hash':
        queryStatus = true;
        requestMethod = false;
        basePath += 'search/hash';
        Object.assign(msgBody, { query: `hash=${nodeID}` });
        break;
      case 'ipaddress':
        queryStatus = true;
        requestMethod = false;
        basePath += 'search/terms';
        Object.assign(msgBody, { query: `host=${nodeID}` });
        break;
      case 'domain':
        queryStatus = true;
        requestMethod = false;
        basePath += 'search/terms';
        Object.assign(msgBody, { query: `domain=${nodeID}` });
        break;
    }
  } else if (source === 'Shodan') {
    switch (collectionID) {
      case 'ipaddress':
        queryStatus = true;
        basePath += `/shodan/host/${nodeID}?key=${apiKey}`;
        break;
      case 'domain':
        queryStatus = true;
        basePath += `/dns/domain/${nodeID}?key=${apiKey}`;
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
        console.log(
          `${option.hostname}${option.path}\tstatusCode: ${res.statusCode}`
        );
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
