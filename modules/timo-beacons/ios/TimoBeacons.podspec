Pod::Spec.new do |s|
  s.name           = 'TimoBeacons'
  s.version        = '1.0.0'
  s.summary        = 'Timo presence engine'
  s.description    = 'CoreLocation iBeacon region monitoring, check-in/check-out engine, event queue and uploader for Timo.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
