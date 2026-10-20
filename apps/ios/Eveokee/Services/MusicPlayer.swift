import AVFoundation
import MediaPlayer
import Observation
import Combine

@MainActor @Observable
final class MusicPlayer {
    private(set) var music: Music?
    private(set) var playing = false
    private(set) var elapsed = 0.0
    private(set) var duration = 0.0
    var error: String?
    @ObservationIgnored private let player = AVPlayer()
    @ObservationIgnored private var observer: Any?
    @ObservationIgnored private var itemObserver: NSKeyValueObservation?
    @ObservationIgnored private var subscriptions: [AnyCancellable] = []
    @ObservationIgnored private var shouldResume = false
    @ObservationIgnored private var capturingVoice = false
    @ObservationIgnored private var resumeAfterVoice = false

    init() {
        observer = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.15, preferredTimescale: 600), queue: .main) { @Sendable [weak self] time in
            MainActor.assumeIsolated {
                guard let self, self.player.currentItem != nil else { return }
                self.elapsed = time.seconds.isFinite ? max(0, time.seconds) : 0
                if let value = self.player.currentItem?.duration.seconds, value.isFinite, value > 0 { self.duration = value }
                self.playing = self.player.timeControlStatus != .paused
                self.updateNowPlaying()
            }
        }
        NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)
            .receive(on: DispatchQueue.main).sink { [weak self] note in
                MainActor.assumeIsolated {
                    guard let self, let item = note.object as? AVPlayerItem, item === self.player.currentItem else { return }
                    self.playing = false; self.updateNowPlaying()
                }
            }.store(in: &subscriptions)
        NotificationCenter.default.publisher(for: AVAudioSession.interruptionNotification)
            .receive(on: DispatchQueue.main).sink { [weak self] note in
                MainActor.assumeIsolated {
                    guard let self, let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                          let kind = AVAudioSession.InterruptionType(rawValue: raw) else { return }
                    if kind == .began { self.shouldResume = self.playing; self.pause() }
                    else if self.shouldResume,
                            let options = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt,
                            AVAudioSession.InterruptionOptions(rawValue: options).contains(.shouldResume) { self.play() }
                }
            }.store(in: &subscriptions)
        NotificationCenter.default.publisher(for: AVAudioSession.routeChangeNotification)
            .receive(on: DispatchQueue.main).sink { [weak self] note in
                MainActor.assumeIsolated {
                    if let reason = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                       reason == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue { self?.pause() }
                }
            }.store(in: &subscriptions)
        // MediaPlayer and KVO may call back off the main queue. Explicit Sendable
        // closures avoid inheriting this initializer/method's MainActor isolation;
        // only their Task bodies enter the actor.
        let remote = MPRemoteCommandCenter.shared()
        remote.playCommand.addTarget { @Sendable [weak self] _ in Task { @MainActor in self?.play() }; return .success }
        remote.pauseCommand.addTarget { @Sendable [weak self] _ in Task { @MainActor in self?.pause() }; return .success }
        remote.togglePlayPauseCommand.addTarget { @Sendable [weak self] _ in Task { @MainActor in self?.toggle() }; return .success }
        remote.changePlaybackPositionCommand.addTarget { @Sendable [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            let seconds = event.positionTime
            Task { @MainActor in self?.seek(seconds) }
            return .success
        }
    }
    func load(_ music: Music, autoplay: Bool) {
        if self.music?.id == music.id { if autoplay { play() }; return }
        pause(); error = nil
        self.music = music; elapsed = 0; duration = music.duration ?? 0
        guard music.playable, let url = music.audioURL else {
            player.replaceCurrentItem(with: nil)
            updateNowPlaying()
            return
        }
        let item = AVPlayerItem(url: url)
        itemObserver = item.observe(\.status, options: [.new]) { @Sendable [weak self] item, _ in
            let message = item.status == .failed ? (item.error?.localizedDescription ?? "This track could not be played.") : nil
            if let message { Task { @MainActor in self?.error = message; self?.pause() } }
        }
        player.replaceCurrentItem(with: item)
        updateNowPlaying()
        if autoplay { play() }
    }
    func play() {
        guard !capturingVoice, music?.playable == true, player.currentItem != nil else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            if duration > 0, elapsed >= duration - 0.2 { seek(0) }
            player.play(); playing = true; updateNowPlaying()
        } catch { self.error = error.localizedDescription }
    }
    func pause() { player.pause(); playing = false; updateNowPlaying() }
    func toggle() { playing ? pause() : play() }
    func seek(_ seconds: Double) {
        guard seconds.isFinite else { return }
        let bounded = min(max(0, seconds), max(0, duration))
        elapsed = bounded
        player.seek(to: CMTime(seconds: bounded, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        updateNowPlaying()
    }
    func beginVoiceCapture() {
        guard !capturingVoice else { return }
        resumeAfterVoice = playing
        capturingVoice = true
        pause()
    }
    func endVoiceCapture(resume: Bool = true) {
        guard capturingVoice else { return }
        capturingVoice = false
        let restore = resumeAfterVoice && resume
        resumeAfterVoice = false
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        if restore { play() }
    }
    func clear() {
        capturingVoice = false; resumeAfterVoice = false
        pause(); itemObserver = nil; player.replaceCurrentItem(with: nil)
        music = nil; elapsed = 0; duration = 0; error = nil
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
    private func updateNowPlaying() {
        guard let music else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: music.title ?? "A day in your sky",
            MPMediaItemPropertyArtist: "Eveokee",
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: elapsed,
            MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0
        ]
    }
}
