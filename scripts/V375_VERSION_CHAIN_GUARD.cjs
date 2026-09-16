const fs = require('fs');

const EXPECTED = Object.freeze({
  versionName: '3.7.5',
  versionCode: 43,
  packageName: 'com.etfpilot.twselive',
  signingCertSha256: 'efee34e265df25cb2faa0c20473bccd7e28c34a8a359a9263f4b8006a4f96f06',
});

const read = (path) => fs.readFileSync(path, 'utf8');
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const gradle = read('android/app/build.gradle');
const versionTs = read('src/v3/version.ts');

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

check(app.expo.version === EXPECTED.versionName,
  `app.json expo.version must be ${EXPECTED.versionName}, got ${app.expo.version}`);
check(app.expo.runtimeVersion === EXPECTED.versionName,
  `app.json runtimeVersion must be ${EXPECTED.versionName}, got ${app.expo.runtimeVersion}`);
check(app.expo.android?.package === EXPECTED.packageName,
  `app.json android.package must be ${EXPECTED.packageName}, got ${app.expo.android?.package}`);
check(app.expo.android?.versionCode === EXPECTED.versionCode,
  `app.json android.versionCode must be ${EXPECTED.versionCode}, got ${app.expo.android?.versionCode}`);
check(app.expo.ios?.bundleIdentifier === EXPECTED.packageName,
  `app.json ios.bundleIdentifier must be ${EXPECTED.packageName}, got ${app.expo.ios?.bundleIdentifier}`);
check(String(app.expo.ios?.buildNumber) === String(EXPECTED.versionCode),
  `app.json ios.buildNumber must be ${EXPECTED.versionCode}, got ${app.expo.ios?.buildNumber}`);
check(pkg.version === EXPECTED.versionName,
  `package.json version must be ${EXPECTED.versionName}, got ${pkg.version}`);
check(gradle.includes(`applicationId '${EXPECTED.packageName}'`),
  `build.gradle applicationId must remain ${EXPECTED.packageName}`);
check(gradle.includes(`versionCode ${EXPECTED.versionCode}`),
  `build.gradle versionCode must be ${EXPECTED.versionCode}`);
check(gradle.includes(`versionName "${EXPECTED.versionName}"`),
  `build.gradle versionName must be ${EXPECTED.versionName}`);
check(versionTs.includes(`APP_SEMVER='${EXPECTED.versionName}'`),
  `src/v3/version.ts APP_SEMVER must be ${EXPECTED.versionName}`);
check(versionTs.includes(`OTA_RUNTIME_VERSION='${EXPECTED.versionName}'`),
  `src/v3/version.ts OTA_RUNTIME_VERSION must be ${EXPECTED.versionName}`);

if (failures.length) {
  console.error('V3.7.5 VERSION CHAIN GUARD: FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('V3.7.5 VERSION CHAIN GUARD: PASS');
console.log(JSON.stringify(EXPECTED, null, 2));
