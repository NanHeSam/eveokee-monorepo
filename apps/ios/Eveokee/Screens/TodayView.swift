import SwiftUI

struct TodayView: View {
    let store: BackendStore
    let player: MusicPlayer
    let namespace: Namespace.ID
    let onSong: (ConstellationDay) -> Void
    let onMoment: (Moment) -> Void
    let onSignOut: () -> Void
    @State private var draft: MomentDraft?
    @State private var settings = false
    @State private var allMoments = false
    @State private var selectedMoment: Moment?
    @State private var birth = false
    @State private var voice = VoiceCapture()
    @State private var voiceTask: Task<Void, Never>?
    @State private var voiceAttempt = UUID()
    @Environment(\.accessibilityReduceMotion) private var reduced
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var now = Date.now
    var day: ConstellationDay { store.today(now: now) }
    var moments: [Moment] { store.moments(for: day) }
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Text("eveokee ·").font(SkyTheme.serif(.title2)).dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    Spacer(minLength: 4)
                    Text(day.date.formatted(.dateTime.month(.abbreviated).day()))
                        .font(.caption).foregroundStyle(SkyTheme.dim).dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    Button { settings = true } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }
                        .buttonStyle(.plain).dynamicTypeSize(...DynamicTypeSize.xxxLarge).accessibilityLabel("Settings")
                }.padding(.horizontal, 28)
                ZStack {
                    if moments.isEmpty {
                        Button { toggleVoice() } label: {
                            Circle().fill(SkyTheme.star.opacity(0.55)).frame(width: 5, height: 5)
                                .padding(22).overlay(Circle().stroke(SkyTheme.gold.opacity(0.12)))
                                .shadow(color: SkyTheme.gold.opacity(0.35), radius: 22)
                        }.buttonStyle(.plain).accessibilityLabel("Add your first moment")
                    } else {
                        ConstellationView(moments: moments, namespace: namespace, onSelect: onMoment)
                    }
                }.frame(height: typeSize.isAccessibilitySize ? 240 : 295)
                    .scaleEffect(birth && !reduced ? 1.025 : 1)
                Text(store.loading ? "Finding your stars…" : moments.isEmpty ? "A moment can start here." : "A little of today, kept.")
                    .font(SkyTheme.serif(.title3)).multilineTextAlignment(.center).padding(.horizontal, 28)
                if !moments.isEmpty {
                    Button { allMoments = true } label: {
                        Text("\(moments.count) moments").font(.caption).foregroundStyle(SkyTheme.dim).frame(minHeight: 44)
                    }.buttonStyle(.plain).accessibilityLabel("View all moments")
                }
                VStack(spacing: 4) {
                    VoiceCaptureControl(state: voice.state, onStart: startVoice, onStop: finishVoice, onToggle: toggleVoice)
                    if voice.state != .idle {
                        Text(voice.transcript.text.isEmpty ? voice.status : voice.transcript.text)
                            .font(.body).multilineTextAlignment(.center).textSelection(.enabled)
                            .frame(maxWidth: .infinity).padding(.horizontal, 28).padding(.vertical, 12)
                        Button("Cancel recording") { cancelVoice() }.font(.caption).frame(minHeight: 44)
                    }
                    Group {
                        if typeSize.isAccessibilitySize { VStack(spacing: 4) { captureOptions } }
                        else { HStack(spacing: 24) { captureOptions } }
                    }.font(.subheadline).foregroundStyle(SkyTheme.dim)
                    if let error = voice.error {
                        Text(error).font(.caption).multilineTextAlignment(.center).padding(.horizontal, 28)
                        if voice.permissionDenied {
                            Link("Open Settings", destination: URL(string: UIApplication.openSettingsURLString)!).frame(minHeight: 44)
                        }
                    }
                }.padding(.top, moments.isEmpty ? 28 : 12)
                if !day.diaries.isEmpty {
                    DaySongCard(day: day, store: store) { onSong(day) }
                        .padding(.horizontal, 24).padding(.top, 20)
                }
            }.padding(.bottom, 24)
        }
        .task(id: day.diaries.map(\.id)) { store.watch(day: day) }
        .task { while !Task.isCancelled { now = .now; try? await Task.sleep(for: .seconds(30)) } }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { now = .now }
            else if phase == .background && voice.state != .idle { finishVoice() }
        }
        .onChange(of: voice.state) { _, state in
            // Interruption/route loss stops the tap inside the service.
            if state == .finishing && voiceTask == nil { finishVoice() }
        }
        .onDisappear { cancelVoice(resume: false) }
        .sensoryFeedback(.success, trigger: birth)
        .sheet(item: $draft) { value in
            ComposeMomentView(store: store, initialText: value.text) {
                withAnimation(reduced ? nil : SkyTheme.sheet) { birth.toggle() }
            }
        }
        .sheet(isPresented: $settings) {
            NavigationStack {
                Form {
                    Picker("Speech language", selection: $voice.language) {
                        ForEach(VoiceLanguage.allCases) { Text($0.label).tag($0) }
                    }
                    Button("Sign out", role: .destructive) { settings = false; cancelVoice(resume: false); onSignOut() }
                }.navigationTitle("Settings").toolbar { Button("Done") { settings = false } }
            }.tint(SkyTheme.gold).presentationDetents([.medium])
        }
        .sheet(isPresented: $allMoments, onDismiss: {
            if let selectedMoment { onMoment(selectedMoment); self.selectedMoment = nil }
        }) {
            NavigationStack {
                List(moments) { moment in
                    Button { selectedMoment = moment; allMoments = false } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(moment.title).fixedSize(horizontal: false, vertical: true)
                            Text(moment.kind.rawValue).font(.caption).foregroundStyle(SkyTheme.dim)
                        }.padding(.vertical, 6)
                    }.accessibilityIdentifier("moment-\(moment.id)")
                }.safeAreaInset(edge: .top) { if store.fixture { FixtureBanner() } }.navigationTitle("Today's moments").toolbar { Button("Done") { allMoments = false } }
            }.tint(SkyTheme.gold)
        }
    }
    @ViewBuilder private var captureOptions: some View {
        Button("Type instead") { draft = MomentDraft(text: "") }.underline().frame(minHeight: 44)
            .disabled(voice.state != .idle)
        Menu {
            Picker("Speech language", selection: $voice.language) {
                ForEach(VoiceLanguage.allCases) { Text($0.label).tag($0) }
            }
        } label: { Label(voice.language.label, systemImage: "globe").font(.caption).frame(minHeight: 44) }
            .disabled(voice.state != .idle).accessibilityLabel("Speech language, \(voice.language.label)")
    }
    private func startVoice() {
        guard voice.state == .idle, voiceTask == nil else { return }
        guard !store.fixture else { voice.error = "Microphone is disabled in fixture preview."; return }
        player.beginVoiceCapture()
        voiceAttempt = UUID(); let attempt = voiceAttempt
        voiceTask = Task {
            await voice.start()
            guard voiceAttempt == attempt else { return }
            voiceTask = nil
            if voice.state == .idle { player.endVoiceCapture() }
        }
    }
    private func finishVoice() {
        guard voice.state != .idle, !(voice.state == .finishing && voiceTask != nil) else { return }
        voiceTask?.cancel()
        voiceAttempt = UUID(); let attempt = voiceAttempt
        voiceTask = Task {
            let text = await voice.finish()
            guard voiceAttempt == attempt else { return }
            player.endVoiceCapture()
            voiceTask = nil
            if let text { draft = MomentDraft(text: text) }
        }
    }
    private func toggleVoice() { voice.state == .idle ? startVoice() : finishVoice() }
    private func cancelVoice(resume: Bool = true) {
        guard voice.state != .idle || voiceTask != nil else { return }
        voiceTask?.cancel()
        voiceAttempt = UUID(); let attempt = voiceAttempt
        voiceTask = Task {
            await voice.cancel()
            guard voiceAttempt == attempt else { return }
            player.endVoiceCapture(resume: resume); voiceTask = nil
        }
    }
}

struct MomentDraft: Identifiable { let id = UUID(); let text: String }

struct VoiceCaptureControl: View {
    let state: VoiceCapture.State
    let onStart: () -> Void
    let onStop: () -> Void
    let onToggle: () -> Void
    @State private var held = false
    @State private var touchTask: Task<Void, Never>?
    @Environment(\.accessibilityReduceMotion) private var reduced
    var body: some View {
        VStack(spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: state == .recording ? "stop.fill" : "mic.fill")
                    .font(.title).foregroundStyle(SkyTheme.ink).frame(width: 92, height: 92)
                    .background(SkyTheme.gold, in: Circle())
                    .overlay(Circle().stroke(SkyTheme.gold.opacity(state == .recording ? 0.35 : 0.08), lineWidth: state == .recording ? 16 : 4))
                    .shadow(color: SkyTheme.gold.opacity(0.16), radius: 24)
                    .scaleEffect(held && !reduced ? 1.06 : 1)
            }.buttonStyle(.plain)
                .highPriorityGesture(DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        guard touchTask == nil else { return }
                        touchTask = Task {
                            do { try await Task.sleep(for: .milliseconds(300)) } catch { return }
                            guard !Task.isCancelled else { return }
                            held = true; onStart()
                        }
                    }.onEnded { _ in
                        touchTask?.cancel(); touchTask = nil
                        if held { held = false; onStop() } else { onToggle() }
                    })
                .onDisappear { touchTask?.cancel(); touchTask = nil; held = false }
                .accessibilityLabel(state == .idle ? "Start voice capture" : "Stop voice capture")
                .accessibilityHint("Hold to speak and release to review, or tap to start and tap again to stop")
            Text(state == .idle ? "Hold to speak" : state == .recording ? "Tap to finish" : state == .preparing ? "Getting ready…" : "Finishing…")
                .font(.caption).foregroundStyle(SkyTheme.dim)
        }.padding(.top, 8)
    }
}

struct DaySongCard: View {
    let day: ConstellationDay
    let store: BackendStore
    let onPlay: () -> Void
    var pending: Bool { store.isComposing(day) }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                if day.song != nil { onPlay() }
                else { Task { await store.makeSong(for: day) } }
            } label: {
                HStack(spacing: 14) {
                    if pending { ProgressView().tint(SkyTheme.gold) }
                    else { Image(systemName: day.song == nil ? "waveform" : "play.fill").foregroundStyle(SkyTheme.gold) }
                    VStack(alignment: .leading, spacing: 5) {
                        Text(pending ? "Composing…" : day.song?.title ?? "Make today's song").font(SkyTheme.serif(.title3))
                            .fixedSize(horizontal: false, vertical: true)
                        Text(pending ? "Usually a minute or two. You can leave this sky." : day.song != nil ? "Play today's song" : day.hasFailedSong ? "The last song couldn't finish. Try again." : "From your latest moment")
                            .font(.caption).foregroundStyle(SkyTheme.dim).fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }.frame(maxWidth: .infinity, alignment: .leading).padding(18)
                    .background(SkyTheme.gold.opacity(0.05), in: .rect(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(SkyTheme.line, lineWidth: 0.7))
            }.buttonStyle(.plain).disabled(pending || (store.fixture && day.song == nil))
                .accessibilityLabel(pending ? "Composing" : day.song != nil ? "Play today's song" : "Make today's song")
            if let message = store.songMessage { Text(message).font(.caption).foregroundStyle(SkyTheme.dim) }
        }
    }
}

struct ComposeMomentView: View {
    let store: BackendStore
    let initialText: String
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text: String
    @FocusState private var focused: Bool
    init(store: BackendStore, initialText: String = "", onSaved: @escaping () -> Void) {
        self.store = store; self.initialText = initialText; self.onSaved = onSaved
        _text = State(initialValue: initialText)
    }
    var body: some View {
        NavigationStack {
            ZStack {
                SkyBackground()
                VStack(alignment: .leading, spacing: 18) {
                    if store.fixture { FixtureBanner() }
                    Text(initialText.isEmpty ? "A moment to keep" : "Your words, to keep").font(SkyTheme.serif(.title))
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
