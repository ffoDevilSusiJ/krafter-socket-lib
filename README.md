# Krafter Socket Library

Event Processor Service библиотека с использованием Redis Pub/Sub для реализации Event Driven архитектуры.

Служит агрегатором исходного кода, dto и утилит для реализации обработчика событий в микросервисе.

## Формат событий

Библиотека поддерживает унифицированный формат событий: **`serviceName:module:name`**

Примеры:
- `stickyNotes:note:create`
- `chat:message:send`
- `whiteboard:shape:draw`

## Основные компоненты

### EventProcessor

Обрабатывает события из Redis Pub/Sub:

```typescript
import { EventProcessor } from 'krafter-socket-lib';

const processor = new EventProcessor({
  redis: { host: 'localhost', port: 6379 },
  incomingChannel: 'events:stickyNotes',
  outgoingChannel: 'events:broadcast',
  enableLogging: true,
});

// Регистрация обработчика событий
processor.registerEventHandler('stickyNotes:note:create', async (context) => {
  // Обработка события
  const { event, userId, roomId } = context;

  // Возврат broadcast события
  return {
    type: 'stickyNotes:note:created',
    recipients: [],
    payload: { ... }
  };
});

await processor.start();
```

**Автоматический парсинг событий:**
EventProcessor автоматически парсит eventType и заполняет поля:
- `serviceName`
- `module`
- `eventName`

### EventParser

Утилита для работы с форматом событий:

```typescript
import { EventParser } from 'krafter-socket-lib';

// Парсинг события
const parsed = EventParser.parseEventType('stickyNotes:note:create');
// { serviceName: 'stickyNotes', module: 'note', eventName: 'create' }

// Форматирование события
const eventType = EventParser.formatEventType('stickyNotes', 'note', 'create');
// 'stickyNotes:note:create'

// Валидация формата
const isValid = EventParser.isValidEventFormat('stickyNotes:note:create');
// true

// Извлечение serviceName
const serviceName = EventParser.getServiceName('stickyNotes:note:create');
// 'stickyNotes'
```

## Типы

### IGatewayEvent

Событие от Gateway:

```typescript
interface IGatewayEvent {
  eventType: string;              // 'stickyNotes:note:create'
  serviceName?: string;            // 'stickyNotes' (автоматически заполняется)
  module?: string;                 // 'note' (автоматически заполняется)
  eventName?: string;              // 'create' (автоматически заполняется)
  userId: string;
  socketId: string;
  roomId?: string;
  payload: unknown;
  timestamp: number;
}
```

### IEventRoute

Разобранное событие:

```typescript
interface IEventRoute {
  serviceName: string;
  module: string;
  eventName: string;
}
```

### IServiceConfig

Конфигурация сервиса:

```typescript
interface IServiceConfig {
  serviceName: string;
  channel: string;
}
```

## Пример использования

```typescript
import {
  EventProcessor,
  EventParser,
  IEventContext,
  IBroadcastEvent,
} from 'krafter-socket-lib';

// Создание процессора
const processor = new EventProcessor({
  redis: { host: 'localhost', port: 6379 },
  incomingChannel: 'events:myService',
  outgoingChannel: 'events:broadcast',
  enableLogging: true,
});

// Регистрация обработчиков с новым форматом
processor.registerEventHandler(
  'myService:module:action',
  async (context: IEventContext): Promise<IBroadcastEvent | null> => {
    const { event, userId, roomId } = context;

    // event.serviceName === 'myService'
    // event.module === 'module'
    // event.eventName === 'action'

    // Ваша бизнес-логика

    return {
      type: 'myService:entity:actionCompleted',
      recipients: [],
      payload: { result: 'success' }
    };
  }
);

await processor.start();
```

