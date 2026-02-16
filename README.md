# 🏛 Trinacria Core

> A modular, async-first Dependency Injection engine designed for extensibility.

Trinacria Core is not an HTTP framework.
It is not a scheduler.
It is not a database layer.

It is a foundation.

Trinacria provides a strongly typed, modular, plugin-driven engine that allows you to build frameworks and runtime systems without coupling infrastructure to domain logic.

---

# 🎯 Why Trinacria Exists

Modern backend frameworks often mix:

- Dependency Injection
- Routing
- HTTP servers
- Domain conventions
- Module systems
- Lifecycle management

Over time, this creates tight coupling between infrastructure and business logic.

Trinacria takes a different approach.

Instead of being a full-stack framework, it isolates the engine:

- Typed tokens
- Deterministic DI container
- Explicit module boundaries
- Controlled visibility
- Plugin-based extension model

Everything else lives outside the core.

---

# 🧠 Design Philosophy

### 🔹 Explicit > Implicit

No hidden magic.
No reflection-based injection.
No accidental globals.

Dependencies must be declared.
Modules must export explicitly.
Plugins must opt-in via typed `ProviderKind`.

---

### 🔹 Engine > Framework

Trinacria Core is a foundation layer.

HTTP, Cron, GraphQL, CLI, schedulers — all of these are built as plugins on top of the core.

The engine never changes to support domain features.

---

### 🔹 Deterministic Lifecycle

Trinacria enforces clear phases:

```text
Configuration
↓
Module Build
↓
Container Initialization (eager, async)
↓
Runtime
↓
Shutdown
```

This makes infrastructure predictable and safe.

---

# 🧱 Architecture Overview

```text
TrinacriaApp
   ↓
ModuleRegistry
   ↓
Root Container
   ↓
Module Containers
   ↓
Providers
   ↓
Tokens
```

---

# 🧩 Core Concepts

---

## 🔹 Token

A strongly typed identifier for a dependency.

```ts
const USER_SERVICE = createToken<UserService>("USER_SERVICE");
```

- Based on `symbol`
- Fully type-safe
- No string-based injection

---

## 🔹 Provider

Defines how a dependency is created.

Supported types:

- `classProvider`
- `factoryProvider`
- `valueProvider`

Example:

```ts
const UserServiceProvider = classProvider(USER_SERVICE, UserService);
```

Providers are declarative.
Instantiation happens during container initialization.

---

## 🔹 ProviderKind

A typed tagging system used by plugins.

```ts
const HTTP_CONTROLLER_KIND = createProviderKind<BaseHttpController>();
```

Allows plugins to discover compatible providers without coupling.

---

## 🔹 Module

Modules organize providers and define visibility boundaries.

```ts
export const UserModule = defineModule({
  name: "UserModule",
  providers: [UserServiceProvider],
  exports: [USER_SERVICE],
});
```

Rules:

- Internal providers are private
- Only exported tokens are visible outside
- Imports define visibility boundaries
- No implicit global access

Modules are architectural units, not folders.

---

## 🔹 Plugin

Plugins extend the system without modifying the core.

```ts
export const HttpPlugin = definePlugin({
  name: "http",

  async onInit(app) {
    const controllers = app.getProvidersByKind(HTTP_CONTROLLER_KIND);

    for (const provider of controllers) {
      const instance = await app.resolve(provider.token);

      // Register routes here
    }
  },
});
```

The core does not know about HTTP.
The plugin interprets providers using `ProviderKind`.

---

## 🔹 Global Providers

Infrastructure-level services can be registered globally:

```ts
app.registerGlobalProvider(valueProvider(LOGGER_TOKEN, new ConsoleLogger()));
```

Global providers:

- Live in the root container
- Are visible to all modules
- Should be used for infrastructure (logger, config, metrics)

Avoid using them for domain services.

---

# 🚀 Application API

The main entry point is `TrinacriaApp`.

```ts
const app = new TrinacriaApp();

app
  .registerGlobalProvider(valueProvider(CONFIG_TOKEN, config))
  .use(HttpPlugin)
  .registerModule(UserModule)
  .registerModule(OrderModule);

await app.start();
```

Resolve dependencies:

```ts
const orderService = await app.resolve(ORDER_SERVICE);
```

Shutdown:

```ts
await app.shutdown();
```

---

# 🔄 Lifecycle

### 1️⃣ Configuration Phase

- `use(plugin)`
- `registerModule(module)`
- `registerGlobalProvider(provider)`

No provider instantiation happens here.

---

### 2️⃣ start()

Internally:

```text
plugin.onRegister()
↓
module build
↓
container eager initialization
↓
plugin.onInit()
```

All providers are instantiated asynchronously and deterministically.

---

### 3️⃣ Runtime

- `resolve(token)`
- `getProvidersByKind(kind)`
- `registerModule()` (dynamic)

---

### 4️⃣ shutdown()

```text
plugin.onDestroy()
```

Used for graceful shutdown and resource cleanup.

---

# 🔄 Runtime Module Registration

Modules can be added dynamically:

```ts
await app.registerModule(AdminModule);
```

Plugins are notified via lifecycle hooks.

---

# 📦 What Trinacria Core Does NOT Provide

- HTTP server
- Routing
- Database adapters
- Scheduler
- CLI

These are built as plugins.

---

# 🧭 When to Use Trinacria

Use Trinacria if:

- You want strict modular boundaries
- You need a strongly typed DI engine
- You want full control over infrastructure
- You are building your own framework layer

Do not use Trinacria if:

- You want an opinionated full-stack framework
- You prefer convention over explicit structure

---

# 🏁 Philosophy in One Sentence

> Trinacria is a modular DI engine designed to remain small, explicit, and extensible — while letting domain and infrastructure live outside the core.

---
