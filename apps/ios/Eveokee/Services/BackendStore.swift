import Foundation
import Observation
@preconcurrency import Combine
@preconcurrency import ConvexMobile
import ClerkKit

// The official ClerkConvex 0.1.0 provider calls getToken() without a template.
// This deployment requires aud=convex, so request its existing JWT template.
@MainActor
final class ConvexTemplateAuthProvider: AuthProvider {
    typealias T = String
    func login(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
        try await token()
    }
    func loginFromCache(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
        try await token()
    }
    private func token() async throws -> String {
        guard let session = Clerk.shared.session, session.status == .active,
              let token = try await session.getToken(.init(template: "convex")) else {
            throw NativeError.message("Sign in again to reconnect your sky.")
        }
        return token
    }
    // Clerk session lifetime belongs to AuthenticatedRoot. Logout here only clears Convex auth.
    func logout() async throws {}
    nonisolated func extractIdToken(from authResult: String) -> String { authResult }
}

enum NativeError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { text } else { "Something went quiet. Try again." } }
}

@MainActor @Observable
final class BackendStore {
    private(set) var diaries: [Diary] = []
    private(set) var playlist: [Music] = []
    private(set) var details: [String: Diary] = [:]
    private(set) var media: [String: [DiaryMedia]] = [:]
    private(set) var loading = false
    private(set) var connected = false
    var error: String?
    private(set) var saving = false
    private(set) var requestingSongs: Set<String> = []
    private(set) var awaitingSongs: Set<String> = []
    var songMessage: String?
    @ObservationIgnored private var awaitingBaselines: [String: Set<String>] = [:]
    @ObservationIgnored private var operations: NativeOperations?
    let fixture: Bool
    @ObservationIgnored private var client: ConvexClientWithAuth<String>?
    @ObservationIgnored private var subscriptions: [AnyCancellable] = []
    @ObservationIgnored private var daySubscriptions: [AnyCancellable] = []
    @ObservationIgnored private var watchingIDs: Set<String> = []
    @ObservationIgnored private var generation = UUID()

    init(fixture: Bool = false, operations: NativeOperations? = nil) {
        self.operations = operations
        connected = operations != nil
        self.fixture = fixture
        if fixture {
            diaries = Fixtures.diaries
            playlist = Fixtures.music
            #if DEBUG
            switch ProcessInfo.processInfo.environment["EVEO_FIXTURE_STATE"] {
            case "empty": diaries = []; playlist = []
            case "moments": playlist = []
            case "composing": playlist = [Fixtures.pendingMusic]
            default: break
            }
            #endif
            details = Dictionary(uniqueKeysWithValues: diaries.map { ($0.id, $0) })
            media = Fixtures.media
            connected = true
        }
    }
    var days: [ConstellationDay] { ConstellationDay.group(diaries: diaries, playlist: playlist) }
    func today(now: Date = .now) -> ConstellationDay {
        days.first { Calendar.current.isDate($0.date, inSameDayAs: now) }
            ?? ConstellationDay(date: Calendar.current.startOfDay(for: now), diaries: [], music: [])
    }
    func moments(for day: ConstellationDay) -> [Moment] { Moment.make(day: day, details: details, media: media) }

    func connect(url: String) async {
        guard !fixture else { return }
        disconnect()
        let attempt = generation
        loading = true
        let client = ConvexClientWithAuth(deploymentUrl: url, authProvider: ConvexTemplateAuthProvider())
        self.client = client
        let result = await client.loginFromCache()
        guard attempt == generation, !Task.isCancelled else { return }
        switch result {
        case .failure(let failure):
            loading = false; error = failure.localizedDescription
        case .success:
            connected = true
            operations = .live(client)
            observe(client.subscribe(to: "diaries:listDiaries", yielding: [Diary].self)) { store, value in
                store.diaries = value; store.loading = false
            }
            observe(client.subscribe(to: "music:listPlaylistMusic", yielding: [Music].self)) { $0.receivePlaylist($1) }
        }
    }
    func disconnect() {
        guard !fixture else { return }
        generation = UUID()
        operations = nil; requestingSongs = []; awaitingSongs = []; awaitingBaselines = [:]; songMessage = nil; saving = false
        subscriptions.removeAll(); daySubscriptions.removeAll(); watchingIDs = []
        diaries = []; playlist = []; details = [:]; media = [:]
        connected = false; loading = false; error = nil
        let previous = client
        client = nil
        if let previous { Task { await previous.logout() } }
    }
    func watch(day: ConstellationDay) {
        guard !fixture, let client else { return }
        let ids = Set(day.diaries.map(\.id))
        guard watchingIDs != ids else { return }
        daySubscriptions.removeAll(); watchingIDs = ids
        for id in ids.sorted() {
            observe(client.subscribe(to: "diaries:getDiary", with: ["diaryId": id], yielding: Diary?.self), detail: true) { store, value in
                if let value { store.details[id] = value } else { store.details.removeValue(forKey: id) }
            }
            observe(client.subscribe(to: "diaryMedia:getDiaryMedia", with: ["diaryId": id], yielding: [DiaryMedia].self), detail: true) { $0.media[id] = $1 }
        }
    }
    func observe<T: Decodable & Sendable>(_ publisher: AnyPublisher<T, ClientError>, detail: Bool = false, update: @escaping @MainActor (BackendStore, T) -> Void) {
        let epoch = generation
        // Convex invokes Combine subscribers on its Rust worker thread. Schedule before
        // entering these MainActor closures: a Task inside the sink is already too late
        // to avoid Swift 6's isolation check at the callback's entry point.
        let subscription = publisher.receive(on: DispatchQueue.main).sink { [weak self] completion in
            guard let self, self.generation == epoch else { return }
            if case .failure(let failure) = completion {
                self.error = failure.localizedDescription; self.loading = false
            }
        } receiveValue: { [weak self] value in
            guard let self, self.generation == epoch else { return }
            update(self, value)
        }
        if detail { daySubscriptions.append(subscription) } else { subscriptions.append(subscription) }
    }
    func createMoment(_ content: String) async -> Bool {
        guard !fixture, let operations, connected, !saving else { return false }
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return false }
        let epoch = generation
        saving = true; error = nil
        defer { if generation == epoch { saving = false } }
        do {
            try await operations.createDiary(text)
            return generation == epoch // Subscription supplies the committed star.
        } catch { if generation == epoch { self.error = "Couldn't keep this moment. Your words are still here; try again." }; return false }
    }

    func isComposing(_ day: ConstellationDay) -> Bool {
        day.hasPendingSong || day.diaries.contains { requestingSongs.contains($0.id) || awaitingSongs.contains($0.id) }
    }
    func receivePlaylist(_ value: [Music]) {
        playlist = value
        // Once a real row arrives, the subscription owns pending/ready/failed.
        for id in awaitingSongs {
            let baseline = awaitingBaselines[id] ?? []
            if value.contains(where: { $0.diaryId == id && ($0.status == "pending" || !baseline.contains($0.id)) }) {
                awaitingSongs.remove(id); awaitingBaselines.removeValue(forKey: id)
            }
        }
    }
    func makeSong(for day: ConstellationDay) async {
        guard !fixture, connected, let operations, !isComposing(day), day.song == nil,
              let latest = day.latestDiary else { return }
        let epoch = generation
        let baseline = Set(playlist.filter { $0.diaryId == latest.id }.map(\.id))
        requestingSongs.insert(latest.id); songMessage = nil
        defer { if generation == epoch { requestingSongs.remove(latest.id) } }
        do {
            let fetched = try await operations.latestDiary(latest.id)
            guard generation == epoch else { return }
            guard let current = fetched else { songMessage = "This moment is no longer available. Choose another moment."; return }
            guard !current.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                songMessage = "Add a few words to this moment first."; return
            }
            // This action overwrites content. Never join multiple diaries here.
            let result = try await operations.generateSong(current.id, current.content)
            guard generation == epoch else { return }
            songMessage = result.message
            if result.accepted {
                if !playlist.contains(where: { $0.diaryId == current.id && ($0.status == "pending" || !baseline.contains($0.id)) }) {
                    awaitingSongs.insert(current.id); awaitingBaselines[current.id] = baseline
                }
                // Acknowledgement precedes the scheduled pending-row insertion.
                // No retries: an uncertain response must not spend more credits.
                Task { [weak self] in
                    try? await Task.sleep(for: .seconds(180))
                    guard let self, self.generation == epoch, self.awaitingSongs.remove(current.id) != nil else { return }
                    self.awaitingBaselines.removeValue(forKey: current.id)
                    self.songMessage = "The song is taking longer to appear. Check back shortly before trying again."
                }
            }
        } catch {
            guard generation == epoch else { return }
            songMessage = "Couldn't confirm the song request. Check back shortly before trying again; your moment is safe."
        }
    }
}
