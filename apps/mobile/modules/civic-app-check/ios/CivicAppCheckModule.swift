import ExpoModulesCore
import UIKit
import FirebaseCore
import FirebaseAppCheck
import FirebaseMessaging

private class CivicAppAttestFactory: NSObject, AppCheckProviderFactory {
  func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
    return AppAttestProvider(app: app)
  }
}

enum CivicFirebase {
  static func configure() {
    if FirebaseApp.app() == nil {
      AppCheck.setAppCheckProviderFactory(CivicAppAttestFactory())
      if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
        FirebaseApp.configure()
      }
    }
  }
}

public class CivicFirebaseAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    CivicFirebase.configure()
    return true
  }
}

public class CivicAppCheckModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CivicAppCheck")
    AsyncFunction("getAppCheckTokenAsync") { (forceRefresh: Bool, promise: Promise) in
      CivicFirebase.configure()
      guard let app = FirebaseApp.app() else {
        promise.reject("ERR_APP_CHECK", "Native Firebase configuration is missing.")
        return
      }
      AppCheck.appCheck().token(forcingRefresh: forceRefresh) { result, _ in
        guard let result = result else {
          promise.reject("ERR_APP_CHECK", "Could not verify this device. Connect and retry.")
          return
        }
        promise.resolve(["token": result.token, "expireTimeMillis": result.expirationDate.timeIntervalSince1970 * 1000, "projectId": app.options.projectID ?? ""])
      }
    }
    AsyncFunction("getMessagingTokenAsync") { (apnsToken: String, promise: Promise) in
      CivicFirebase.configure()
      guard FirebaseApp.app() != nil, apnsToken.count >= 32, apnsToken.count <= 256, apnsToken.count % 2 == 0, apnsToken.allSatisfy({ $0.isHexDigit }) else {
        promise.reject("ERR_PUSH", "A valid Apple push registration is required.")
        return
      }
      var bytes = Data()
      var index = apnsToken.startIndex
      while index < apnsToken.endIndex {
        let end = apnsToken.index(index, offsetBy: 2)
        guard let byte = UInt8(apnsToken[index..<end], radix: 16) else { return }
        bytes.append(byte)
        index = end
      }
      Messaging.messaging().apnsToken = bytes
      Messaging.messaging().token { token, _ in
        guard let token = token else {
          promise.reject("ERR_PUSH", "Could not register push updates. Connect and retry.")
          return
        }
        promise.resolve(token)
      }
    }
  }
}
