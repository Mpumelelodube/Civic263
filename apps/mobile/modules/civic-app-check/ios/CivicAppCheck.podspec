Pod::Spec.new do |s|
  s.name = 'CivicAppCheck'
  s.version = '0.1.0'
  s.summary = 'Civic263 native Firebase attestation and APNs registration'
  s.description = s.summary
  s.license = { :type => '0BSD' }
  s.author = 'Civic263'
  s.homepage = 'https://github.com/Mpumelelodube/Civic263'
  s.source = { :git => 'https://github.com/Mpumelelodube/Civic263.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'FirebaseCore', '12.19.0'
  s.dependency 'FirebaseAppCheck', '12.19.0'
  s.dependency 'FirebaseMessaging', '12.19.0'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
