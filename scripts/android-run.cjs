#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const localPropertiesPath = path.join(repoRoot, 'android', 'local.properties');

function hasAdb(sdkDir) {
  if (!sdkDir) return false;
  const adb = path.join(
    sdkDir,
    'platform-tools',
    process.platform === 'win32' ? 'adb.exe' : 'adb',
  );
  return fs.existsSync(adb);
}

function isAllAsciiPath(p) {
  for (let i = 0; i < p.length; i++) {
    if (p.charCodeAt(i) > 127) return false;
  }
  return true;
}

function readLocalPropsSdk() {
  if (!fs.existsSync(localPropertiesPath)) return null;
  const text = fs.readFileSync(localPropertiesPath, 'utf8');
  const m = text.match(/^\s*sdk\.dir\s*=\s*(.+?)\s*$/m);
  if (!m) return null;
  let v = m[1].trim();
  v = v.replace(/\\\\/g, '\\');
  return path.resolve(v.split('/').join(path.sep));
}

function writeLocalProps(sdkDir) {
  const fd = path.normalize(sdkDir).replace(/\\/g, '/');
  fs.mkdirSync(path.dirname(localPropertiesPath), { recursive: true });
  fs.writeFileSync(localPropertiesPath, `sdk.dir=${fd}\n`, { encoding: 'ascii' });
}

function pickSdkWindows() {
  const candidates = [];
  if (process.env.EXPO_ASCII_ANDROID_SDK) {
    candidates.push(path.resolve(process.env.EXPO_ASCII_ANDROID_SDK));
  }
  candidates.push(
    path.join(path.dirname(repoRoot), 'ExpoAndroidSdk'),
    path.join(repoRoot, '.expo-ascii-sdk'),
    'C:\\Android\\Sdk',
    'C:\\Users\\Public\\ExpoAndroidSdk',
    'D:\\Android\\Sdk',
  );

  for (const c of candidates) {
    if (hasAdb(c)) return { sdk: c, source: 'ascii-mirror' };
  }

  const fromFile = readLocalPropsSdk();
  if (fromFile && hasAdb(fromFile) && isAllAsciiPath(fromFile)) {
    return { sdk: fromFile, source: 'local.properties' };
  }

  return null;
}

function pickSdkOther() {
  if (process.env.ANDROID_HOME && hasAdb(process.env.ANDROID_HOME)) {
    return { sdk: path.resolve(process.env.ANDROID_HOME), source: 'ANDROID_HOME' };
  }
  const fromFile = readLocalPropsSdk();
  if (fromFile && hasAdb(fromFile)) {
    return { sdk: fromFile, source: 'local.properties' };
  }
  return null;
}

let picked;
if (process.platform === 'win32') {
  picked = pickSdkWindows();
  if (!picked) {
    console.error('No usable ASCII-only Android SDK found. One-time: npm run android:setup-sdk');
    process.exit(1);
  }
} else {
  picked = pickSdkOther();
  if (!picked) {
    console.error('Set ANDROID_HOME to your SDK, or add sdk.dir in android/local.properties');
    process.exit(1);
  }
}

const { sdk } = picked;
writeLocalProps(sdk);
process.env.ANDROID_HOME = sdk;
process.env.ANDROID_SDK_ROOT = sdk;

const ndkRoot = path.join(sdk, 'ndk');
if (fs.existsSync(ndkRoot)) {
  const vers = fs
    .readdirSync(ndkRoot)
    .filter((n) => fs.statSync(path.join(ndkRoot, n)).isDirectory());
  if (vers.length) {
    vers.sort();
    const latest = path.join(ndkRoot, vers[vers.length - 1]);
    process.env.ANDROID_NDK = latest;
    process.env.ANDROID_NDK_HOME = latest;
  }
}

const forward = process.argv.slice(2);
const child = spawn('npx', ['--yes', 'expo', 'run:android', ...forward], {
  stdio: 'inherit',
  shell: true,
  cwd: repoRoot,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code == null ? 1 : code);
});
