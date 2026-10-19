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
    let fixture: Bool
    @ObservationIgnored private var client: ConvexClientWithAuth<String>?
    @ObservationIgnored private var subscriptions: [AnyCancellable] = []
    @ObservationIgnored private var daySubscriptions: [AnyCancellable] = []
    @ObservationIgnored private var watchingIDs: Set<String> = []
    @ObservationIgnored private var generation = UUID()

    init(fixture: Bool = false) {
        self.fixture = fixture
        if fixture {
            diaries = Fixtures.diaries
            playlist = Fixtures.music
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
            observe(client.subscribe(to: "diaries:listDiaries", yielding: [Diary].self)) { store, value in
                store.diaries = value; store.loading = false
            }
            observe(client.subscribe(to: "music:listPlaylistMusic", yielding: [Music].self)) { $0.playlist = $1 }
        }
    }
    func disconnect() {
        guard !fixture else { return }
        generation = UUID()
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
    private func observe<T: Decodable & Sendable>(_ publisher: AnyPublisher<T, ClientError>, detail: Bool = false, update: @escaping @MainActor (BackendStore, T) -> Void) {
        let epoch = generation
        let subscription = publisher.sink { [weak self] completion in
            if case .failure(let failure) = completion {
                let message = failure.localizedDescription
                Task { @MainActor [weak self] in
                    guard let self, self.generation == epoch else { return }
                    self.error = message; self.loading = false
                }
            }
        } receiveValue: { [weak self] value in
            Task { @MainActor [weak self] in
                guard let self, self.generation == epoch else { return }
                update(self, value)
            }
        }
        if detail { daySubscriptions.append(subscription) } else { subscriptions.append(subscription) }
    }
    func createMoment(_ content: String) async -> Bool {
        guard !fixture, let client, connected, !saving else { return false }
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return false }
        saving = true
        defer { saving = false }
        do {
            let _: CreatedDiary = try await client.mutation("diaries:createDiary", with: ["content": text])
            return true // Subscription supplies the committed document; no invented star.
        } catch { self.error = error.localizedDescription; return false }
    }
}
