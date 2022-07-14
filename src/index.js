const btnSearch = document.getElementById('search-btn');
const searchTerm = document.getElementById('searchbar');
const btnSettings = document.getElementById('settings-btn');
const btnRefresh = document.getElementById('home-fresh');
const resultWindow = document.getElementById('intel-result');
const navList = document.getElementById('nav-list');
const tabGroup = document.querySelector('.tab');
const btnDownload = document.getElementById('home-download');
const searchOperator = document.getElementById('search-op');

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();

  const getHighlightedText = () => {
    let s = '';
    if (window.getSelection) {
      s = window.getSelection().toString();
    } else if (document.selection && document.selection.type != 'Control') {
      s = document.selection.createRange().text;
    }
    return s;
  };

  let s = getHighlightedText();

  if (!s) {
    return;
  }

  window.portgasAPI.showContextMenu(s);
  window.portgasAPI.returnContextMenuData((event, type, object) => {
    let d;
    switch (type) {
      case 'convert-epoch':
        d = convertEpoch(object);
        e.target.innerHTML += ` (${d})`;
        break;
      case 'convert-int-ip':
        d = int2ip(object);
        e.target.innerHTML += ` (${d})`;
    }
  });
});

btnDownload.addEventListener('click', async () => {
  await window.portgasAPI.downloadResults();
});

btnSearch.addEventListener('click', () => {
  $('.tab').empty();
  $('#intel-result').empty();
  let searchOp = searchOperator.value;
  const searchQuery = searchTerm.value.trim();

  if (!searchQuery) {
    return;
  }
  let indicatorType = {};
  if (searchOp === 'any') {
    indicatorType = classifyIndicator(searchQuery);
  } else {
    indicatorType[searchOp] = searchQuery;
  }
  let result = window.portgasAPI.lookupIOC(indicatorType);
  for (let [key, value] of Object.entries(result)) {
    let tabNodes = `<button class="tablinks" onclick="loadResults(event, '${key}')">${key}</button>`;
    tabGroup.innerHTML += tabNodes;
    let tabResults = `results-${key}`;
    resultWindow.innerHTML += `<pre id='${tabResults}' class="tabcontent"></pre>`;
    let dataStore = document.getElementById(tabResults);
    dataStore.innerText = JSON.stringify(value, null, 2);
    tabGroup.style.display = 'block';
  }
});

btnRefresh.addEventListener('click', () => {
  window.portgasAPI.homeRefresh();
});

searchTerm.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    btnSearch.click();
  }
});

function loadResults(event, source) {
  let tabContent = document.getElementsByClassName('tabcontent');
  for (let i = 0; i < tabContent.length; i++) {
    tabContent[i].style.display = 'none';
  }
  let tabLinks = document.getElementsByClassName('tablinks');
  for (let i = 0; i < tabLinks.length; i++) {
    tabLinks[i].className = tabLinks[i].className.replace(' active', '');
  }
  document.getElementById(`results-${source}`).style.display = 'block';
  event.currentTarget.className += ' active';
}

function classifyIndicator(ioc) {
  let result = {};
  let x = ioc.replaceAll('[.]', '.');
  let reIPv4 = /^\d+\.\d+\.\d+\.\d+$/i;
  let reMd5Hash = /^[A-Fa-f0-9]{32,}$/i;
  let reCertificate = /^[A-Fa-f0-9]{64}$/i; // TODO: will fix this later

  if (reIPv4.test(x)) {
    result['ip'] = x;
  } else if (reMd5Hash.test(x)) {
    result['md5'] = x;
  } else if (reCertificate.test(x)) {
    result['certificate'] = x;
  } else {
    result['domain'] = x;
  }

  return result;
}

$(window).on('load', () => {
  tabGroup.style.display = 'none';
  window.portgasAPI
    .toolGetStatus()
    .then((result) => {
      for (let [k, v] of Object.entries(result)) {
        if (v) {
          let nav = $('nav.nav-group > ul');
          let navLink = `<div id=nav-group-list><li><a href="#" id="nav-group-item">${k}</a></li></div>`;
          nav.append(navLink);
        }
      }
    })
    .catch((reject) => console.log(reject));
});

navList.addEventListener('click', (event) => {
  let apiTool = event.target.innerText;
  switch (apiTool) {
    case 'VirusTotal':
      console.log('i do nothing');
      break;
    case 'GreyNoise':
      console.log('stop clicking me');
      break;
  }
});

function convertEpoch(i) {
  if (i < 10000000000) {
    i *= 1000;
  }
  return new Date(i).toUTCString();
}

function int2ip(ipInt) {
  return (
    (ipInt >>> 24) +
    '.' +
    ((ipInt >> 16) & 255) +
    '.' +
    ((ipInt >> 8) & 255) +
    '.' +
    (ipInt & 255)
  );
}
