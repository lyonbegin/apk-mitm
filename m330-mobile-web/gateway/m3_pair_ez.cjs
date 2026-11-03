#!/usr/bin/env node
'use strict';

/**
 * REAL Tuya SmartLink (Wi-Fi EZ) provisioning attempt, no Lefant app / no BLE.
 * Uses @tuyapi/link's documented cloud token + UDP SmartConfig implementation.
 * Requires a user-authorized Tuya IoT developer app, and a robot supporting EZ.
 * NOT an AP provisioning implementation; brand-locked Lefant devices may reject it.
 *
 * Reads all secrets from stdin JSON (never process arguments or GitHub/Railway).
 * Only emits sanitized result JSON to stdout. Device keys saved locally, mode 0600.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const VALID_REGIONS = new Set(['us', 'eu', 'cn']);
const TIMEZONE_BY_REGION = {
  us: 'America/Chicago', eu: 'Europe/Berlin', cn: 'Asia/Seoul'
};
const redact = value => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);

function validate(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw Error('INVALID_FIELDS');
  for (const field of ['ssid', 'wifi_password', 'api_key', 'api_secret', 'schema']) {
    if (typeof config[field] !== 'string' || !config[field].trim()) throw Error('MISSING_' + field.toUpperCase());
  }
  if (!VALID_REGIONS.has(config.region)) throw Error('INVALID_REGION');
  if (Buffer.byteLength(config.ssid, 'utf8') > 32) throw Error('INVALID_SSID');
  if (config.wifi_password.length > 128 || config.api_secret.length > 256 ||
      config.api_key.length > 256 || config.schema.length > 128) throw Error('INVALID_FIELDS');
  if (!/^[A-Za-z0-9._-]+$/.test(config.schema)) throw Error('INVALID_SCHEMA');
  return config;
}
function safeStatus(code, detail = {}) {
  process.stdout.write(JSON.stringify({code, ...detail}) + '\n');
}
function safeError(e) {
  const msg = String(e && e.message || '').toLowerCase();
  if (/cannot find module|module not found/.test(msg)) return 'DEPENDENCY_MISSING';
  if (/invalid.*sign|sign invalid|signature|permission deny|permission denied|not authorized|403|1106/.test(msg))
    return 'TUYA_PROJECT_AUTH_REJECTED';
  if (/timeout|timed out/.test(msg)) return 'DEVICE_DID_NOT_ACTIVATE';
  if (/network|econn|enotfound|dns|socket|fetch/.test(msg)) return 'NETWORK_OR_CLOUD_UNREACHABLE';
  return 'TUYA_ACTIVATION_FAILED';
}
function store(details) {
  // Device identifiers / local keys NEVER go to the Railway backend.
  const home = process.env.M3_PAIR_STORAGE_DIR || path.join(os.homedir(), '.config', 'm3-max');
  fs.mkdirSync(home, {recursive:true, mode:0o700});
  fs.chmodSync(home, 0o700);
  const file = path.join(home, 'paired_devices.json');
  let old = [];
  try {
    old = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(old)) old = [];
  } catch { old = []; }
  const byId = new Map(old.filter(x => x && x.id).map(x => [x.id,x]));
  for (const device of details) {
    if (!device || typeof device.id !== 'string' || !device.id ||
        typeof device.local_key !== 'string' || !device.local_key) continue;
    byId.set(device.id, {id:device.id, local_key:device.local_key,
      ip:(typeof device.ip === 'string' ? device.ip : ''),
      name:(typeof device.name === 'string' ? device.name.slice(0,60) : ''),
      source:'tuya_ez', provisioned_at:new Date().toISOString()});
  }
  const payload = JSON.stringify([...byId.values()],null,2);
  const tmp = path.join(home, '.paired-' + crypto.randomBytes(6).toString('hex'));
  fs.writeFileSync(tmp, payload, {encoding:'utf8',flag:'wx',mode:0o600});
  fs.renameSync(tmp, file);
  fs.chmodSync(file, 0o600);
  return file;
}
async function main() {
  if (process.argv.includes('--self-test')) {
    const sample = validate({ssid:'2.4GHz-Test',wifi_password:'test-key',api_key:'a',api_secret:'b',schema:'myapp',region:'us'});
    safeStatus('SELF_TEST_OK',{network_calls:0, valid_ssid:sample.ssid.length > 0});
    return;
  }
  let input='';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 8192) throw Error('INPUT_TOO_LARGE');
  }
  const cfg = validate(JSON.parse(input));
  // No DEBUG logging; SDK uses debug() and may otherwise print tokens.
  process.env.DEBUG = '';
  const {wizard:TuyaLink} = require('@tuyapi/link');
  const link = new TuyaLink({
    apiKey:cfg.api_key, apiSecret:cfg.api_secret, schema:cfg.schema,
    region:cfg.region, timezone:cfg.region === 'cn' ? 'Asia/Seoul' : TIMEZONE_BY_REGION[cfg.region],
    email:'m3-' + crypto.randomBytes(7).toString('hex') + '@example.com',
    password:crypto.randomBytes(18).toString('hex')
  });
  await link.init();               // Contact Tuya cloud; request user for this app.
  const found = await link.linkDevice({
    ssid:cfg.ssid, wifiPassword:cfg.wifi_password, devices:1, timeout:100
  });                              // Real encrypted Tuya Cloud token + UDP EZ broadcast.
  if (!Array.isArray(found) || !found.length) throw Error('NO_ACTIVATION_CONFIRMATION');
  const ids = found.map(x=>x.device_id).filter(Boolean);
  if (!ids.length) throw Error('NO_DEVICE_ID');
  const result = await link.getLinkedDevices({ids});
  const details = Array.isArray(result.devices) ? result.devices : [];
  // Only API-confirmed device registration counts as success.
  if (!details.some(d => d && d.id && ids.includes(d.id) && d.local_key)) {
    safeStatus('CLOUD_PAIRED_NO_LOCAL_KEY',{cloud_confirmed:true,
      devices:ids.map(id=>({ref:redact(id)})),credentials_saved:false});
    return;
  }
  store(details);
  safeStatus('CLOUD_PAIRED',{cloud_confirmed:true,
    devices:details.filter(d=>d && d.id && ids.includes(d.id)).map(d=>({
      ref:redact(d.id), has_local_key:!!d.local_key,has_ip:!!d.ip,
      name:(typeof d.name === 'string' ? d.name.slice(0,45) : '')
    })),credentials_saved:true,hardware_control_verified:false});
}
main().catch(e => {
  // Do not print raw errors: the Tuya SDK may echo API secrets, SSID or password.
  safeStatus(safeError(e),{cloud_confirmed:false,hardware_control_verified:false});
  process.exitCode=1;
});
