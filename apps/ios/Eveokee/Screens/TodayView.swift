import SwiftUI

struct TodayView: View {
    let store: BackendStore
    let namespace: Namespace.ID
    let onSong: (ConstellationDay) -> Void
    let onMoment: (Moment) -> Void
    let onSignOut: () -> Void
    @State private var composing = false
    @State private var voiceSoon = false
    @State private var allMoments = false
    @State private var holding = false
    @State private var birth = false
    @Environment(\.accessibilityReduceMotion) private var reduced
    @Environment(\.scenePhase) private var scenePhase
    @State private var now = Date.now
    var day: ConstellationDay { store.today(now: now) }
    var moments: [Moment] { store.moments(for: day) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("eveokee ·").font(SkyTheme.serif(.title2))
                    Spacer()
                    Text(day.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()).uppercased()).font(.caption2).foregroundStyle(SkyTheme.dim)
                    Menu { Button("Sign out", role: .destructive, action: onSignOut) } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }.accessibilityLabel("Account")
                }
                Text("A little more\nof \(Text("today.").italic().foregroundStyle(SkyTheme.gold))")
            }.font(SkyTheme.serif(.largeTitle)).padding(.horizontal, 28)
            VStack(alignment: .leading, spacing: 8) {
                Text("You were here. A few things stayed.").font(.subheadline).foregroundStyle(SkyTheme.dim)
                if store.loading { ProgressView("Finding your stars…").tint(SkyTheme.gold) }
                if moments.isEmpty && !store.loading {
                    Text("A detail from earlier is enough.\nYour first star can begin anywhere.").font(SkyTheme.serif(.title3)).padding(.top, 25)
                }
            }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 28).padding(.top, 12)
            ConstellationView(moments: moments, namespace: namespace, onSelect: onMoment)
                .frame(height: moments.isEmpty ? 170 : 275)
                .scaleEffect(birth && !reduced ? 1.025 : 1)
            Button { allMoments = true } label: {
                Label("\(moments.count) little traces · touch one to remember", systemImage: "sparkle")
                    .font(.caption2).foregroundStyle(SkyTheme.dim).frame(maxWidth: .infinity, alignment: .leading)
            }.padding(.horizontal, 28).frame(minHeight: 44)
            Button { onSong(day) } label: {
                HStack(spacing: 14) {
                    Image(systemName: "waveform").font(.title2).foregroundStyle(SkyTheme.gold)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(day.song?.title ?? "A song is still to come").font(SkyTheme.serif(.title3))
                        Text(day.song == nil ? "Keep a moment. Come back to the music." : "Today's song · made from these moments").font(.caption2).foregroundStyle(SkyTheme.dim)
                    }
                    Spacer(); Image(systemName: "chevron.right").font(.caption)
                }.padding(18).background(SkyTheme.gold.opacity(0.05), in: .rect(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(SkyTheme.line, lineWidth: 0.7))
            }.buttonStyle(.plain).padding(.horizontal, 24)
            VStack(spacing: 10) {
                Button { voiceSoon = true } label: {
                    Image(systemName: "mic").font(.title2).frame(width: 34, height: 34)
                }.buttonStyle(GoldButtonStyle())
                    .scaleEffect(holding && !reduced ? 1.08 : 1)
                    .onLongPressGesture(minimumDuration: 0.55, pressing: { holding = $0 }) { voiceSoon = true }
                    .accessibilityLabel("Hold a thought. Voice capture coming soon")
                Text("Hold a thought.").font(.caption)
                Text("Voice coming soon · even hours after it happened.").font(.caption2).foregroundStyle(SkyTheme.dim)
                Button("Leave a few words instead") { composing = true }.font(.subheadline).underline().frame(minHeight: 44)
            }.frame(maxWidth: .infinity).padding(.top, 24).padding(.bottom, 20)
        }
        .task(id: day.diaries.map(\.id)) { store.watch(day: day) }
        .task { while !Task.isCancelled { now = .now; try? await Task.sleep(for: .seconds(30)) } }
        .onChange(of: scenePhase) { _, phase in if phase == .active { now = .now } }
        .sensoryFeedback(.success, trigger: birth)
        .sheet(isPresented: $composing) {
            ComposeMomentView(store: store) {
                withAnimation(reduced ? nil : SkyTheme.sheet) { birth.toggle() }
            }
        }
        .sheet(isPresented: $allMoments) {
            NavigationStack {
                List(moments) { moment in
                    Button { allMoments = false; onMoment(moment) } label: { Label(moment.title, systemImage: "sparkle") }
                }.safeAreaInset(edge: .top) { if store.fixture { FixtureBanner() } }.navigationTitle("This day's traces").toolbar { Button("Done") { allMoments = false } }
            }.tint(SkyTheme.gold)
        }
        .alert("One spoken line, soon.", isPresented: $voiceSoon) { Button("I'll leave words instead") { composing = true }; Button("Stay here", role: .cancel) {} } message: {
            Text("Voice capture and transcription are coming next. No microphone is recording.")
        }
    }
}

struct ComposeMomentView: View {
    let store: BackendStore
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @FocusState private var focused: Bool
    var body: some View {
        NavigationStack {
            ZStack {
                SkyBackground()
                VStack(alignment: .leading, spacing: 18) {
                    if store.fixture { FixtureBanner() }
                    Text("Let it find a place.").font(SkyTheme.serif(.largeTitle))
                    Text("A detail. A feeling. Something from earlier.\nOne line is enough.").font(.subheadline).foregroundStyle(SkyTheme.dim)
                    TextEditor(text: $text).scrollContentBackground(.hidden).font(.body).focused($focused)
                        .accessibilityLabel("A moment to keep").frame(minHeight: 150)
                    if store.fixture { Text("Fixture preview · saving is disabled").font(.caption).foregroundStyle(SkyTheme.dim) }
                    if let error = store.error { Text(error).font(.caption).foregroundStyle(SkyTheme.paper) }
                    Button {
                        Task { if await store.createMoment(text) { onSaved(); dismiss() } }
                    } label: {
                        HStack { if store.saving { ProgressView() }; Text("Keep this moment") }.frame(maxWidth: .infinity)
                    }.buttonStyle(GoldButtonStyle()).disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.saving || store.fixture)
                }.padding(28)
            }.toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }.tint(SkyTheme.gold).foregroundStyle(SkyTheme.paper).task { focused = true }
    }
}
