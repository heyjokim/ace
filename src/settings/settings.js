const supportedAPI = [
  'VirusTotal',
  'GreyNoise',
  'PassiveTotal',
  'censys',
  'BinaryEdge',
];
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const homeBtn = document.getElementById('settingsHomeBtn');

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
