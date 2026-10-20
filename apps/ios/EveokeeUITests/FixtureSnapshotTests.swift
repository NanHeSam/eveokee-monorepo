import XCTest

@MainActor
final class FixtureSnapshotTests: XCTestCase {
    func testFixtureScreensAndAnchor() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--fixture-preview"]
        app.launch()
        XCTAssertTrue(app.staticTexts["FIXTURE PREVIEW · SYNTHETIC DATA · NO AUDIO"].waitForExistence(timeout: 10))
        attach("fixture-today")
        app.swipeUp()
        app.buttons["Type instead"].tap()
        XCTAssertTrue(app.buttons["Keep this moment"].waitForExistence(timeout: 5))
        attach("fixture-compose")
        app.buttons["Cancel"].tap()
        app.buttons["View all moments"].tap()
        XCTAssertTrue(app.buttons["Done"].waitForExistence(timeout: 5))
        attach("fixture-moments")
        app.buttons["Done"].tap()
        app.buttons["The song"].tap()
        XCTAssertTrue(app.staticTexts["A DAY, IN A DIFFERENT LIGHT"].waitForExistence(timeout: 5))
        app.buttons["Next lyric"].tap()
        app.buttons["Next lyric"].tap()
        XCTAssertTrue(app.buttons["The lake held the last light."].exists)
        attach("fixture-song")
        app.buttons["From your diary · view source"].tap()
        XCTAssertTrue(app.buttons["Done"].waitForExistence(timeout: 5))
        attach("fixture-anchor")
        app.buttons["Done"].tap()
        app.buttons["My sky"].tap()
        XCTAssertTrue(app.staticTexts["THE SKY YOU KEEP"].waitForExistence(timeout: 5))
        attach("fixture-my-sky")
    }
    func testLargeTypeAndReducedMotionFixture() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixture-preview", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL", "-UIAccessibilityReduceMotionEnabled", "YES"]
        app.launch()
        XCTAssertTrue(app.buttons["My sky"].waitForExistence(timeout: 10))
        attach("fixture-today-accessibility")
        for _ in 0..<4 where !app.buttons["Type instead"].isHittable { app.swipeUp() }
        app.buttons["Type instead"].tap()
        XCTAssertTrue(app.buttons["Keep this moment"].waitForExistence(timeout: 5))
        app.buttons["Cancel"].tap()
        app.buttons["My sky"].tap()
        XCTAssertTrue(app.staticTexts["THE SKY YOU KEEP"].waitForExistence(timeout: 5))
        attach("fixture-my-sky-accessibility")
        app.buttons["The song"].tap()
        XCTAssertTrue(app.staticTexts["A DAY, IN A DIFFERENT LIGHT"].waitForExistence(timeout: 5))
        attach("fixture-song-accessibility")
    }
    func testTodayStates() {
        for state in ["empty", "moments", "composing", "ready"] {
            let app = XCUIApplication()
            app.launchArguments = ["--fixture-preview"]
            app.launchEnvironment["EVEO_FIXTURE_STATE"] = state
            app.launch()
            XCTAssertTrue(app.buttons["Start voice capture"].waitForExistence(timeout: 10))
            attach("build3-today-\(state)")
            app.swipeUp()
            switch state {
            case "empty":
                XCTAssertFalse(app.buttons["Make today's song"].exists)
                XCTAssertFalse(app.buttons["Play today's song"].exists)
            case "moments": XCTAssertTrue(app.buttons["Make today's song"].exists)
            case "composing": XCTAssertTrue(app.buttons["Composing"].exists)
            default: XCTAssertTrue(app.buttons["Play today's song"].exists)
            }
            app.terminate()
        }
    }

    func testFullMomentAndSettings() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixture-preview"]
        app.launch()
        app.buttons["Settings"].tap()
        XCTAssertTrue(app.buttons["Sign out"].waitForExistence(timeout: 5))
        app.buttons["Done"].tap()
        app.buttons["View all moments"].tap()
        XCTAssertTrue(app.buttons["moment-fixture-event-0-2"].waitForExistence(timeout: 5))
        app.buttons["moment-fixture-event-0-2"].tap()
        XCTAssertTrue(app.staticTexts["You stayed for the light"].waitForExistence(timeout: 5))
        attach("build3-full-moment-title")
    }

    func testVoiceTapReachesCaptureAction() {
        let app = XCUIApplication()
        app.launchArguments = ["--fixture-preview"]
        app.launch()
        app.buttons["Start voice capture"].tap()
        XCTAssertTrue(app.staticTexts["Microphone is disabled in fixture preview."].waitForExistence(timeout: 5))
        app.terminate()
        app.launch()
        app.buttons["Start voice capture"].press(forDuration: 0.8)
        XCTAssertTrue(app.staticTexts["Microphone is disabled in fixture preview."].waitForExistence(timeout: 5))
    }

    private func attach(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
}
