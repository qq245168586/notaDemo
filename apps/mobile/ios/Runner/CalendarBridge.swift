import EventKit
import Flutter

/// 用户在 Flutter 确认具体时间后，才通过此通道写入系统。
final class CalendarBridge {
  private let store = EKEventStore()
  private let channel: FlutterMethodChannel

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: "nota/system_schedule", binaryMessenger: messenger)
    channel.setMethodCallHandler { [weak self] call, result in
      guard call.method == "save", let args = call.arguments as? [String: Any] else {
        result(FlutterMethodNotImplemented)
        return
      }
      self?.save(args, result: result)
    }
  }

  func save(_ args: [String: Any], result: @escaping FlutterResult) {
    guard let kind = args["kind"] as? String, ["calendar", "reminder"].contains(kind),
      let title = args["title"] as? String, !title.trimmingCharacters(in: .whitespaces).isEmpty,
      let milliseconds = args["startAt"] as? NSNumber,
      let key = args["key"] as? String else {
      result(FlutterError(code: "INVALID", message: "请确认标题和时间", details: nil))
      return
    }
    let date = Date(timeIntervalSince1970: milliseconds.doubleValue / 1000)
    let minutes = (args["remindBeforeMinutes"] as? NSNumber)?.doubleValue ?? 0
    guard minutes >= 0, date.addingTimeInterval(-minutes * 60) > Date() else {
      result(FlutterError(code: "INVALID_TIME", message: "提醒时间已过去，请调整日期或提前量", details: nil))
      return
    }
    let completion: (Bool, Error?) -> Void = { [weak self] granted, error in
      DispatchQueue.main.async {
        guard let self = self else { return }
        guard granted else {
          result(FlutterError(code: "PERMISSION_DENIED", message: "未获得系统权限，请在设置中允许访问日历或提醒事项", details: nil))
          return
        }
        do {
          let cacheKey = "nota.schedule.\(kind).\(key)"
          if let id = UserDefaults.standard.string(forKey: cacheKey),
            self.store.calendarItem(withIdentifier: id) != nil {
            result(["id": id, "alreadySaved": true])
            return
          }
          let notes = args["notes"] as? String ?? "来自 Nota 录音"
          let id: String
          if kind == "calendar" {
            let event = EKEvent(eventStore: self.store)
            guard let calendar = self.store.defaultCalendarForNewEvents else {
              throw NSError(domain: "Nota", code: 1, userInfo: [NSLocalizedDescriptionKey: "没有可写日历，请先打开系统日历完成初始化"])
            }
            event.calendar = calendar
            event.title = title
            event.notes = notes
            event.startDate = date
            event.endDate = date.addingTimeInterval(3600)
            event.addAlarm(EKAlarm(relativeOffset: -minutes * 60))
            try self.store.save(event, span: .thisEvent)
            id = event.calendarItemIdentifier
          } else {
            let reminder = EKReminder(eventStore: self.store)
            var calendar = self.store.defaultCalendarForNewReminders()
            if calendar == nil, let source = self.store.sources.first(where: { $0.sourceType == .local }) {
              let local = EKCalendar(for: .reminder, eventStore: self.store)
              local.title = "Nota 提醒"
              local.source = source
              try self.store.saveCalendar(local, commit: true)
              calendar = local
            }
            guard let writableCalendar = calendar else {
              throw NSError(domain: "Nota", code: 2, userInfo: [NSLocalizedDescriptionKey: "没有提醒事项列表，请先打开系统提醒事项完成初始化"])
            }
            reminder.calendar = writableCalendar
            reminder.title = title
            reminder.notes = notes
            reminder.dueDateComponents = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
            reminder.addAlarm(EKAlarm(absoluteDate: date.addingTimeInterval(-minutes * 60)))
            try self.store.save(reminder, commit: true)
            id = reminder.calendarItemIdentifier
          }
          UserDefaults.standard.set(id, forKey: cacheKey)
          result(["id": id, "alreadySaved": false])
        } catch {
          result(FlutterError(code: "SAVE_FAILED", message: error.localizedDescription, details: nil))
        }
      }
    }
    if #available(iOS 17.0, *) {
      if kind == "calendar" { store.requestFullAccessToEvents(completion: completion) }
      else { store.requestFullAccessToReminders(completion: completion) }
    } else {
      store.requestAccess(to: kind == "calendar" ? .event : .reminder, completion: completion)
    }
  }
}
