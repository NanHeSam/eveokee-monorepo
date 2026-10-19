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
        app.buttons["Leave a few words instead"].tap()
        XCTAssertTrue(app.buttons["Keep this moment"].waitForExistence(timeout: 5))
        attach("fixture-compose")
        app.buttons["Cancel"].tap()
        app.buttons["5 little traces · touch one to remember"].tap()
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
        app.buttons["My sky"].tap()
        XCTAssertTrue(app.staticTexts["THE SKY YOU KEEP"].waitForExistence(timeout: 5))
        attach("fixture-my-sky-accessibility")
        app.buttons["The song"].tap()
        XCTAssertTrue(app.staticTexts["A DAY, IN A DIFFERENT LIGHT"].waitForExistence(timeout: 5))
        attach("fixture-song-accessibility")
    }
    private func attach(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
}
