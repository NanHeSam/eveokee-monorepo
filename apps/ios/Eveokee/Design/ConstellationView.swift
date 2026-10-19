import SwiftUI

struct ConstellationView: View {
    let moments: [Moment]
    var active: Int? = nil
    var drifting = false
    var showsLabels = true
    let namespace: Namespace.ID
    let onSelect: (Moment) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduced
    @Environment(\.colorSchemeContrast) private var contrast

    static func point(_ index: Int, count: Int, size: CGSize) -> CGPoint {
        let initial: [CGPoint] = [.init(x: 0.20, y: 0.29), .init(x: 0.51, y: 0.16), .init(x: 0.77, y: 0.47), .init(x: 0.43, y: 0.76), .init(x: 0.18, y: 0.86)]
        let unit: CGPoint
        if count <= 5 { unit = initial[index % 5] }
        else {
            let angle = Double(index) * 2.39996
            let radius = sqrt(Double(index + 1) / Double(max(1, count))) * 0.37
            unit = .init(x: 0.5 + cos(angle) * radius, y: 0.5 + sin(angle) * radius)
        }
        return .init(x: unit.x * size.width, y: unit.y * size.height)
    }
    var body: some View {
        GeometryReader { geometry in
            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduced || !drifting)) { timeline in
                let time = reduced || !drifting ? 0 : timeline.date.timeIntervalSinceReferenceDate
                let drift = CGSize(width: sin(time / 18) * 5, height: cos(time / 18) * 3)
                ZStack {
                    Canvas { context, size in
                        guard !moments.isEmpty else { return }
                        var path = Path()
                        for index in moments.indices {
                            let point = Self.point(index, count: moments.count, size: size)
                            if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
                        }
                        context.stroke(path, with: .color(SkyTheme.gold.opacity(contrast == .increased ? 0.8 : 0.28)), style: StrokeStyle(lineWidth: contrast == .increased ? 1.2 : 0.7, dash: [2, 5]))
                    }.accessibilityHidden(true)
                    ForEach(Array(moments.enumerated()), id: \.element.id) { index, moment in
                        let lit = active == index
                        Button { onSelect(moment) } label: {
                            VStack(spacing: 7) {
                                star(moment, lit: lit)
                                    .matchedGeometryEffect(id: moment.id, in: namespace)
                                if showsLabels && moments.count <= 7 {
                                    Text(String(moment.title.prefix(22)))
                                        .font(.caption2).foregroundStyle(lit ? SkyTheme.paper : SkyTheme.dim)
                                        .lineLimit(1).frame(width: 112)
                                }
                            }.frame(width: 48, height: 48)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .position(Self.point(index, count: moments.count, size: geometry.size))
                        .accessibilityLabel("\(moment.kind.rawValue), \(moment.title), \(moment.date.formatted(date: .omitted, time: .shortened))")
                        .accessibilityHint("Opens the original memory")
                    }
                }.offset(drift)
            }
        }
    }
    @ViewBuilder private func star(_ moment: Moment, lit: Bool) -> some View {
        if moment.kind == .photo, let url = moment.mediaURL {
            AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Image(systemName: "photo").foregroundStyle(SkyTheme.gold) }
                .frame(width: 33, height: 42).clipShape(.rect(cornerRadius: 5))
                .rotationEffect(.degrees(-9)).shadow(color: SkyTheme.gold.opacity(0.3), radius: 15)
        } else {
            Circle().fill(lit ? SkyTheme.paper : SkyTheme.star)
                .frame(width: lit ? 11 : 6, height: lit ? 11 : 6)
                .padding(8).overlay(Circle().stroke(SkyTheme.gold.opacity(lit ? 0.45 : 0.15), lineWidth: 1))
                .shadow(color: SkyTheme.gold.opacity(lit ? 0.8 : 0.45), radius: lit ? 15 : 8)
                .animation(reduced ? nil : SkyTheme.ease, value: lit)
        }
    }
}
