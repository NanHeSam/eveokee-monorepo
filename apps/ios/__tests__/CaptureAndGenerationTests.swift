import XCTest
@testable import Eveokee

@MainActor
final class CaptureAndGenerationTests: XCTestCase {
    private func diary(_ id: String, content: String, date: Double = 1, title: String? = nil, events: [MemoryEvent]? = nil) -> Diary {
        Diary(_id: id, userId: nil, title: title, content: content, date: date, updatedAt: date, primaryMusicId: nil, primaryMusic: nil, events: events)
    }
    func testTranscriptReplacesPartialAndPreservesFinalChineseAndEnglish() async {
        var transcript = VoiceTranscript()
        transcript.receive("今", final: false)
        transcript.receive("今天散步。", final: true)
        transcript.receive(" A quiet", final: false)
        transcript.receive(" A quiet walk.", final: false)
        XCTAssertEqual(transcript.text, "今天散步。 A quiet walk.")
        transcript.receive(" A quiet walk.", final: true)
        XCTAssertEqual(transcript.text, "今天散步。 A quiet walk.")
        var saved: [String] = []
        let store = BackendStore(operations: .init(createDiary: { saved.append($0) }, latestDiary: { _ in nil }, generateSong: { _, _ in throw NativeError.message("Unexpected generation") }))
        let kept = await store.createMoment(transcript.text + " Edited before saving.")
        XCTAssertTrue(kept)
        XCTAssertEqual(saved, ["今天散步。 A quiet walk. Edited before saving."])
        let empty = await store.createMoment(" \n ")
        XCTAssertFalse(empty)
    }
    func testFailedSaveKeepsFailureVisibleAndCanRetry() async {
        let store = BackendStore(operations: .init(createDiary: { _ in throw NativeError.message("Offline") }, latestDiary: { _ in nil }, generateSong: { _, _ in throw NativeError.message("Unexpected") }))
        let kept = await store.createMoment("Words remain in the review sheet")
        XCTAssertFalse(kept)
        XCTAssertNotNil(store.error)
        XCTAssertFalse(store.saving)
    }
    func testLanguagePreferenceFollowsFirstChineseOrEnglishAndCanSwitch() {
        XCTAssertEqual(VoiceLanguage.preferred(["fr-FR", "zh-Hans-CN", "en-US"]), .chinese)
        XCTAssertEqual(VoiceLanguage.preferred(["en-GB", "zh-CN"]), .english)
        XCTAssertEqual(VoiceLanguage.preferred([]), .english)
    }
    func testGenerationFetchesNewestDiaryAndPassesItsExactContentOnlyOnce() async {
        let old = diary("older", content: "Do not combine this", date: 1)
        let cached = diary("newest", content: "Stale content", date: 2)
        let current = diary("newest", content: "  当前内容\nExact current words.  ", date: 2)
        var sent: [(String, String)] = []
        let store = BackendStore(operations: .init(createDiary: { _ in }, latestDiary: { id in
            XCTAssertEqual(id, "newest"); return current
        }, generateSong: { id, content in
            sent.append((id, content)); return SongGenerationResult(diaryId: id, success: true, code: nil)
        }))
        let day = ConstellationDay(date: .now, diaries: [cached, old], music: [])
        await store.makeSong(for: day)
        await store.makeSong(for: day)
        XCTAssertEqual(sent.count, 1)
        XCTAssertEqual(sent.first?.0, "newest")
        XCTAssertEqual(sent.first?.1, current.content)
        XCTAssertTrue(store.isComposing(day))
        let pending = try! JSONDecoder().decode(Music.self, from: Data(#"{"_id":"track","diaryId":"newest","status":"pending"}"#.utf8))
        store.receivePlaylist([pending])
        let pendingDay = ConstellationDay(date: .now, diaries: [cached, old], music: [pending])
        XCTAssertTrue(store.isComposing(pendingDay))
        XCTAssertTrue(store.awaitingSongs.isEmpty)
        let ready = try! JSONDecoder().decode(Music.self, from: Data(#"{"_id":"track","diaryId":"newest","status":"ready","audioUrl":"https://assets.example.test/song.mp3"}"#.utf8))
        store.receivePlaylist([ready])
        let readyDay = ConstellationDay(date: .now, diaries: [cached, old], music: [ready])
        XCTAssertFalse(store.isComposing(readyDay))
        XCTAssertEqual(readyDay.song?.id, "track")
    }
    func testUsageLimitAndAlreadyInProgressAndErrors() async {
        let entry = diary("diary", content: "One moment")
        let day = ConstellationDay(date: .now, diaries: [entry], music: [])
        for code in ["USAGE_LIMIT_REACHED", "ALREADY_IN_PROGRESS", "UNKNOWN_ERROR"] {
            let store = BackendStore(operations: .init(createDiary: { _ in }, latestDiary: { _ in entry }, generateSong: { _, _ in SongGenerationResult(diaryId: entry.id, success: false, code: code) }))
            await store.makeSong(for: day)
            XCTAssertNotNil(store.songMessage)
            XCTAssertEqual(store.isComposing(day), code == "ALREADY_IN_PROGRESS")
            XCTAssertTrue(store.requestingSongs.isEmpty)
        }
        let store = BackendStore(operations: .init(createDiary: { _ in }, latestDiary: { _ in entry }, generateSong: { _, _ in throw NativeError.message("Offline") }))
        await store.makeSong(for: day)
        XCTAssertNotNil(store.songMessage)
        XCTAssertTrue(store.requestingSongs.isEmpty)
    }
    func testOldFailedRowCannotClearNewGenerationAcknowledgement() async throws {
        let entry = diary("d", content: "A new attempt")
        let failed = try JSONDecoder().decode(Music.self, from: Data(#"{"_id":"old","diaryId":"d","status":"failed"}"#.utf8))
        let day = ConstellationDay(date: .now, diaries: [entry], music: [failed])
        var count = 0
        let store = BackendStore(operations: .init(createDiary: { _ in }, latestDiary: { _ in entry }, generateSong: { _, _ in
            count += 1; return SongGenerationResult(diaryId: entry.id, success: true, code: nil)
        }))
        store.receivePlaylist([failed])
        await store.makeSong(for: day)
        store.receivePlaylist([failed])
        await store.makeSong(for: day)
        XCTAssertTrue(store.isComposing(day))
        XCTAssertEqual(count, 1)
    }
    func testSignOutDuringFreshReadDoesNotSendGeneration() async {
        let entry = diary("d", content: "Current words")
        var continuation: CheckedContinuation<Diary?, Never>?
        var count = 0
        let store = BackendStore(operations: .init(createDiary: { _ in }, latestDiary: { _ in
            await withCheckedContinuation { continuation = $0 }
        }, generateSong: { _, _ in
            count += 1; return SongGenerationResult(diaryId: entry.id, success: true, code: nil)
        }))
        let task = Task { await store.makeSong(for: .init(date: .now, diaries: [entry], music: [])) }
        while continuation == nil { await Task.yield() }
        store.disconnect()
        continuation?.resume(returning: entry)
        await task.value
        XCTAssertEqual(count, 0)
        XCTAssertTrue(store.requestingSongs.isEmpty)
        XCTAssertNil(store.songMessage)
    }

    func testDuplicateEventTitlesAndSongDoNotCreateDuplicateStars() {
        let event = MemoryEvent(_id: "event", diaryId: "d", happenedAt: 1, title: "A quiet walk", summary: "A detail", personIds: nil, peopleDetails: nil)
        let entry = diary("d", content: "Original", title: "A quiet walk", events: [event])
        let moments = Moment.make(day: .init(date: .now, diaries: [entry], music: Fixtures.music), details: [:], media: [:])
        XCTAssertEqual(moments.count, 1)
        XCTAssertEqual(moments.first?.body, "Original")
        let untitled = diary("long", content: String(repeating: "中文 and English ", count: 10))
        XCTAssertEqual(Moment.make(day: .init(date: .now, diaries: [untitled], music: []), details: [:], media: [:]).first?.title, untitled.content)
    }
}
