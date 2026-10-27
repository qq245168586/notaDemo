# Nota MVP 端到端时序

## Happy Path

```mermaid
sequenceDiagram
    participant 用户
    participant Simulator
    participant NextAPI
    participant 数据库
    participant Worker
    participant ASR
    participant AI
    participant AgentTools
    participant MQTT
    participant App

    用户->>Simulator: 开始并停止录音
    Simulator->>NextAPI: 上传音频和 requestId
    NextAPI->>数据库: 预占额度并创建任务
    NextAPI-->>Simulator: 返回 taskId
    NextAPI->>Worker: 提交异步任务
    Worker->>数据库: 标记 AUDIO_PROCESSING
    Worker->>Worker: 探测时长、必要时压缩分片
    loop 每个不超过 290 秒的分片
        Worker->>ASR: 上传处理后的音频分片
        ASR-->>Worker: 返回分片转写
    end
    Worker->>Worker: 按顺序合并原始转写
    Worker->>AI: 校准转写文本
    AI-->>Worker: 返回校准文本
    Worker->>AI: 请求 Agent 选择工具
    AI->>AgentTools: createTodo
    AgentTools-->>AI: 返回待办
    AI->>AgentTools: setReminder 或 searchHistory
    AgentTools-->>AI: 返回工具结果
    AI-->>Worker: 返回摘要和工具调用记录
    Worker->>数据库: 校验结果并核销额度
    Worker->>MQTT: 发布 COMPLETED 和 taskId
    MQTT-->>Simulator: 更新任务状态
    MQTT-->>App: 通知结果可用
    App->>NextAPI: GET taskId
    NextAPI->>数据库: 查询完整结果
    NextAPI-->>App: 转写 摘要 工具记录
    App-->>用户: 展示最终结果
```

## 阶段状态

```text
PENDING
  -> AUDIO_PROCESSING
  -> ASR_PROCESSING
  -> TEXT_CORRECTING
  -> AGENT_RUNNING
  -> RESULT_VALIDATING
  -> COMPLETED
```

任一步出错直接进入 `FAILED`，保存错误、释放预占额度，并通过 MQTT 通知客户端。客户端不从中间步骤继续，而是提示用户重新开始。

## MQTT Topic

第一版只需要一个任务 Topic：

```text
nota/tasks/{taskId}/status
```

示例消息：

```json
{
  "taskId": "task_123",
  "stage": "ASR_PROCESSING",
  "updatedAt": "2026-10-27T15:00:00.000Z"
}
```

消息不携带完整转写和摘要，防止 MQTT 成为第二套业务数据来源。

## 失败路径

```mermaid
sequenceDiagram
    participant Worker
    participant Provider
    participant 数据库
    participant MQTT
    participant Client

    Worker->>Provider: 执行当前步骤
    Provider-->>Worker: 返回错误
    Worker->>数据库: 标记 FAILED 并释放额度
    Worker->>MQTT: 发布 FAILED
    MQTT-->>Client: 通知任务失败
    Client-->>Client: 显示错误和重新开始按钮
```
