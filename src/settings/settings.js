const supportedAPI = [
  'VirusTotal',
  'GreyNoise',
  'PassiveTotal',
  'censys',
  'BinaryEdge',
  'HybridAnalysis',
];

const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const homeBtn = document.getElementById('settingsHomeBtn');
const flags = document.querySelectorAll('.switch');

saveSettingsBtn.addEventListener('click', () => {
  let apiObjects = {};
  for (const vendors of supportedAPI) {
    const vendorsField = document.getElementById(`api-${vendors}`).value;
    if (vendorsField) {
      apiObjects[`api.${vendors}`] = vendorsField;
    }
  }
  window.portgasAPI.saveAPIKeys(apiObjects);
  homeBtn.click();
});

flags.forEach(e => {
  e.addEventListener('click', () => {
    let tools = e.id;
    console.log(tools)
  })
})