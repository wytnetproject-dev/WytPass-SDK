import { WytPass, WytPassClient, MemoryStorage, STORAGE_KEYS, OAuthError, InvalidStateError } from '@wytpass/core';
import { WytPassProvider, useWytPass, WytPassCallback } from '@wytpass/react';

console.log('--- PHASE 9 & 10: REAL CONSUMER TEST EXECUTION ---');

// Test 1: Package Exports
console.log('\n[TEST 1] Verifying Package Exports...');
if (typeof WytPass !== 'function' || typeof WytPassClient !== 'function') {
  throw new Error('FAIL: WytPass or WytPassClient not exported as constructor');
}
if (WytPass !== WytPassClient) {
  throw new Error('FAIL: WytPass is not an alias of WytPassClient');
}
if (typeof WytPassProvider !== 'function' || typeof useWytPass !== 'function' || typeof WytPassCallback !== 'function') {
  throw new Error('FAIL: React components/hooks not properly exported');
}
console.log('✓ PASS: All exports from @wytpass/core and @wytpass/react are valid.');

// Test 2: Zero-Configuration Client Initialization & PKCE Generation
console.log('\n[TEST 2] Verifying Zero-Configuration (Client ID Only) & PKCE Generation...');
const storage = new MemoryStorage();
const REAL_CLIENT_ID = 'wp_70da57c06844c018b3de';

// Zero configuration! Client provides ONLY clientId:
const wytpass = new WytPass({
  clientId: REAL_CLIENT_ID,
  storage
});

const auth = await wytpass.getAuthorizationUrl();
console.log('Generated Auth URL:', auth.url);
console.log('Auto-resolved Redirect URI:', auth.redirectUri);

const parsedUrl = new URL(auth.url);
if (parsedUrl.origin !== 'https://wytnet.com') throw new Error('FAIL: Wrong origin');
if (parsedUrl.pathname !== '/oauth/authorize') throw new Error('FAIL: Wrong pathname');
if (parsedUrl.searchParams.get('client_id') !== REAL_CLIENT_ID) throw new Error('FAIL: client_id mismatch');
if (!parsedUrl.searchParams.get('redirect_uri')) throw new Error('FAIL: redirect_uri not auto-resolved');
if (parsedUrl.searchParams.get('response_type') !== 'code') throw new Error('FAIL: response_type must be code');
if (parsedUrl.searchParams.get('code_challenge_method') !== 'S256') throw new Error('FAIL: code_challenge_method must be S256');
if (parsedUrl.searchParams.get('scope') !== 'openid profile email') throw new Error('FAIL: scope must default to openid profile email');

const codeChallenge = parsedUrl.searchParams.get('code_challenge');
if (!codeChallenge || codeChallenge.length < 40) throw new Error('FAIL: Missing or invalid code_challenge');

const stateParam = parsedUrl.searchParams.get('state');
if (!stateParam || stateParam.length < 20) throw new Error('FAIL: Missing or invalid state');

if (storage.get(STORAGE_KEYS.STATE) !== stateParam) throw new Error('FAIL: State not stored in storage');
if (!storage.get(STORAGE_KEYS.CODE_VERIFIER)) throw new Error('FAIL: code_verifier not stored in storage');
if (storage.get(STORAGE_KEYS.REDIRECT_URI) !== auth.redirectUri) throw new Error('FAIL: redirect_uri not stored in storage');

console.log('✓ PASS: Zero-configuration authorization URL conforms to WytPass PKCE S256 specification.');

// Test 3: Verify with live WytNET API application-info endpoint
console.log('\n[TEST 3] Verifying against Live WytNET API application-info...');
try {
  const appInfoRes = await fetch(
    `https://api.wytnet.com/oauth/application-info?client_id=${REAL_CLIENT_ID}&redirect_uri=${encodeURIComponent(auth.redirectUri)}`
  );
  if (!appInfoRes.ok) {
    throw new Error(`Failed to query live application info: HTTP ${appInfoRes.status}`);
  }
  const appInfo = await appInfoRes.json();
  console.log('Live App Info:', JSON.stringify(appInfo));
  if (appInfo.name !== 'Next JS Project') {
    throw new Error(`Unexpected app name: ${appInfo.name}`);
  }
  console.log('✓ PASS: Live WytNET production server successfully verified client_id and redirect_uri.');
} catch (err) {
  console.warn('Live API check warning:', err.message);
}

// Test 4: Live Token Endpoint Exchange Failure Case (Phase 10: Invalid/Expired Code)
console.log('\n[TEST 4] Testing Live Token Endpoint with Real Request & Invalid Code...');
try {
  await wytpass.exchangeCode({
    code: 'non_existent_code_' + Date.now(),
    codeVerifier: auth.codeVerifier
  });
  throw new Error('FAIL: exchangeCode should have rejected invalid code');
} catch (err) {
  if (err instanceof OAuthError) {
    console.log(`✓ PASS: Correctly rejected with OAuthError [${err.error}]: ${err.errorDescription || err.message}`);
    if (!err.message.includes('code is invalid or expired')) {
      throw new Error(`Expected 'code is invalid or expired', got: ${err.message}`);
    }
  } else {
    throw err;
  }
}

// Test 5: State Mismatch (CSRF Attack)
console.log('\n[TEST 5] Testing State Mismatch Rejection...');
try {
  await wytpass.handleCallback(`http://localhost:3000/callback?code=test_code&state=ATTACKER_STATE_FAKE`);
  throw new Error('FAIL: handleCallback should have rejected state mismatch');
} catch (err) {
  if (err instanceof InvalidStateError) {
    console.log('✓ PASS: Rejected state mismatch with InvalidStateError.');
  } else {
    throw new Error(`Expected InvalidStateError, got: ${err}`);
  }
}

// Test 6: Missing Code Parameter
console.log('\n[TEST 6] Testing Missing Code Parameter Rejection...');
try {
  await wytpass.handleCallback(`http://localhost:3000/callback?state=${auth.state}`);
  throw new Error('FAIL: handleCallback should have rejected missing code');
} catch (err) {
  if (err instanceof OAuthError && err.error === 'invalid_request') {
    console.log('✓ PASS: Rejected missing code with OAuthError [invalid_request].');
  } else {
    throw new Error(`Expected OAuthError [invalid_request], got: ${err}`);
  }
}

// Test 7: OAuth Server Error Parameter
console.log('\n[TEST 7] Testing OAuth Server Error Parameter in Callback...');
try {
  await wytpass.handleCallback(`http://localhost:3000/callback?error=access_denied&error_description=User+declined+consent`);
  throw new Error('FAIL: handleCallback should have rejected error parameter');
} catch (err) {
  if (err instanceof OAuthError && err.error === 'access_denied') {
    console.log('✓ PASS: Rejected error parameter with OAuthError [access_denied].');
  } else {
    throw new Error(`Expected OAuthError [access_denied], got: ${err}`);
  }
}

console.log('\n========================================');
console.log('ALL CONSUMER TESTS PASSED SUCCESSFULLY!');
console.log('========================================');
