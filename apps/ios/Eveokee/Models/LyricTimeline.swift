import Foundation

struct LyricLine: Identifiable, Equatable, Sendable {
    let id: Int
    let text: String
    let start: Double
    let end: Double
}

enum LyricTimeline {
    static func lines(for music: Music, duration: Double) -> [LyricLine] {
        let plain = (music.lyric ?? "").components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && !($0.hasPrefix("[") && $0.hasSuffix("]")) }
        let words = (music.lyricWithTime?.alignedWords ?? [])
            .filter { $0.startS.isFinite && $0.endS.isFinite && $0.startS >= 0 && $0.endS >= $0.startS && !$0.word.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .sorted { $0.startS < $1.startS }
        if !words.isEmpty {
            // Providers preserve line endings within word strings. If absent, phrase at
            // punctuation, a long pause, or eight words; never invent exact anchor IDs.
            var groups: [[AlignedWord]] = []
            var current: [AlignedWord] = []
            for word in words {
                if let last = current.last, word.startS - last.endS > 1.3 {
                    groups.append(current); current = []
                }
                current.append(word)
                if word.word.contains("\n") || word.word.trimmingCharacters(in: .whitespacesAndNewlines).last.map({ ".!?。！？".contains($0) }) == true || current.count >= 8 {
                    groups.append(current); current = []
                }
            }
            if !current.isEmpty { groups.append(current) }
            return groups.enumerated().map { index, group in
                LyricLine(id: index, text: group.map { $0.word.trimmingCharacters(in: .whitespacesAndNewlines) }.joined(separator: " "), start: group[0].startS, end: group.last!.endS)
            }
        }
        guard !plain.isEmpty else { return [] }
        let total = duration.isFinite && duration > 0 ? duration : max(1, Double(plain.count) * 6)
        return plain.enumerated().map { index, text in
            LyricLine(id: index, text: text, start: Double(index) * total / Double(plain.count), end: Double(index + 1) * total / Double(plain.count))
        }
    }

    static func activeIndex(at seconds: Double, lines: [LyricLine]) -> Int? {
        guard seconds.isFinite else { return nil }
        return lines.lastIndex { $0.start <= seconds }
    }
}
