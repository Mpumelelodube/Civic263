const { withPodfile } = require('expo/config-plugins');

module.exports = function withFirebaseModularHeaders(config) {
  return withPodfile(config, (result) => {
    const marker = '  use_expo_modules!';
    const declaration =
      "  pod 'GoogleUtilities', :modular_headers => true\n  pod 'RecaptchaInterop', :modular_headers => true";
    if (!result.modResults.contents.includes(declaration)) {
      if (!result.modResults.contents.includes(marker))
        throw new Error('Firebase native setup could not find the Expo Podfile target.');
      result.modResults.contents = result.modResults.contents.replace(
        marker,
        marker + '\n' + declaration,
      );
    }
    return result;
  });
};
