import SwiftUI

struct SongView: View {
    let day: ConstellationDay
    let store: BackendStore
    let player: MusicPlayer
    let namespace: Namespace.ID
    let onMoment: (Moment) -> Void
    var song: Music? { day.music.first { $0.id == player.music?.id } ?? day.song }
    var lines: [LyricLine] { song.map { LyricTimeline.lines(for: $0, duration: player.duration) } ?? [] }
    var index: Int? { LyricTimeline.activeIndex(at: player.elapsed, lines: lines) }
    var moments: [Moment] { store.moments(for: day) }
    var source: Moment? {
        guard let song else { return nil }
        let diaryID = song.diaryId ?? day.diaries.first(where: { $0.primaryMusicId == song.id })?.id
        return moments.first { $0.kind == .diary && $0.diaryID == diaryID }
    }
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Eyebrow(text: "A day, in a different light")
                Text(song?.title ?? "The day's song").font(SkyTheme.serif(.title)).multilineTextAlignment(.center)
                Text(day.date.formatted(date: .abbreviated, time: .omitted).uppercased() + " · \(moments.count) MOMENTS").font(.caption2).foregroundStyle(SkyTheme.dim)
                ConstellationView(moments: moments, active: index.map { $0 % max(1, moments.count) }, drifting: player.playing, namespace: namespace, onSelect: onMoment)
                    .frame(height: 235)
                if song == nil {
                    Text("Your day is still gathering.").font(SkyTheme.serif(.title2))
                    Text("Keep a moment today. Your music will have a place here.").font(.subheadline).foregroundStyle(SkyTheme.dim).multilineTextAlignment(.center)
                } else if lines.isEmpty {
                    Text("Let the music take you back.").font(SkyTheme.serif(.title2))
                    Text("This track has no lyrics yet.").font(.caption).foregroundStyle(SkyTheme.dim)
                } else {
                    VStack(spacing: 15) {
                        Text(index.flatMap { $0 > 0 ? lines[$0 - 1].text : nil } ?? "A few traces, becoming a song")
                            .font(SkyTheme.serif(.subheadline)).foregroundStyle(SkyTheme.dim)
                        Button { if let source { onMoment(source) } } label: {
                            Text(index.map { lines[$0].text } ?? "Listen for the first light.")
                                .font(SkyTheme.serif(.title)).multilineTextAlignment(.center).foregroundStyle(SkyTheme.paper)
                                .contentTransition(.opacity)
                        }.buttonStyle(.plain).disabled(source == nil).accessibilityHint(source == nil ? "No source diary is available" : "Opens the source diary for this song")
                        if let source {
                            Button { onMoment(source) } label: { Label("From your diary · view source", systemImage: "link").font(.caption).foregroundStyle(SkyTheme.gold) }.frame(minHeight: 44)
                        }
                        Text(index.flatMap { $0 + 1 < lines.count ? lines[$0 + 1].text : nil } ?? "And none of it is lost.")
                            .font(SkyTheme.serif(.subheadline)).foregroundStyle(SkyTheme.dim)
                    }.padding(.horizontal, 22).frame(minHeight: 150)
                }
                if song != nil {
                    VStack(spacing: 5) {
                        Slider(value: Binding(get: { min(player.elapsed, max(1, player.duration)) }, set: player.seek), in: 0...max(1, player.duration))
                            .tint(SkyTheme.gold).accessibilityLabel("Song position").disabled(song?.playable != true)
                        HStack { Text(time(player.elapsed)); Spacer(); Text(time(player.duration)) }.font(.caption2.monospacedDigit()).foregroundStyle(SkyTheme.dim)
                    }.padding(.horizontal, 31)
                    HStack(spacing: 35) {
                        Button { previous() } label: { Image(systemName: "backward.end").frame(width: 44, height: 44) }.accessibilityLabel("Previous lyric")
                        Button { player.toggle() } label: { Image(systemName: player.playing ? "pause.fill" : "play.fill").font(.title3).frame(width: 30, height: 30) }
                            .buttonStyle(GoldButtonStyle()).accessibilityLabel(player.playing ? "Pause song" : "Play song").disabled(song?.playable != true)
                        Button { next() } label: { Image(systemName: "forward.end").frame(width: 44, height: 44) }.accessibilityLabel("Next lyric")
                    }
                    if let error = player.error { Text(error).font(.caption).foregroundStyle(SkyTheme.paper).padding(.horizontal) }
                    Text(song?.lyricWithTime == nil ? "Lyrics follow an even pace · source is the whole diary" : "Following the light · source is the whole diary")
                        .font(.caption2).foregroundStyle(SkyTheme.dim).multilineTextAlignment(.center).padding(.horizontal)
                    if day.music.filter(\.playable).count > 1 {
                        Menu("Other songs from this day") {
                            ForEach(day.music.filter(\.playable)) { track in Button(track.title ?? "Untitled song") { player.load(track, autoplay: true) } }
                        }.font(.caption).frame(minHeight: 44)
                    }
                }
            }.padding(.top, 24).padding(.bottom, 25)
        }.task(id: day.diaries.map(\.id)) { store.watch(day: day) }
    }
    private func previous() { guard !lines.isEmpty else { return }; player.seek(lines[max(0, (index ?? 0) - 1)].start) }
    private func next() { guard !lines.isEmpty else { return }; player.seek(lines[min(lines.count - 1, (index ?? -1) + 1)].start) }
    private func time(_ seconds: Double) -> String { let value = seconds.isFinite ? max(0, Int(seconds)) : 0; return "\(value / 60):\(String(format: "%02d", value % 60))" }
}
