import Foundation

// Synthetic prototype content only. The debug-only launch route and snapshot tests
// show a permanent FIXTURE PREVIEW banner; no auth or backend request is made.
enum Fixtures {
    static let diaries: [Diary] = {
        (0..<43).map { offset in
            let date = Calendar.current.date(byAdding: .day, value: -offset, to: Calendar.current.startOfDay(for: .now))!
            let ms = date.addingTimeInterval(9 * 3600).timeIntervalSince1970 * 1000
            return Diary(_id: "fixture-diary-\(offset)", userId: "fixture-user", title: offset == 0 ? "The long way home" : ["A window left open", "Where the light went", "A little after rain"][offset % 3], content: "The window seat. Coffee went cold while I watched the street. Later, I took the long way along the water. I wasn't in a hurry. I just wanted a little more of the day.", date: ms, updatedAt: ms, primaryMusicId: "fixture-song-\(offset)", primaryMusic: nil, events: (0..<3).map { index in
                MemoryEvent(_id: "fixture-event-\(offset)-\(index)", diaryId: "fixture-diary-\(offset)", happenedAt: ms + Double(index + 1) * 7200000, title: ["The slow morning", "A song, on repeat", "You stayed for the light"][index], summary: ["The window seat. A coffee that went cold while you watched the street.", "A familiar song came along on the afternoon walk.", "One moment from the water's edge. The city was still warm when the sun slipped behind it."][index], personIds: nil, peopleDetails: [])
            })
        }
    }()
    static let music: [Music] = diaries.enumerated().map { offset, diary in
        Music(_id: "fixture-song-\(offset)", diaryId: diary.id, title: diary.title, lyric: "The morning took its time\nThe same old song, a softer sound\nThe lake held the last light.\nI didn't need to hurry home\nA little more of today, to keep", lyricWithTime: nil, duration: 100, audioUrl: nil, imageUrl: nil, status: "ready", createdAt: diary.date, updatedAt: diary.date, diaryDate: diary.date, ownershipType: "owned", isUnavailable: false)
    }
    static let media: [String: [DiaryMedia]] = [:]
}
