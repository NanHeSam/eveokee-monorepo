import Foundation
@preconcurrency import ConvexMobile

struct SongGenerationResult: Decodable, Sendable {
    let diaryId: String
    let success: Bool
    let code: String?
    var message: String? {
        switch code {
        case "ALREADY_IN_PROGRESS": "This moment is already becoming a song."
        case "USAGE_LIMIT_REACHED": "You've used your songs for now. Your moments are safe; come back when your song allowance renews."
        default: success ? nil : "The song couldn't start. Your moment is safe. Please try again later."
        }
    }
    var accepted: Bool { success || code == "ALREADY_IN_PROGRESS" }
}

// Injectable operations keep microphone review/save and generation tests offline.
@MainActor
struct NativeOperations {
    let createDiary: (String) async throws -> Void
    let latestDiary: (String) async throws -> Diary?
    let generateSong: (String, String) async throws -> SongGenerationResult

    static func live(_ client: ConvexClientWithAuth<String>) -> Self {
        Self(createDiary: { text in
            let _: CreatedDiary = try await client.mutation("diaries:createDiary", with: ["content": text])
        }, latestDiary: { id in
            // The Swift SDK exposes reads through subscriptions. Cancel after the
            // first server value so a stale local detail cannot overwrite edits.
            for try await diary in client.subscribe(to: "diaries:getDiary", with: ["diaryId": id], yielding: Diary?.self).values {
                return diary
            }
            return nil
        }, generateSong: { id, content in
            try await client.action("music:startDiaryMusicGeneration", with: ["diaryId": id, "content": content])
        })
    }
}
