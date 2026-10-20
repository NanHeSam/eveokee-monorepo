import Foundation

// Convex IDs are opaque strings; all v.number() fields decode as Double.
struct Diary: Codable, Identifiable, Sendable {
    let _id: String
    var id: String { _id }
    let userId: String?
    let title: String?
    let content: String
    let date: Double
    let updatedAt: Double
    let primaryMusicId: String?
    let primaryMusic: Music?
    let events: [MemoryEvent]?
}

struct Music: Codable, Identifiable, Sendable {
    let _id: String
    var id: String { _id }
    let diaryId: String?
    let title: String?
    let lyric: String?
    let lyricWithTime: TimedLyrics?
    let duration: Double?
    let audioUrl: String?
    let imageUrl: String?
    let status: String
    let createdAt: Double?
    let updatedAt: Double?
    let diaryDate: Double?
    let ownershipType: String?
    let isUnavailable: Bool?
    var playable: Bool { status == "ready" && isUnavailable != true && audioURL != nil }
    var audioURL: URL? {
        guard let audioUrl, let url = URL(string: audioUrl), url.scheme == "https" else { return nil }
        return url
    }
}

struct TimedLyrics: Codable, Sendable {
    let alignedWords: [AlignedWord]
    let waveformData: [Double]?
    let hootCer: Double?
}

struct AlignedWord: Codable, Sendable {
    let word: String
    let startS: Double
    let endS: Double
    let palign: Double?
}

struct DiaryMedia: Codable, Identifiable, Sendable {
    let _id: String
    var id: String { _id }
    let diaryId: String
    let storageId: String?
    let mediaType: String
    let contentType: String?
    let fileSize: Double?
    let url: String?
}

struct MemoryEvent: Codable, Identifiable, Sendable {
    let _id: String
    var id: String { _id }
    let diaryId: String
    let happenedAt: Double
    let title: String
    let summary: String
    let personIds: [String]?
    let peopleDetails: [PersonReference]?
}

struct PersonReference: Codable, Identifiable, Sendable {
    let _id: String
    var id: String { _id }
    let name: String
    let role: String?
}

struct Person: Codable, Identifiable, Sendable {
    let _id: String
    var id: String { _id }
    let primaryName: String
    let altNames: [String]?
    let relationshipLabel: String?
    let lastMentionedAt: Double?
    let interactionCount: Double?
}

struct CreatedDiary: Decodable, Sendable { let _id: String }
