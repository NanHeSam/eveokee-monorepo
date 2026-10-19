import SwiftUI
import AVKit

struct MemoryView: View {
    let moment: Moment
    var fixture = false
    @Environment(\.dismiss) private var dismiss
    @State private var video: AVPlayer?
    var body: some View {
        NavigationStack {
            ZStack {
                SkyBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        if fixture { FixtureBanner() }
                        if moment.kind == .photo, let url = moment.mediaURL {
                            AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { ProgressView().frame(height: 200) }
                                .clipShape(.rect(cornerRadius: 18)).accessibilityLabel("Photo attached to this diary")
                        } else if moment.kind == .video, moment.mediaURL != nil {
                            VideoPlayer(player: video).frame(height: 230).clipShape(.rect(cornerRadius: 18))
                        } else {
                            ZStack { RoundedRectangle(cornerRadius: 18).fill(SkyTheme.gold.opacity(0.06)); Image(systemName: moment.kind == .music ? "waveform" : "sparkle").font(.system(size: 56, weight: .ultraLight)).foregroundStyle(SkyTheme.gold) }.frame(height: 180).accessibilityHidden(true)
                        }
                        Eyebrow(text: moment.date.formatted(date: .abbreviated, time: .shortened))
                        Text(moment.title).font(SkyTheme.serif(.largeTitle))
                        Text(moment.body).font(.body).lineSpacing(6).textSelection(.enabled)
                        if !moment.people.isEmpty {
                            Text(moment.people.map { $0.name + ($0.role.map { " · \($0)" } ?? "") }.joined(separator: ", ")).font(.subheadline).foregroundStyle(SkyTheme.dim)
                        }
                        Label(moment.kind.rawValue + " · original diary anchor", systemImage: "link").font(.caption).foregroundStyle(SkyTheme.gold)
                    }.padding(28)
                }
            }.foregroundStyle(SkyTheme.paper).toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }.tint(SkyTheme.gold).presentationDragIndicator(.visible)
            .task { if moment.kind == .video, let url = moment.mediaURL { video = AVPlayer(url: url) } }
            .onDisappear { video?.pause(); video = nil }
    }
}
