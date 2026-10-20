import SwiftUI

struct MySkyView: View {
    let store: BackendStore
    let onPlay: (ConstellationDay) -> Void
    @State private var zoom = 2
    @State private var selectedID: Date?
    @Environment(\.accessibilityReduceMotion) private var reduced
    private var days: [ConstellationDay] { store.days }
    private var selected: ConstellationDay? { days.first { $0.id == selectedID } ?? days.first }
    private var visible: [ConstellationDay] {
        if zoom == 0 { return selected.map { [$0] } ?? [] }
        if zoom == 1, let selected, let range = Calendar.current.dateInterval(of: .weekOfYear, for: selected.date) {
            return days.filter { range.contains($0.date) }
        }
        return days
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Eyebrow(text: "The sky you keep"); Spacer(); Image(systemName: "sparkle").foregroundStyle(SkyTheme.gold) }
                Text("Nothing goes\nback to \(Text("zero.").italic().foregroundColor(SkyTheme.gold))")
                    .font(SkyTheme.serif(.largeTitle)).padding(.top, 14)
                Text("\(store.diaries.count) kept entries across \(days.count) days.\nStill here. All of them.").font(.subheadline).foregroundStyle(SkyTheme.dim)
                Picker("Sky scale", selection: $zoom) { Text("A day").tag(0); Text("A week").tag(1); Text("All days").tag(2) }
                    .pickerStyle(.segmented).padding(.top, 8)
                GeometryReader { geometry in
                    ZStack {
                        ForEach(Array(visible.enumerated()), id: \.element.id) { index, day in
                            Button {
                                if selectedID == day.id { onPlay(day) }
                                else { withAnimation(reduced ? nil : SkyTheme.ease) { selectedID = day.id } }
                            } label: {
                                MiniConstellation(seed: index)
                                    .frame(width: zoom == 0 ? 150 : zoom == 1 ? 56 : 30, height: zoom == 0 ? 150 : zoom == 1 ? 56 : 30)
                                    .padding(7)
                                    .overlay(Circle().stroke(SkyTheme.gold.opacity(selected?.id == day.id ? 0.5 : 0), lineWidth: 1))
                                    .contentShape(Circle())
                            }.buttonStyle(.plain)
                                .position(position(index, count: visible.count, size: geometry.size))
                                .accessibilityLabel("\(day.date.formatted(date: .complete, time: .omitted)), \(day.title), \(day.diaries.count) entries")
                                .accessibilityHint("Select this day; tap again to hear it")
                                .accessibilityAddTraits(selected?.id == day.id ? [.isSelected] : [])
                        }
                    }.animation(reduced ? nil : .timingCurve(0.22, 1, 0.36, 1, duration: 1), value: zoom)
                }.frame(height: 255)
                    .gesture(MagnifyGesture().onEnded { value in withAnimation(reduced ? nil : SkyTheme.ease) { zoom = min(2, max(0, zoom + (value.magnification < 1 ? 1 : -1))) } })
                if let selected {
                    Button { onPlay(selected) } label: {
                        HStack(spacing: 14) {
                            MiniConstellation(seed: 0).frame(width: 40, height: 40)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(selected.date.formatted(date: .abbreviated, time: .omitted).uppercased()).font(.caption2).foregroundStyle(SkyTheme.dim)
                                Text(selected.title).font(SkyTheme.serif(.title3))
                                Text("\(selected.diaries.count) \(selected.diaries.count == 1 ? "entry" : "entries") · \(selected.music.filter(\.playable).count) playable songs").font(.caption2).foregroundStyle(SkyTheme.dim)
                            }
                            Spacer(); Image(systemName: "play.fill").foregroundStyle(SkyTheme.gold).frame(width: 44, height: 44)
                        }.padding(.vertical, 16).overlay(alignment: .top) { Rectangle().fill(SkyTheme.line).frame(height: 0.6) }
                            .overlay(alignment: .bottom) { Rectangle().fill(SkyTheme.line).frame(height: 0.6) }
                    }.buttonStyle(.plain)
                } else {
                    Text("Your sky begins with one small thing.").font(SkyTheme.serif(.title3))
                }
                VStack(spacing: 6) {
                    Text("原来，日子没有消失。").font(SkyTheme.serif(.subheadline)).italic()
                    Text("The days didn't disappear.").font(.caption2)
                }.foregroundStyle(SkyTheme.dim).frame(maxWidth: .infinity).padding(.vertical, 12)
                // The list is also an accessible, non-overlapping route into dense skies.
                DisclosureGroup("Every day in your sky") {
                    ForEach(days) { day in
                        Button { selectedID = day.id; onPlay(day) } label: {
                            HStack { Text(day.date.formatted(date: .abbreviated, time: .omitted)); Spacer(); Text(day.title).lineLimit(1) }.font(.subheadline).padding(.vertical, 12)
                        }.buttonStyle(.plain)
                    }
                }.font(.caption).padding(.bottom, 20)
            }.padding(.horizontal, 28).padding(.top, 24)
        }.sensoryFeedback(.selection, trigger: zoom)
    }
    private func position(_ index: Int, count: Int, size: CGSize) -> CGPoint {
        guard count > 1 else { return .init(x: size.width / 2, y: size.height / 2) }
        let angle = Double(index) * 2.39996
        let r = sqrt(Double(index + 1) / Double(count))
        return .init(x: size.width * (0.5 + cos(angle) * r * 0.41), y: size.height * (0.5 + sin(angle) * r * 0.39))
    }
}

struct MiniConstellation: View {
    let seed: Int
    @Environment(\.colorSchemeContrast) private var contrast
    var body: some View {
        Canvas { context, size in
            let patterns: [[CGPoint]] = [
                [.init(x: 0.13, y: 0.62), .init(x: 0.39, y: 0.15), .init(x: 0.82, y: 0.36), .init(x: 0.72, y: 0.86)],
                [.init(x: 0.1, y: 0.24), .init(x: 0.60, y: 0.13), .init(x: 0.84, y: 0.70), .init(x: 0.36, y: 0.82), .init(x: 0.46, y: 0.5)],
                [.init(x: 0.14, y: 0.52), .init(x: 0.36, y: 0.1), .init(x: 0.82, y: 0.20), .init(x: 0.74, y: 0.75), .init(x: 0.39, y: 0.86)]
            ]
            let points = patterns[seed % patterns.count].map { CGPoint(x: $0.x * size.width, y: $0.y * size.height) }
            var path = Path()
            for (index, point) in points.enumerated() {
                if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
            }
            path.closeSubpath()
            context.stroke(path, with: .color(SkyTheme.gold.opacity(contrast == .increased ? 0.8 : 0.35)), lineWidth: contrast == .increased ? 1.2 : 0.65)
            for (index, point) in points.enumerated() {
                let radius = index == 2 ? 1.7 : 1.1
                context.fill(Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)), with: .color(SkyTheme.star))
            }
        }.accessibilityHidden(true)
    }
}
