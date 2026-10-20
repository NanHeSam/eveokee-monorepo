import AVFoundation
import Speech
import Observation
@preconcurrency import Combine

// Final segments accumulate; a volatile segment replaces its predecessor.
// Kept independent of the recognizer so review/save can be tested without a mic.
struct VoiceTranscript: Equatable {
    private(set) var committed = ""
    private(set) var partial = ""
    var text: String { committed + partial }
    mutating func receive(_ text: String, final: Bool) {
        if final { committed += text; partial = "" } else { partial = text }
    }
}

enum VoiceLanguage: String, CaseIterable, Identifiable {
    case english = "en-US", chinese = "zh-CN"
    var id: String { rawValue }
    var label: String { self == .chinese ? "中文" : "English" }
    static func preferred(_ languages: [String] = Locale.preferredLanguages) -> Self {
        for language in languages {
            if language.hasPrefix("zh") { return .chinese }
            if language.hasPrefix("en") { return .english }
        }
        return .english
    }
}

@MainActor @Observable
final class VoiceCapture {
    enum State { case idle, preparing, recording, finishing }
    private(set) var state: State = .idle
    private(set) var transcript = VoiceTranscript()
    private(set) var status = ""
    var error: String?
    private(set) var permissionDenied = false
    var language: VoiceLanguage {
        didSet { UserDefaults.standard.set(language.rawValue, forKey: "speechLanguage") }
    }
    @ObservationIgnored private let engine = AVAudioEngine()
    @ObservationIgnored private var analyzer: SpeechAnalyzer?
    @ObservationIgnored private var input: AsyncStream<AnalyzerInput>.Continuation?
    @ObservationIgnored private var analysisTask: Task<Void, Never>?
    @ObservationIgnored private var resultsTask: Task<Void, Never>?
    @ObservationIgnored private var recognitionTask: SFSpeechRecognitionTask?
    @ObservationIgnored private var legacyRequest: SFSpeechAudioBufferRecognitionRequest?
    @ObservationIgnored private var legacyFinished = false
    @ObservationIgnored private var tapInstalled = false
    @ObservationIgnored private var epoch = UUID()
    @ObservationIgnored private var notifications: [AnyCancellable] = []

    init() {
        language = VoiceLanguage(rawValue: UserDefaults.standard.string(forKey: "speechLanguage") ?? "") ?? .preferred()
        NotificationCenter.default.publisher(for: AVAudioSession.interruptionNotification)
            .receive(on: DispatchQueue.main).sink { [weak self] _ in
                guard let self, self.state == .recording else { return }
                // Stop input immediately. The view presents the preserved transcript.
                self.error = "Recording was interrupted. You can keep or edit the words captured so far."
                self.stopInput()
            }.store(in: &notifications)
        NotificationCenter.default.publisher(for: AVAudioSession.routeChangeNotification)
            .receive(on: DispatchQueue.main).sink { [weak self] note in
                guard let reason = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                      reason == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue,
                      let self, self.state == .recording else { return }
                self.error = "The microphone disconnected. Your words are still here."
                self.stopInput()
            }.store(in: &notifications)
    }

    func start() async {
        guard state == .idle else { return }
        epoch = UUID(); let attempt = epoch
        state = .preparing; transcript = VoiceTranscript(); error = nil; permissionDenied = false
        status = "Preparing microphone…"
        do {
            let mic = await AVAudioApplication.requestRecordPermission()
            guard attempt == epoch else { return }
            guard mic else { permissionDenied = true; throw NativeError.message("Allow microphone access in Settings, or type your moment.") }
            let speech = await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { @Sendable value in continuation.resume(returning: value) }
            }
            guard attempt == epoch else { return }
            guard speech == .authorized else { permissionDenied = true; throw NativeError.message("Allow speech recognition in Settings, or type your moment.") }
            let locale = Locale(identifier: language.rawValue)
            if SpeechTranscriber.isAvailable, let supported = await SpeechTranscriber.supportedLocale(equivalentTo: locale) {
                let transcriber = SpeechTranscriber(locale: supported, preset: .progressiveTranscription)
                status = "Preparing \(language.label) speech…"
                if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
                    status = "Downloading \(language.label) speech…"
                    try await request.downloadAndInstall()
                }
                guard attempt == epoch else { return }
                guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) else {
                    throw NativeError.message("This speech model is unavailable. Try the other language or type instead.")
                }
                let analyzer = SpeechAnalyzer(modules: [transcriber])
                self.analyzer = analyzer
                try await analyzer.prepareToAnalyze(in: format)
                guard attempt == epoch else { await analyzer.cancelAndFinishNow(); return }
                let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
                input = continuation
                resultsTask = Task { [weak self] in
                    do {
                        for try await result in transcriber.results {
                            guard let self, self.epoch == attempt else { return }
                            self.transcript.receive(String(result.text.characters), final: result.isFinal)
                        }
                    } catch { if let self, self.epoch == attempt { self.error = "Speech stopped. You can edit the words captured so far."; self.stopInput() } }
                }
                analysisTask = Task { [weak self] in
                    do { try await analyzer.start(inputSequence: stream) }
                    catch { if let self, self.epoch == attempt { self.error = "Speech couldn't continue. You can edit your words or type instead."; self.stopInput() } }
                }
                try startEngine(format: format, continuation: continuation, legacy: nil)
                status = "Listening on device…"
            } else {
                // Unsupported analyzer locale/device: retain the older recognizer.
                // Require local recognition; never silently send voice to a server.
                guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable,
                      recognizer.supportsOnDeviceRecognition else {
                    throw NativeError.message("On-device speech isn't available here. Try the other language or type instead.")
                }
                let request = SFSpeechAudioBufferRecognitionRequest()
                request.shouldReportPartialResults = true
                request.requiresOnDeviceRecognition = true
                legacyRequest = request; legacyFinished = false
                recognitionTask = recognizer.recognitionTask(with: request) { @Sendable [weak self] result, failure in
                    let text = result?.bestTranscription.formattedString
                    let finished = result?.isFinal == true || failure != nil
                    let failed = failure != nil
                    Task { @MainActor in
                        guard let self, self.epoch == attempt else { return }
                        if let text { self.transcript = VoiceTranscript(); self.transcript.receive(text, final: false) }
                        self.legacyFinished = finished
                        if finished && self.state == .recording {
                            if failed { self.error = "Speech stopped. You can edit the words captured so far." }
                            self.stopInput()
                        }
                    }
                }
                try startEngine(format: nil, continuation: nil, legacy: request)
                status = "Listening on device…"
            }
            guard attempt == epoch else { return }
            state = .recording
        } catch {
            guard attempt == epoch else { return }
            self.error = error.localizedDescription
            await cancel()
        }
    }

    // Release stops the microphone before waiting for final speech results.
    func finish() async -> String? {
        if state == .preparing {
            await cancel()
            error = "Speech is still getting ready. Tap the microphone to finish setup, then speak."
            return nil
        }
        guard state == .recording || state == .finishing else { return transcript.text }
        state = .finishing; stopInput()
        if let analyzer {
            let attempt = epoch
            let deadline = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(5)) } catch { return }
                guard let self, self.epoch == attempt else { return }
                self.error = "Some words may be missing. Review before keeping this moment."
                await analyzer.cancelAndFinishNow()
            }
            defer { deadline.cancel() }
            do { try await analyzer.finalizeAndFinishThroughEndOfInput() }
            catch { self.error = "Some words may be missing. Review before keeping this moment." }
            await resultsTask?.value
        } else if legacyRequest != nil {
            legacyRequest?.endAudio()
            // The old recognizer can fail to send a final result after silence.
            for _ in 0..<20 where !legacyFinished { try? await Task.sleep(for: .milliseconds(100)) }
        }
        let text = transcript.text
        await cancel()
        return text
    }

    func cancel() async {
        epoch = UUID(); stopInput()
        input?.finish(); input = nil
        recognitionTask?.cancel(); recognitionTask = nil; legacyRequest = nil
        analysisTask?.cancel(); analysisTask = nil
        if let analyzer { await analyzer.cancelAndFinishNow() }; analyzer = nil
        resultsTask?.cancel(); resultsTask = nil
        // MusicPlayer restores playback category and resumes only when appropriate.
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        state = .idle
    }
    private func stopInput() {
        engine.stop()
        if tapInstalled { engine.inputNode.removeTap(onBus: 0); tapInstalled = false }
        input?.finish(); legacyRequest?.endAudio()
        if state == .recording { state = .finishing }
    }
    private func startEngine(format: AVAudioFormat?, continuation: AsyncStream<AnalyzerInput>.Continuation?, legacy: SFSpeechAudioBufferRecognitionRequest?) throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetoothHFP])
        try session.setActive(true)
        let natural = engine.inputNode.outputFormat(forBus: 0)
        guard natural.sampleRate > 0, natural.channelCount > 0 else { throw NativeError.message("No microphone is available. Type this moment instead.") }
        let bridge = try SpeechAudioBridge(source: natural, target: format ?? natural, continuation: continuation, legacy: legacy)
        engine.inputNode.installTap(onBus: 0, bufferSize: 2048, format: natural) { @Sendable buffer, _ in bridge.append(buffer) }
        tapInstalled = true
        engine.prepare(); try engine.start()
    }
}

// AVAudioEngine invokes its tap serially. The converter and legacy request are
// confined to that tap; only Sendable AnalyzerInputs cross into the async stream.
private final class SpeechAudioBridge: @unchecked Sendable {
    let target: AVAudioFormat
    let converter: AVAudioConverter?
    let continuation: AsyncStream<AnalyzerInput>.Continuation?
    let legacy: SFSpeechAudioBufferRecognitionRequest?
    init(source: AVAudioFormat, target: AVAudioFormat, continuation: AsyncStream<AnalyzerInput>.Continuation?, legacy: SFSpeechAudioBufferRecognitionRequest?) throws {
        self.target = target; self.continuation = continuation; self.legacy = legacy
        converter = source == target ? nil : AVAudioConverter(from: source, to: target)
        if source != target && converter == nil { throw NativeError.message("The microphone format isn't supported. Type this moment instead.") }
    }
    func append(_ buffer: AVAudioPCMBuffer) {
        if let legacy { legacy.append(buffer); return }
        // A new buffer avoids retaining the engine's reusable tap storage.
        let capacity = AVAudioFrameCount(ceil(Double(buffer.frameLength) * target.sampleRate / buffer.format.sampleRate)) + 256
        guard let output = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
        if let converter {
            var consumed = false
            var error: NSError?
            let result = converter.convert(to: output, error: &error) { _, status in
                if consumed { status.pointee = .noDataNow; return nil }
                consumed = true; status.pointee = .haveData; return buffer
            }
            guard result != .error, error == nil, output.frameLength > 0 else { return }
        } else {
            output.frameLength = buffer.frameLength
            let source = UnsafeMutableAudioBufferListPointer(buffer.mutableAudioBufferList)
            let destination = UnsafeMutableAudioBufferListPointer(output.mutableAudioBufferList)
            for (src, dst) in zip(source, destination) {
                if let srcData = src.mData, let dstData = dst.mData { memcpy(dstData, srcData, Int(src.mDataByteSize)) }
            }
        }
        continuation?.yield(AnalyzerInput(buffer: output))
    }
}
