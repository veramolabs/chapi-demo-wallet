/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict'

/**
 * Helper function
 */
async function postData({url = '', data = {}, token = ''}) {
  console.log('sending post data request: url: ' + url + ', token: ' + token);

  var headers = {
    'Content-Type': 'application/json'
    // 'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (token !== '') {
    headers.Authorization = 'Bearer ' + token;
  }

  // Default options are marked with *
  return fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers,
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
}

/**
 * UI Management
 */
async function connect() { 
  console.log('connect...');

  const inputUrl = document.getElementById('inputVeramoAgentUrl').value.trim();
  const inputApiKey = document.getElementById('inputVeramoAgentApiKey').value.trim();
  const url = inputUrl === '' ? VERAMO_AGENT_BASE_URL : inputUrl;
  const apiKey = inputApiKey === '' ? VERAMO_AGENT_API_KEY : inputApiKey;

  console.log('connect: url: ' + url + ', key: ' + apiKey);

  saveCurrentVeramoAgent({veramoAgentUrl: url, veramoAgentApiKey: apiKey});
  await refreshAgentArea();
}

async function disconnect() {
  console.log('disconnect...');

  resetCurrentVeramoAgent();
  clearWalletDisplay();
  clearWalletStorage();
  await refreshAgentArea();
}

async function refreshAgentArea() {
  console.log('refreshAgentArea...');

  const { veramoAgentUrl, veramoAgentApiKey } = loadCurrentVeramoAgent();
  document.getElementById('veramoAgent').innerHTML = veramoAgentUrl;
  try {
    if(veramoAgentUrl) {

      document.getElementById('connected').classList.remove('hide');
      document.getElementById('disconnected').classList.add('hide');

      const walletContents = await loadWalletContents();

      if(!walletContents || walletContents.length < 1) {
        return addToWalletDisplay({text: 'none'});
      }
    
      for(const entry of walletContents) {
        addToWalletDisplay({
          text: `${getCredentialType(entry.verifiableCredential)} Verifiable Credential from issuer ${entry.verifiableCredential.issuer.id}`,
          walletEntry: entry,
          shareButton: (typeof shareButton === 'undefined') ? null : shareButton
        });
      }
      return;
    }
  } catch (error) {
    console.log(error);
  }
  
  // not logged in
  document.getElementById('connected').classList.add('hide');
  document.getElementById('disconnected').classList.remove('hide');

  document.getElementById('inputVeramoAgentUrl').value = VERAMO_AGENT_BASE_URL;
  document.getElementById('inputVeramoAgentApiKey').value = VERAMO_AGENT_API_KEY;

  // Refresh the user's list of wallet contents
  clearWalletDisplay();
}

/**
 * Wallet Storage / Persistence
 */
async function loadWalletContents() {
  console.log('loadWalletContents...');
  const {veramoAgentUrl, veramoAgentApiKey} = loadCurrentVeramoAgent();
  const url = veramoAgentUrl + '/agent/dataStoreORMGetVerifiableCredentials';
  const response = await postData({url: url, token: veramoAgentApiKey});
  return response.json();
}

async function createVerifiablePresentation({holder, verifiableCredential, proofFormat = 'jwt'}) {
  const {veramoAgentUrl, veramoAgentApiKey} = loadCurrentVeramoAgent();
  const data = 
  {
    presentation: {
      holder: holder,
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      issuanceDate: new Date().toISOString(),
      verifiableCredential: [verifiableCredential],
    },
    proofFormat: proofFormat
  }  

  const url = veramoAgentUrl + '/agent/createVerifiablePresentation';
  const response = await postData({url: url, data: data, token:veramoAgentApiKey});
  return response.json();
}

function clearWalletStorage() {
  Cookies.remove('walletContents', {path: ''});
}

function clearWalletDisplay() {
  const contents = document.getElementById('walletContents');
  while(contents.firstChild)
    contents.removeChild(contents.firstChild);
}

function addToWalletDisplay({text, walletEntry, shareButton}) {
  const li = document.createElement('li');

  if (walletEntry) {
    const showButtonNode = document.createElement('a');
    showButtonNode.classList.add('waves-effect', 'waves-light', 'btn-small');
    showButtonNode.setAttribute('id', 'show-' + walletEntry.hash);
    showButtonNode.appendChild(document.createTextNode('Show'));
    li.appendChild(showButtonNode);

    // jsonViewer defined in index.html/wallet-ui-get.html
    showButtonNode.addEventListener('click', () => {
      jsonViewer.showJSON(walletEntry.verifiableCredential, null, 1);
    });

    if(shareButton) {
      li.appendChild(document.createTextNode(' '));
      const shareButtonNode = document.createElement('a');
      shareButtonNode.classList.add('waves-effect', 'waves-light', 'btn-small');
      shareButtonNode.setAttribute('id', walletEntry.hash);
      shareButtonNode.appendChild(document.createTextNode(shareButton.text));
      li.appendChild(shareButtonNode);     
  
      shareButtonNode.addEventListener('click', async () => {
        let vp = null;
        if (walletEntry.verifiableCredential.proof.type === 'JwtProof2020') {
          vp = await createVerifiablePresentation( 
            { holder: walletEntry.verifiableCredential.credentialSubject.id,
              verifiableCredential: walletEntry.verifiableCredential.proof.jwt });
        } else {
          vp = await createVerifiablePresentation( 
            { holder: walletEntry.verifiableCredential.credentialSubject.id,
              verifiableCredential: walletEntry.verifiableCredential, proofFormat: 'lds' });
        }
  
        console.log('wrapping and returning vc:', vp);
  
        shareButton.sourceEvent
          .respondWith(Promise.resolve({dataType: 'VerifiablePresentation', data: vp}));
      });    
    }    
  }

  const textNode = document.createElement('p');
  li.appendChild(textNode);
  textNode.appendChild(document.createTextNode(text));

  document.getElementById('walletContents')
    .appendChild(li);
}

function getCredentialType(vc) {
  if(!vc) {
    return 'Credential'
  };
  const types = Array.isArray(vc.type) ? vc.type : [vc.type];
  return types.length > 1 ? types.slice(1).join('/') : types[0];
}

/**
 * User Storage / Persistence
 */
function loadCurrentVeramoAgent() {
  console.log('Loading veramoAgent cookie.');
  const config = {
    veramoAgentUrl: (Cookies.get('veramoAgentUrl')) || '',
    veramoAgentApiKey: (Cookies.get('veramoAgentApiKey')  || '')
  };
  console.log('cookie: veramoAgentUrl: ' + config.veramoAgentUrl);
  console.log('cookie: veramoAgentApiKey: ' + config.veramoAgentApiKey);

  return config;
}

function saveCurrentVeramoAgent({veramoAgentUrl, veramoAgentApiKey}) {
  console.log('Setting veramoAgent cookie.');
  console.log('cookie: veramoAgentUrl: ' + veramoAgentUrl);
  console.log('cookie: veramoAgentApiKey: ' + veramoAgentApiKey);
  Cookies.set('veramoAgentUrl', veramoAgentUrl, {path: '', secure: true, sameSite: 'None'});
  Cookies.set('veramoAgentApiKey', veramoAgentApiKey, {path: '', secure: true, sameSite: 'None'});
}

function resetCurrentVeramoAgent() {
  console.log('Clearing veramoAgent cookie.');
  Cookies.set('veramoAgentUrl', '', {path: '', secure: true, sameSite: 'None'});
  Cookies.set('veramoAgentApiKey', '', {path: '', secure: true, sameSite: 'None'});
}