// swift-tools-version: 5.8

// Swift Playgrounds app: open this folder (Luminablade.swiftpm) in Swift Playgrounds on iPad
// and press Run. The game itself is the web build in Web/ (made with `npm run ios`).

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "Luminablade",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "Luminablade",
            targets: ["AppModule"],
            bundleIdentifier: "com.luminablade.game",
            teamIdentifier: "",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .asset("AppIcon"),
            accentColor: .presetColor(.yellow),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .landscapeRight,
                .landscapeLeft
            ],
            appCategory: .actionGames
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: ".",
            resources: [
                .copy("Web")
            ]
        )
    ]
)
