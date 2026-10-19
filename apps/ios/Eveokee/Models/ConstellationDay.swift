import Foundation

struct ConstellationDay: Identifiable, Sendable {
    let date: Date
    var id: Date { date }
    let diaries: [Diary]
    let music: [Music]
    var song: Music? {
        let primaryIDs = Set(diaries.compactMap(\.primaryMusicId))
        return music.first { primaryIDs.contains($0.id) && $0.playable } ?? music.first(where: \.playable)
            ?? music.first { $0.status == "ready" && $0.isUnavailable != true }
    }
    var title: String { song?.title ?? diaries.compactMap(\.title).first ?? "A little of this day" }

    static func group(diaries: [Diary], playlist: [Music], calendar: Calendar = .current) -> [Self] {
        var grouped = Dictionary(grouping: diaries) { calendar.startOfDay(for: Date(timeIntervalSince1970: $0.date / 1000)) }
        // Shared tracks belong to someone else's sky. Keep personal history truthful.
        let ownTracks = playlist.filter { $0.ownershipType != "shared" && $0.isUnavailable != true }
        for track in ownTracks where track.diaryDate != nil {
            let date = calendar.startOfDay(for: Date(timeIntervalSince1970: track.diaryDate! / 1000))
            if grouped[date] == nil { grouped[date] = [] }
        }
        return grouped.map { date, entries in
            let sorted = entries.sorted { ($0.date, $0.id) < ($1.date, $1.id) }
            let ids = Set(sorted.map(\.id))
            var tracks = ownTracks.filter { track in
                if let diaryID = track.diaryId, ids.contains(diaryID) { return true }
                guard let timestamp = track.diaryDate else { return false }
                return calendar.isDate(Date(timeIntervalSince1970: timestamp / 1000), inSameDayAs: date)
            }
            for primary in sorted.compactMap(\.primaryMusic) where !tracks.contains(where: { $0.id == primary.id }) {
                tracks.append(primary)
            }
            tracks.sort { (($0.createdAt ?? 0), $0.id) > (($1.createdAt ?? 0), $1.id) }
            return Self(date: date, diaries: sorted, music: tracks)
        }.sorted { $0.date > $1.date }
    }
}

struct Moment: Identifiable, Sendable {
    enum Kind: String, Sendable { case diary = "Your words", photo = "Photo", video = "Video", event = "Remembered moment", music = "The day's song" }
    let id: String
    let diaryID: String?
    let title: String
    let body: String
    let date: Date
    let kind: Kind
    let mediaURL: URL?
    let people: [PersonReference]

    static func make(day: ConstellationDay, details: [String: Diary], media: [String: [DiaryMedia]]) -> [Self] {
        var result: [Self] = []
        for base in day.diaries {
            let diary = details[base.id] ?? base
            let date = Date(timeIntervalSince1970: diary.date / 1000)
            result.append(Self(id: diary.id, diaryID: diary.id, title: diary.title ?? String(diary.content.prefix(55)), body: diary.content, date: date, kind: .diary, mediaURL: nil, people: []))
            for event in diary.events ?? [] {
                result.append(Self(id: event.id, diaryID: diary.id, title: event.title, body: event.summary, date: Date(timeIntervalSince1970: event.happenedAt / 1000), kind: .event, mediaURL: nil, people: event.peopleDetails ?? []))
            }
            for item in media[diary.id] ?? [] {
                result.append(Self(id: item.id, diaryID: diary.id, title: item.mediaType == "photo" ? "A photo from this day" : "A moving memory", body: diary.content, date: date, kind: item.mediaType == "photo" ? .photo : .video, mediaURL: item.url.flatMap(URL.init(string:)), people: []))
            }
        }
        if let song = day.song {
            result.append(Self(id: song.id, diaryID: song.diaryId ?? day.diaries.first(where: { $0.primaryMusicId == song.id })?.id, title: song.title ?? "The day's song", body: song.lyric ?? "A day, in a different light.", date: day.date, kind: .music, mediaURL: nil, people: []))
        }
        return result
    }
}
