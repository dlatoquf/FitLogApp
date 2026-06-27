const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function removeMediaPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const permissions = manifest.manifest["uses-permission"] || [];
    const blocked = [
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
    ];
    manifest.manifest["uses-permission"] = permissions.filter(
      (p) => !blocked.includes(p.$?.["android:name"])
    );
    return config;
  });
};
