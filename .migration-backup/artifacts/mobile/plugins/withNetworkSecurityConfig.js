/**
 * withNetworkSecurityConfig — Expo config plugin
 *
 * Creates res/xml/network_security_config.xml that explicitly permits
 * cleartext (HTTP) traffic to all domains, including raw IP addresses.
 *
 * WHY this is needed:
 *   Android 9+ (API 28+) blocks cleartext HTTP by default via the platform's
 *   network security framework. While `usesCleartextTraffic: true` in app.json
 *   adds android:usesCleartextTraffic="true" to the <application> tag, Media3
 *   (ExoPlayer) routes traffic through OkHttp which honours the *network
 *   security config XML* — not just the manifest flag. If no XML is present
 *   some OkHttp versions fall back to the strict platform default and raise
 *   ERROR_CODE_IO_NETWORK_CONNECTION_FAILED for http:// stream URLs.
 *
 * This plugin:
 *   1. Writes android/app/src/main/res/xml/network_security_config.xml
 *      with cleartextTrafficPermitted="true" for all domains.
 *   2. Sets android:networkSecurityConfig="@xml/network_security_config"
 *      on the <application> element in AndroidManifest.xml — this attribute
 *      takes precedence over usesCleartextTraffic and is the authoritative
 *      source for OkHttp / the Android network security framework.
 *
 * Security note:
 *   This is intentionally permissive — IPTV/streaming apps must reach
 *   arbitrary HTTP stream servers (raw IPs, custom ports, CDN edge nodes)
 *   that cannot be enumerated at build time.  The API server itself is
 *   always served over HTTPS; the cleartext permission is purely for
 *   media segment fetches.
 */

const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!--
        Permit cleartext (HTTP) traffic to all hosts.
        Required so Media3 / ExoPlayer / OkHttp can fetch IPTV streams
        served over plain HTTP (raw IPs, custom ports, etc.).
    -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
            <certificates src="user"/>
        </trust-anchors>
    </base-config>
</network-security-config>
`;

// ── Step 1: Write the XML file ────────────────────────────────────────────────
function withNetworkSecurityXmlFile(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res', 'xml',
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_XML,
        'utf8',
      );
      return cfg;
    },
  ]);
}

// ── Step 2: Reference the XML in AndroidManifest.xml ─────────────────────────
function withNetworkSecurityManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];

    // Idempotency: don't add twice
    if (!app.$['android:networkSecurityConfig']) {
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }

    // Belt-and-suspenders: also keep the flag
    app.$['android:usesCleartextTraffic'] = 'true';

    return cfg;
  });
}

// ── Compose ───────────────────────────────────────────────────────────────────
module.exports = function withNetworkSecurityConfig(config) {
  config = withNetworkSecurityXmlFile(config);
  config = withNetworkSecurityManifest(config);
  return config;
};
