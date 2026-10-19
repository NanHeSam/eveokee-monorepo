import SwiftUI

enum SkyTheme {
    static let ink = Color(hex: 0x17171e)
    static let paper = Color(hex: 0xf4e6d5)
    static let dim = Color(hex: 0xb9aca9)
    static let gold = Color(hex: 0xe6b17c)
    static let star = Color(hex: 0xffe8bb)
    static let line = Color(hex: 0xedd0b3).opacity(0.26)
    static let ease = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.7)
    static let sheet = Animation.spring(response: 0.6, dampingFraction: 0.86)
    static func serif(_ style: Font.TextStyle) -> Font { .system(style, design: .serif) }
}

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255, opacity: 1)
    }
}

struct Eyebrow: View {
    let text: String
    var body: some View { Text(text.uppercased()).font(.caption2.weight(.medium)).tracking(2).foregroundStyle(SkyTheme.dim) }
}

struct SkyBackground: View {
    @Environment(\.accessibilityReduceMotion) private var reduced
    @Environment(\.colorSchemeContrast) private var contrast
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottom) {
                MeshGradient(width: 3, height: 3, points: [
                    [0,0], [0.5,0], [1,0], [0,0.5], [0.5,0.5], [1,0.5], [0,1], [0.5,1], [1,1]
                ], colors: [Color(hex: 0x1a1c29), Color(hex: 0x1a1c29), Color(hex: 0x24202b), Color(hex: 0x24202b), Color(hex: 0x302429), Color(hex: 0x33282e), Color(hex: 0x49312e), Color(hex: 0x302429), Color(hex: 0x24202b)])
                TimelineView(.animation(minimumInterval: 1.0 / 20, paused: reduced)) { timeline in
                    Canvas { context, size in
                        let time = reduced ? 0 : timeline.date.timeIntervalSinceReferenceDate
                        for index in 0..<62 {
                            let x = Double((index * 73 + 17) % 997) / 997 * size.width
                            let y = Double((index * 137 + 91) % 991) / 991 * size.height
                            let alpha = reduced ? 0.28 : 0.22 + sin(time / Double(3 + index % 6) + Double(index)) * 0.1
                            context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 1.5, height: 1.5)), with: .color(SkyTheme.star.opacity(alpha)))
                        }
                    }
                }
                CitySilhouette().fill(SkyTheme.ink.opacity(0.65)).frame(height: geometry.size.height * 0.16)
                if contrast == .increased { Color.black.opacity(0.24) }
            }
        }.ignoresSafeArea().accessibilityHidden(true)
    }
}

struct CitySilhouette: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: 0, y: rect.maxY))
        for index in 0..<20 {
            let x = CGFloat(index) / 20 * rect.width
            let y = rect.height * (0.28 + CGFloat((index * 7) % 11) / 20)
            path.addLine(to: CGPoint(x: x, y: y))
            path.addLine(to: CGPoint(x: x + rect.width / 20, y: y))
        }
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY)); path.closeSubpath()
        return path
    }
}

struct GoldButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduced
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.padding(.horizontal, 22).padding(.vertical, 16)
            .foregroundStyle(SkyTheme.ink).background(SkyTheme.gold.gradient, in: Capsule())
            .scaleEffect(configuration.isPressed && !reduced ? 0.96 : 1)
            .animation(reduced ? nil : SkyTheme.sheet, value: configuration.isPressed)
    }
}

struct FixtureBanner: View {
    var body: some View {
        Text("FIXTURE PREVIEW · SYNTHETIC DATA · NO AUDIO")
            .font(.caption2.weight(.semibold)).tracking(1).foregroundStyle(SkyTheme.gold)
            .dynamicTypeSize(...DynamicTypeSize.large)
            .padding(.vertical, 6).frame(maxWidth: .infinity).background(SkyTheme.ink)
    }
}
