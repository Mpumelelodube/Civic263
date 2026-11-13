package co.zw.civic263.appcheck

import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CivicAppCheckModule : Module() {
  private var configured = false

  override fun definition() = ModuleDefinition {
    Name("CivicAppCheck")
    AsyncFunction("getAppCheckTokenAsync") { forceRefresh: Boolean, promise: Promise ->
      try {
        val app = FirebaseApp.getInstance()
        val check = FirebaseAppCheck.getInstance(app)
        if (!configured) {
          check.installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance())
          check.setTokenAutoRefreshEnabled(true)
          configured = true
        }
        check.getAppCheckToken(forceRefresh)
          .addOnSuccessListener { result ->
            promise.resolve(mapOf("token" to result.token, "expireTimeMillis" to result.expireTimeMillis, "projectId" to app.options.projectId))
          }
          .addOnFailureListener { error -> promise.reject("ERR_APP_CHECK", "Could not verify this device. Connect to the internet and retry.", error) }
      } catch (error: Exception) {
        promise.reject("ERR_APP_CHECK", "Native app verification is unavailable in this build.", error)
      }
    }
  }
}
