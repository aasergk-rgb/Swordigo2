import SwiftUI

@main
struct LuminabladeApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .statusBarHidden()
                .persistentSystemOverlays(.hidden)
                .background(Color.black)
        }
    }
}
