const { withPodfile } = require("@expo/config-plugins");

function ensurePostInstall(contents) {
  if (!/post_install do \|installer\|/.test(contents)) {
    return contents.replace(
      /end\s*$/m,
      `
post_install do |installer|
  react_native_post_install(
    installer,
    config[:reactNativePath],
    :mac_catalyst_enabled => false,
    :ccache_enabled => podfile_properties['apple.ccacheEnabled'] == 'true',
  )
end

end
`
    );
  }
  return contents;
}

function injectPatch(contents) {
  const patch = `
  # ---- Folly & C++ standard hardening (Expo plugin) -------------------------
  installer.pods_project.targets.each do |t|
    t.build_configurations.each do |c|
      # Preprocessor macros: disable Folly coroutines and enforce libc++
      defs = c.build_settings['GCC_PREPROCESSOR_DEFINITIONS']
      defs = ['$(inherited)'] if defs.nil?
      defs = defs.is_a?(Array) ? defs : defs.to_s.split(/\\s+/)

      # Disable coroutines and assert Apple time APIs exist
      [
        'FOLLY_HAS_COROUTINES=0',
        'FOLLY_CFG_NO_COROUTINES=1',
        'FOLLY_NO_CONFIG=1',
        'FOLLY_MOBILE=1',
        'FOLLY_USE_LIBCPP=1',
        'HAVE_CLOCK_GETTIME=1',
        'FOLLY_HAVE_CLOCK_GETTIME=1'
      ].each do |d|
        defs << d unless defs.include?(d)
      end
      c.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs.uniq

      # Force C++20
      c.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++20'
      c.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'

      # Strip any -std=gnu++17 stragglers
      %w[OTHER_CPLUSPLUSFLAGS OTHER_CFLAGS].each do |k|
        v = c.build_settings[k]
        next if v.nil?
        v = v.is_a?(Array) ? v : v.to_s.split(/\\s+/)
        v = v.map { |f| f.gsub(/-std=gnu\\+\\+17/, '') }
        c.build_settings[k] = v
      end
    end
  end
  # --------------------------------------------------------------------------
`;
  return contents.replace(
    /post_install do \|installer\|([\s\S]*?)end/m,
    (m, inner) => `post_install do |installer|\n${inner}\n${patch}end`
  );
}

module.exports = function withFollyNoCoroutines(config) {
  return withPodfile(config, (cfg) => {
    let contents = cfg.modResults.contents;
    contents = ensurePostInstall(contents);
    contents = injectPatch(contents);
    cfg.modResults.contents = contents;
    return cfg;
  });
};
