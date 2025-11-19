const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function patchExpoImagePickerConfig(projectRoot) {
  const packageJsonPath = require.resolve("expo-image-picker/package.json", {
    paths: [projectRoot],
  });
  const packageRoot = path.dirname(packageJsonPath);
  const configPath = path.join(packageRoot, "expo-module.config.json");

  if (!fs.existsSync(configPath)) {
    return;
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);

  const appleConfig = parsed.apple ?? parsed.ios ?? {};
  const desiredModules = ["ImagePickerModule"];

  let didChange = false;

  if (parsed.apple !== appleConfig) {
    parsed.apple = appleConfig;
    didChange = true;
  }

  if (
    !Array.isArray(parsed.platforms) ||
    !parsed.platforms.includes("apple")
  ) {
    parsed.platforms = Array.from(
      new Set([...(parsed.platforms ?? []), "apple"])
    );
    didChange = true;
  }

  if (
    JSON.stringify(appleConfig.modules ?? []) !==
    JSON.stringify(desiredModules)
  ) {
    appleConfig.modules = desiredModules;
    didChange = true;
  }

  if (appleConfig.modulesClassNames) {
    delete appleConfig.modulesClassNames;
    didChange = true;
  }

  if (didChange) {
    fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2) + "\n");
  }
}

module.exports = function withExpoImagePickerAutolinking(config) {
  return withDangerousMod(config, ["ios", (cfg) => {
    patchExpoImagePickerConfig(cfg.modRequest.projectRoot);
    return cfg;
  }]);
};


