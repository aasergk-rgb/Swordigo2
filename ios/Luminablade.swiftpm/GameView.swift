import SwiftUI
import WebKit

/// Shows the web build of the game full screen.
struct GameView: UIViewRepresentable {
    func makeCoordinator() -> SaveStore {
        SaveStore()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(WebFiles(), forURLScheme: WebFiles.scheme)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // The save lives in UserDefaults: handed to the page at start-up, updated on each save.
        let content = config.userContentController
        content.add(context.coordinator, name: "save")
        let startup = "window.__nativeApp = 'ios'; window.__nativeSave = \(SaveStore.jsLiteral(context.coordinator.load()));"
        content.addUserScript(WKUserScript(source: startup, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.load(URLRequest(url: URL(string: "\(WebFiles.scheme)://game/index.html")!))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// Keeps the game's save data (a JSON string) in UserDefaults.
final class SaveStore: NSObject, WKScriptMessageHandler {
    private static let key = "luminablade.save"

    func load() -> String? {
        UserDefaults.standard.string(forKey: Self.key)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let text = message.body as? String {
            UserDefaults.standard.set(text, forKey: Self.key)
        }
    }

    /// A JavaScript literal for the string: quoted and escaped, or `null`.
    static func jsLiteral(_ text: String?) -> String {
        guard let text, let data = try? JSONEncoder().encode(text), let json = String(data: data, encoding: .utf8) else {
            return "null"
        }
        return json
    }
}

/// Serves the files in Web/ at app://game/… so the page loads like a normal website.
final class WebFiles: NSObject, WKURLSchemeHandler {
    static let scheme = "app"
    private let root: URL? = Bundle.module.url(forResource: "Web", withExtension: nil)

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, let root else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst()))
        guard let data = try? Data(contentsOf: file) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let headers = [
            "Content-Type": Self.mimeType(file.pathExtension),
            "Content-Length": String(data.count),
            "Access-Control-Allow-Origin": "*",
        ]
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func mimeType(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "png": return "image/png"
        case "svg": return "image/svg+xml"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }
}
