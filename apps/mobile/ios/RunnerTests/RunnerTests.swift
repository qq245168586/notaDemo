import Flutter
import UIKit
import XCTest
import EventKit
@testable import Runner

class RunnerTests: XCTestCase {

  @MainActor
  func testSaveCalendarEvent() throws {
    try verifySave(kind: "calendar")
  }

  @MainActor
  func testSaveSystemReminder() throws {
    try verifySave(kind: "reminder")
  }

  @MainActor
  private func verifySave(kind: String) throws {
    let controller = try XCTUnwrap((UIApplication.shared.delegate as? FlutterAppDelegate)?.window?.rootViewController as? FlutterViewController)
    let bridge = CalendarBridge(messenger: controller.binaryMessenger)
    let date = Date().addingTimeInterval(172800)
    let title = "Nota 自动测试 \(UUID().uuidString)"
    let args: [String: Any] = ["kind": kind, "title": title,
      "startAt": date.timeIntervalSince1970 * 1000,
      "key": UUID().uuidString, "remindBeforeMinutes": 10]
    let saved = expectation(description: "系统保存完成")
    var identifier: String?
    bridge.save(args) { response in
      if let error = response as? FlutterError { XCTFail(error.message ?? error.code) }
      identifier = (response as? [String: Any])?["id"] as? String
      saved.fulfill()
    }
    wait(for: [saved], timeout: 30)
    let id = try XCTUnwrap(identifier)
    let store = EKEventStore()
    let item = try XCTUnwrap(store.calendarItem(withIdentifier: id))
    XCTAssertEqual(item.title, title)
    XCTAssertEqual(item.alarms?.count, 1)
    let duplicate = expectation(description: "重复保存不新增")
    bridge.save(args) { response in
      let body = response as? [String: Any]
      XCTAssertEqual(body?["id"] as? String, id)
      XCTAssertEqual(body?["alreadySaved"] as? Bool, true)
      duplicate.fulfill()
    }
    wait(for: [duplicate], timeout: 10)
    // 仅清理本测试创建的事项。
    if let event = item as? EKEvent { try store.remove(event, span: .thisEvent) }
    if let reminder = item as? EKReminder { try store.remove(reminder, commit: true) }
  }
}
