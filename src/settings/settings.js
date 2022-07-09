const supportedAPI = document.querySelectorAll('.osint-field');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const homeBtn = document.getElementById('settingsHomeBtn');
const flags = document.querySelectorAll('.switch-tgl');

saveSettingsBtn.addEventListener('click', () => {
  let apiObjects = {};
  supportedAPI.forEach((e) => {
    const vendorsField = e.id.replace('api-', '');
    const vendorsValue = document.getElementById(e.id).value || '';
    if (vendorsValue) {
      apiObjects[`api.${vendorsField}`] = vendorsValue;
    }
  });
  window.portgasAPI.saveAPIKeys(apiObjects);
  homeBtn.click();
});

flags.forEach((e) => {
  e.addEventListener('click', () => {
    let tools = e.id;
    window.portgasAPI.toolGetStatus().then((x) => {
      let obj = {};
      obj[`active.${tools}`] = !x[tools];
      window.portgasAPI.toolSetStatus(obj);
    });
  });
});

window.addEventListener('load', () => {
  window.portgasAPI
    .queryAPIKeys()
    .then((e) => {
      for (let [key, value] of Object.entries(e)) {
        inputKey = document.getElementById(`api-${key}`);
        inputKey.value = value;
      }
    })
    .catch((err) => console.log(err));

  window.portgasAPI
    .toolGetStatus()
    .then((e) => {
      for (let [key, value] of Object.entries(e)) {
        inputKey = document.getElementById(key);
        inputKey.checked = value || false;
      }
    })
    .catch((err) => console.log(err));
});
