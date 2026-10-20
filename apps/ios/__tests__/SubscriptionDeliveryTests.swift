import XCTest
@preconcurrency import Combine
@preconcurrency import ConvexMobile
@testable import Eveokee

// The test owns the subscription on MainActor and sends from one worker at a time.
private final class BackgroundSubscription: @unchecked Sendable {
    let subject = PassthroughSubject<[Diary], ClientError>()
}

@MainActor
final class SubscriptionDeliveryTests: XCTestCase {
    func testBackgroundValueIsDeliveredOnMainActor() async {
        let store = BackendStore()
        let source = BackgroundSubscription()
        let delivered = expectation(description: "Value delivered")
        store.observe(source.subject.eraseToAnyPublisher()) { _, value in
            XCTAssertTrue(Thread.isMainThread)
            XCTAssertEqual(value.count, 0)
            delivered.fulfill()
        }
        await Task.detached { source.subject.send([]) }.value
        await fulfillment(of: [delivered], timeout: 2)
    }

    func testBackgroundDecodingFailureSurfacesAsStoreError() async {
        let store = BackendStore()
        let source = BackgroundSubscription()
        let finished = expectation(description: "Main queue drained")
        store.observe(source.subject.eraseToAnyPublisher()) { _, _ in
            XCTFail("A decoding failure must not publish a value")
        }
        await Task.detached {
            // Mirrors Convex's SubscriptionAdapter.onUpdate catch path.
            do {
                let _ = try JSONDecoder().decode([Diary].self, from: Data(#"[{"_id":"broken","date":"wrong type"}]"#.utf8))
                XCTFail("Malformed server data must fail decoding")
            } catch {
                source.subject.send(completion: .failure(.InternalError(msg: error.localizedDescription)))
            }
        }.value
        DispatchQueue.main.async { finished.fulfill() }
        await fulfillment(of: [finished], timeout: 2)
        XCTAssertNotNil(store.error)
        XCTAssertFalse(store.loading)
    }

    func testDisconnectDropsAlreadyQueuedValuesAndFailures() async {
        let store = BackendStore()
        let source = BackgroundSubscription()
        let staleValue = expectation(description: "Old session must not update the store")
        staleValue.isInverted = true
        store.observe(source.subject.eraseToAnyPublisher()) { _, _ in staleValue.fulfill() }
        // Keep MainActor occupied until the delivery is queued, then cancel the session.
        DispatchQueue.global().sync { @Sendable in
            source.subject.send([])
            source.subject.send(completion: .failure(.InternalError(msg: "Old session")))
        }
        store.disconnect()
        await fulfillment(of: [staleValue], timeout: 0.2)
        XCTAssertNil(store.error)
        XCTAssertFalse(store.connected)
    }
}
