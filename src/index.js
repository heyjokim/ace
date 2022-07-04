const btnSearch = document.getElementById('search-btn');
const searchTerm = document.getElementById('searchbar');
const btnSettings = document.getElementById('settings-btn');
const btnRefresh = document.getElementById('home-fresh');
const resultWindow = document.getElementById('intel-result');
const navList = document.getElementById('nav-list');
const rWindow = document.getElementById('result-rendered');
const loader = document.querySelector('.loader');

btnSearch.addEventListener('click', () => {
  rWindow.innerHTML = '';
  const searchQuery = searchTerm.value.trim();

  if (!searchQuery) {
    return;
  }
  let indicatorType = classifyIndicator(searchQuery);
  let result = window.portgasAPI.lookupIOC(indicatorType);
  createTree(result);
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

function classifyIndicator(ioc) {
  let result = {};
  let x = ioc.replaceAll('[.]', '.');
  reIPv4 = /^\d+\.\d+\.\d+\.\d+$/i;
  reHash = /^[A-Fa-f0-9]{32,}$/i;
  reCertificate = /^[A-Fa-f0-9]{64}$/i; // TODO: will fix this later

  if (reIPv4.test(x)) {
    result['ipaddress'] = x;
  } else if (reHash.test(x)) {
    result['hash'] = x;
  } else if (reCertificate.test(x)) {
    result['certificate'] = x;
  } else {
    result['domain'] = x;
  }

  return result;
}

$(window).on('load', () => {
  loader.style.display = 'none';
  window.portgasAPI
    .queryAPIKeys()
    .then((result) => {
      for (let [k, v] of Object.entries(result)) {
        if (v && v.length > 1) {
          let nav = $('nav.nav-group > ul');
          let navLink = `<div id=nav-group-list><li><a href="#" id="nav-group-item">${k}</a></li></div>`;
          nav.append(navLink);
          let obj = {};
          obj[`active.${k}`] = true;
          window.portgasAPI.toolSetStatus(obj);
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

function createTree(object) {
  rWindow.innerHTML = '';

  const tree = jsonview.create(object);
  jsonview.render(tree, rWindow);
  jsonview.expand(tree);
}
