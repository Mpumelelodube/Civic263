const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
const rule = '-keep class androidx.work.impl.WorkDatabase_Impl { *; }';

module.exports = function withBackgroundWorkKeep(config) {
  return withDangerousMod(config, [
    'android',
    async (result) => {
      const target = path.join(result.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const text = await fs.readFile(target, 'utf8');
      // WorkManager constructs its generated Room database through reflection in release builds.
      if (!text.includes(rule)) await fs.appendFile(target, '\n' + rule + '\n');
      return result;
    },
  ]);
};
