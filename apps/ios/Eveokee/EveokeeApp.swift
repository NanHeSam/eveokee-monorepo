import SwiftUI
import ClerkKit
import ClerkKitUI

@main
struct EveokeeApp: App {
    private let fixture: Bool
    private let testing: Bool
    private let configured: Bool
    private let clerk: Clerk?
    @State private var store: BackendStore
    @State private var player = MusicPlayer()
    init() {
        #if DEBUG
        fixture = ProcessInfo.processInfo.arguments.contains("--fixture-preview")
        #else
        fixture = false
        #endif
        testing = ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
        let key = Bundle.main.object(forInfoDictionaryKey: "CLERK_PUBLISHABLE_KEY") as? String ?? ""
        let url = Bundle.main.object(forInfoDictionaryKey: "CONVEX_URL") as? String ?? ""
        configured = key.hasPrefix("pk_test_") && URL(string: url)?.scheme == "https" && url.hasSuffix(".convex.cloud")
        clerk = !fixture && !testing && configured ? Clerk.configure(publishableKey: key) : nil
        _store = State(initialValue: BackendStore(fixture: fixture))
    }
    var body: some Scene {
        WindowGroup {
            Group {
                if fixture {
                    AppShell(store: store, player: player, onSignOut: {})
                } else if let clerk {
                    AuthenticatedRoot(store: store, player: player).environment(clerk)
                } else {
                    ZStack { SkyBackground(); Text(testing ? "Running local tests" : "Add your development keys in Config/Secrets.xcconfig, then rebuild.").padding(32).foregroundStyle(SkyTheme.paper) }
                }
            }.preferredColorScheme(.dark)
        }
    }
}

private struct AuthenticatedRoot: View {
    let store: BackendStore
    let player: MusicPlayer
    @Environment(Clerk.self) private var clerk
    @State private var signingOut = false
    private var sessionKey: String { "\(clerk.isLoaded)-\(clerk.session?.id ?? "none")-\(clerk.session?.status.rawValue ?? "none")" }
    var body: some View {
        Group {
            if clerk.session?.status == .active {
                AppShell(store: store, player: player) {
                    Task {
                        signingOut = true
                        do { try await clerk.auth.signOut(); store.disconnect(); player.clear() }
                        catch { store.error = error.localizedDescription }
                        signingOut = false
                    }
                }.overlay { if signingOut { ProgressView().padding().background(SkyTheme.ink, in: Capsule()) } }
            } else { SignInView() }
        }.task(id: sessionKey) {
            player.clear()
            if clerk.isLoaded, clerk.session?.status == .active,
               let url = Bundle.main.object(forInfoDictionaryKey: "CONVEX_URL") as? String { await store.connect(url: url) }
            else { store.disconnect() }
        }.onOpenURL { url in Task { do { _ = try await clerk.handle(url) } catch { store.error = error.localizedDescription } } }
    }
}

private struct SignInView: View {
    @Environment(Clerk.self) private var clerk
    @State private var auth = false
    @State private var working = false
    @State private var error: String?
    @Namespace private var namespace
    var body: some View {
        ZStack {
            SkyBackground()
            ScrollView {
                VStack(spacing: 22) {
                    HStack { Text("eveokee ·").font(SkyTheme.serif(.title2)); Spacer(); Image(systemName: "sparkle").foregroundStyle(SkyTheme.gold) }.padding(.top, 20)
                    Eyebrow(text: "A little more of your life, kept")
                    Text("Your days,\n\(Text("still here.").italic().foregroundColor(SkyTheme.gold))").font(SkyTheme.serif(.largeTitle)).multilineTextAlignment(.center).padding(.top, 25)
                    ConstellationView(moments: Array(Moment.make(day: .init(date: .now, diaries: Array(Fixtures.diaries.prefix(1)), music: []), details: [:], media: [:]).prefix(4)), showsLabels: false, namespace: namespace, onSelect: { _ in })
                        .frame(height: 220).allowsHitTesting(false).accessibilityHidden(true)
                    Text("A moment becomes a star.\nA day becomes a song.").font(SkyTheme.serif(.title3)).multilineTextAlignment(.center).foregroundStyle(SkyTheme.dim)
                    Button {
                        working = true; error = nil
                        Task {
                            defer { working = false }
                            do {
                                _ = try await clerk.auth.signInWithApple()
                                if clerk.session?.status != .active { auth = true }
                            } catch { self.error = error.localizedDescription }
                        }
                    } label: { Label("Continue with Apple", systemImage: "apple.logo").frame(maxWidth: .infinity) }.buttonStyle(GoldButtonStyle()).disabled(!clerk.isLoaded || working)
                    Button("Continue with email") { auth = true }.frame(maxWidth: .infinity, minHeight: 50).overlay(Capsule().stroke(SkyTheme.line)).disabled(!clerk.isLoaded || working)
                    if !clerk.isLoaded || working { ProgressView().tint(SkyTheme.gold).accessibilityLabel("Connecting to sign in") }
                    if let error { Text(error).font(.caption).foregroundStyle(SkyTheme.paper) }
                    Text("A private sky, waiting for you.").font(.caption).foregroundStyle(SkyTheme.dim).padding(.bottom, 25)
                }.padding(.horizontal, 28).frame(maxWidth: 560).frame(maxWidth: .infinity)
            }
        }.foregroundStyle(SkyTheme.paper).tint(SkyTheme.gold)
            .sheet(isPresented: $auth) {
                AuthView().environment(clerk)
                    .environment(\.clerkTheme.colors.primary, SkyTheme.gold)
                    .environment(\.clerkTheme.colors.background, SkyTheme.ink)
                    .preferredColorScheme(.dark)
            }
    }
}
