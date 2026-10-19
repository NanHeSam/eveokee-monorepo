import XCTest
@testable import Eveokee

final class ConstellationTests: XCTestCase {
    func testRealShapedDiaryDecodesStringIDsFloatMillisecondsAndAbsentFields() throws {
        let diary = try decode(Diary.self, #"{"_id":"jd7opaqueconvexid","userId":"j57user","content":"A quiet walk","date":1792306800123.75,"updatedAt":1792306900456.5,"primaryMusicId":"j97music","primaryMusic":{"_id":"j97music","status":"ready","duration":104.35,"audioUrl":"https://assets.example.test/day.mp3","lyricWithTime":{"alignedWords":[{"word":"Hello\n","startS":1.15,"endS":2.4,"palign":0.99}],"waveformData":[0.15,0.8],"hootCer":0.1}}}"#)
        XCTAssertEqual(diary.id, "jd7opaqueconvexid")
        XCTAssertEqual(diary.date, 1792306800123.75)
        XCTAssertNil(diary.title)
        XCTAssertNil(diary.events)
        XCTAssertEqual(diary.primaryMusic?.lyricWithTime?.alignedWords.first?.startS, 1.15)
        XCTAssertEqual(diary.primaryMusic?.playable, true)
    }

    func testMediaEventAndPeopleQueryShapesDecode() throws {
        let media = try decode(DiaryMedia.self, #"{"_id":"media","diaryId":"diary","storageId":"storage","mediaType":"photo","contentType":"image/heic","fileSize":10345.0}"#)
        XCTAssertNil(media.url)
        let event = try decode(MemoryEvent.self, #"{"_id":"event","_creationTime":1792306800.25,"diaryId":"diary","happenedAt":1792306800000.5,"title":"Coffee","summary":"The window seat","peopleDetails":[{"_id":"person","name":"Jo","role":"friend"}]}"#)
        XCTAssertEqual(event.peopleDetails?.first?.name, "Jo")
        let person = try decode(Person.self, #"{"_id":"person","primaryName":"Jo","interactionCount":2.0}"#)
        XCTAssertEqual(person.interactionCount, 2)
        let playlist = try decode(Music.self, #"{"_id":"shared","status":"ready","ownershipType":"shared","isUnavailable":true,"audioUrl":"https://assets.example.test/a.mp3","createdAt":1792306800.15}"#)
        XCTAssertFalse(playlist.playable)
    }

    func testDaysUseDiaryDateAndLocalMidnightAcrossDST() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        let early = try diary("early", "2026-11-01T08:30:00Z") // 01:30 PDT
        let repeated = try diary("later", "2026-11-01T09:30:00Z") // 01:30 PST
        let next = try diary("next", "2026-11-02T08:30:00Z")
        let days = ConstellationDay.group(diaries: [next, repeated, early], playlist: [], calendar: calendar)
        XCTAssertEqual(days.count, 2)
        XCTAssertEqual(days[1].diaries.map(\.id), ["early", "later"])
        XCTAssertEqual(calendar.component(.hour, from: days[1].date), 0)
    }

    func testMusicJoinsSourceDayDeduplicatesPrimaryAndExcludesShared() throws {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let base = try diary("d1", "2026-10-18T10:00:00Z")
        let primary = try decode(Music.self, #"{"_id":"m1","diaryId":"d1","status":"ready","audioUrl":"https://assets.example.test/a.mp3","createdAt":1}"#)
        let entry = Diary(_id: base.id, userId: nil, title: nil, content: base.content, date: base.date, updatedAt: base.date, primaryMusicId: primary.id, primaryMusic: primary, events: nil)
        let shared = try decode(Music.self, #"{"_id":"m2","status":"ready","ownershipType":"shared","diaryDate":1792310400000}"#)
        let days = ConstellationDay.group(diaries: [entry], playlist: [primary, shared], calendar: calendar)
        XCTAssertEqual(days.count, 1)
        XCTAssertEqual(days[0].music.map(\.id), ["m1"])
        XCTAssertEqual(days[0].song?.id, "m1")
    }

    func testTimingsUseAlignedWordsAndIgnoreMalformedRanges() throws {
        let music = try decode(Music.self, #"{"_id":"m","status":"ready","lyricWithTime":{"alignedWords":[{"word":"bad","startS":-2,"endS":1},{"word":"Hello ","startS":1.25,"endS":1.8},{"word":"sky.\n","startS":2,"endS":3},{"word":"Stay","startS":5,"endS":6}],"waveformData":[],"hootCer":0}}"#)
        let lines = LyricTimeline.lines(for: music, duration: 10)
        XCTAssertEqual(lines.map(\.text), ["Hello sky.", "Stay"])
        XCTAssertEqual(lines[0].start, 1.25)
        XCTAssertNil(LyricTimeline.activeIndex(at: 0, lines: lines))
        XCTAssertEqual(LyricTimeline.activeIndex(at: 5, lines: lines), 1)
        XCTAssertNil(LyricTimeline.activeIndex(at: .nan, lines: lines))
    }

    func testUntimedLyricsPaceEvenlyAndHandleEmptyOrUnknownDuration() throws {
        let music = try decode(Music.self, #"{"_id":"m","status":"ready","lyric":"[Verse]\nFirst\n\nSecond\nThird"}"#)
        let lines = LyricTimeline.lines(for: music, duration: 90)
        XCTAssertEqual(lines.map(\.start), [0, 30, 60])
        XCTAssertEqual(lines.last?.end, 90)
        XCTAssertEqual(LyricTimeline.activeIndex(at: 30, lines: lines), 1)
        XCTAssertEqual(LyricTimeline.lines(for: music, duration: .nan).last?.end, 18)
        let empty = try decode(Music.self, #"{"_id":"empty","status":"pending"}"#)
        XCTAssertTrue(LyricTimeline.lines(for: empty, duration: 0).isEmpty)
    }

    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T { try JSONDecoder().decode(type, from: Data(json.utf8)) }
    private func diary(_ id: String, _ iso: String) throws -> Diary {
        let date = try XCTUnwrap(ISO8601DateFormatter().date(from: iso)).timeIntervalSince1970 * 1000
        return Diary(_id: id, userId: nil, title: nil, content: "A moment", date: date, updatedAt: date + 12345, primaryMusicId: nil, primaryMusic: nil, events: nil)
    }
}
