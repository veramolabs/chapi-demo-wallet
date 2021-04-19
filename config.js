/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict'

/**
 * Simple config file (to help test against local instances of authn.io, local
 * wallets, etc).
 */

const MEDIATOR = 'https://authn.io/mediator' + '?origin=' +
  encodeURIComponent(window.location.origin);

const WALLET_LOCATION = window.location.origin + '/';

const VERAMO_AGENT_BASE_URL = 'https://iiw32.veramo.dev';
const VERAMO_AGENT_API_KEY = '';
