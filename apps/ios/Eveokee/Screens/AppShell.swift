import SwiftUI

struct AppShell: View {
    enum Page: String, CaseIterable { case today = "Today", song = "The song", sky = "My sky"
        var symbol: String { switch self { case .today: "sparkle"; case .song: "music.note"; case .sky: "sparkles" } }
    }
    let store: BackendStore
    let player: MusicPlayer
    let onSignOut: () -> Void
    @State private var page: Page = .today
    @State private var selectedDate: Date?
    @State private var moment: Moment?
    @State private var resumeAfterMemory = false
    @Namespace private var sky
    @Environment(\.accessibilityReduceMotion) private var reduced
    @Environment(\.dynamicTypeSize) private var typeSize
    private var selectedDay: ConstellationDay { store.days.first { $0.id == selectedDate } ?? store.today() }
    var body: some View {
        VStack(spacing: 0) {
            if store.fixture { FixtureBanner() }
            if let error = store.error {
                HStack { Text(error).font(.caption); Button("Retry") { Task { if let url = Bundle.main.object(forInfoDictionaryKey: "CONVEX_URL") as? String { await store.connect(url: url) } } }; Button("Dismiss") { store.error = nil } }.padding(12).background(SkyTheme.ink)
            }
            Group {
                switch page {
                case .today: TodayView(store: store, player: player, namespace: sky, onSong: openSong, onMoment: openMoment, onSignOut: onSignOut)
                case .song: SongView(day: selectedDay, store: store, player: player, namespace: sky, onMoment: openMoment)
                case .sky: MySkyView(store: store, onPlay: openSong)
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
                .transition(.opacity.combined(with: .offset(y: reduced ? 0 : 15)))
            HStack(spacing: 0) {
                ForEach(Page.allCases, id: \.self) { next in
                    Button {
                        if next == .song, selectedDate == nil { selectedDate = store.today().date; if let song = selectedDay.song { player.load(song, autoplay: false) } }
                        withAnimation(reduced ? nil : SkyTheme.ease) { page = next }
                    } label: {
                        VStack(spacing: 7) {
                            if typeSize.isAccessibilitySize {
                                Image(systemName: next.symbol).font(.title3).dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                            } else {
                                HStack(spacing: 8) { Image(systemName: next.symbol); Text(next.rawValue).font(.caption) }
                            }
                            Circle().fill(page == next ? SkyTheme.gold : .clear).frame(width: 3, height: 3)
                        }.frame(maxWidth: .infinity, minHeight: 48).contentShape(Rectangle())
                    }.buttonStyle(.plain).foregroundStyle(page == next ? SkyTheme.paper : SkyTheme.dim)
                        .accessibilityLabel(next.rawValue)
                        .accessibilityAddTraits(page == next ? [.isSelected] : [])
                }
            }.padding(.horizontal, 24).padding(.top, 10).overlay(alignment: .top) { Rectangle().fill(SkyTheme.line).frame(height: 0.5).padding(.horizontal, 24) }
        }.background { SkyBackground() }.foregroundStyle(SkyTheme.paper).tint(SkyTheme.gold)
            .sheet(item: $moment, onDismiss: { if resumeAfterMemory { player.play() }; resumeAfterMemory = false }) { MemoryView(moment: $0, fixture: store.fixture) }
            .onAppear {
                #if DEBUG
                if let value = ProcessInfo.processInfo.environment["EVEO_PREVIEW_SCREEN"], let next = Page(rawValue: value), store.fixture {
                    page = next
                    if next == .song, let day = store.days.first {
                        selectedDate = day.date
                        // UI fixture has no audio URL, but uses the real lyric/timeline views.
                        if let track = day.music.first { player.load(track, autoplay: false); player.seek(42) }
                    }
                }
                #endif
            }
    }
    private func openSong(_ day: ConstellationDay) {
        selectedDate = day.date
        if let song = day.song ?? (store.fixture ? day.music.first : nil) { player.load(song, autoplay: true) }
        else { player.clear() }
        withAnimation(reduced ? nil : SkyTheme.ease) { page = .song }
    }
    private func openMoment(_ value: Moment) {
        resumeAfterMemory = player.playing
        player.pause()
        moment = value
    }
}
