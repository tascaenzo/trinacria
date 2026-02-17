# 🏛 Trinacria Core

> A modular, async-first, extensible Dependency Injection engine.

Trinacria Core is not an HTTP framework.
It is not a scheduler.
It is not a database layer.

It is a **foundation**.

Trinacria provides a strongly typed, modular, plugin-based engine that lets you build frameworks and runtime systems without coupling infrastructure and domain logic.

---

# 🎯 Why Trinacria Exists

Many modern backend frameworks mix together:

- Dependency Injection
- Routing
- HTTP server
- Domain conventions
- Module system
- Application lifecycle

Over time, this often leads to:

- Tight coupling
- Implicit dependencies
- Unclear structure
- Harder extensibility

Trinacria takes a different approach.

Instead of being an all-in-one framework, it isolates the engine:

- Typed tokens
- Deterministic container
- Explicit module boundaries
- Controlled visibility
- Plugin-based extensions

Everything else lives outside the core.

---

# 🧠 Design Philosophy

### 🔹 Explicit > Implicit

No hidden magic.
No reflection-based injection.
No accidental global dependencies.

Dependencies must be declared.
Modules must export explicitly.
Plugins must declare their scope via `ProviderKind`.

---

### 🔹 Engine > Framework

Trinacria Core is a foundation.

HTTP, Cron, GraphQL, CLI, schedulers: everything is built as plugins on top of the core.

The engine does not change to support domain-level features.

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

# 🧱 Architecture

```text
TrinacriaApp
   ↓
ModuleRegistry
   ↓
Root Container
   ↓
Module Containers
   ↓
Provider
   ↓
Token
```

---

# 🧩 Core Concepts

---

## 🔹 Token

A typed identifier for a dependency.

```ts
const USER_SERVICE = createToken<UserService>("USER_SERVICE");
```

- Symbol-based
- Type-safe
- No string-based injection

---

## 🔹 Provider

Defines how to create a dependency.

Supported provider types:

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

Typed tagging system used by plugins.

```ts
const HTTP_CONTROLLER_KIND = createProviderKind<BaseHttpController>();
```

It allows plugins to discover compatible providers without direct coupling.

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
- Only exported tokens are visible externally
- Imports define what is accessible
- No implicit global access

Modules are architectural units, not just folders.

---

## 🔹 Plugin

Plugins extend the system without changing the core.

```ts
export const HttpPlugin = definePlugin({
  name: "http",

  async onInit(app) {
    const controllers = app.getProvidersByKind(HTTP_CONTROLLER_KIND);

    for (const provider of controllers) {
      const instance = await app.resolve(provider.token);

      // Route registration
    }
  },
});
```

The core knows nothing about HTTP.
The plugin interprets providers through `ProviderKind`.

---

## 🔹 Global Providers

Infrastructure services can be registered globally:

```ts
app.registerGlobalProvider(valueProvider(LOGGER_TOKEN, new ConsoleLogger()));
```

Global providers:

- Live in the root container
- Are visible to all modules
- Should be used for infrastructure (logger, config, metrics)

Do not use them for domain logic.

---

# 🚀 Main API

The entry point is `TrinacriaApp`.

```ts
const app = new TrinacriaApp();

app
  .registerGlobalProvider(valueProvider(CONFIG_TOKEN, config))
  .use(HttpPlugin)
  .registerModule(UserModule)
  .registerModule(OrderModule);

await app.start();
```

Dependency resolution:

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

No instantiation happens in this phase.

---

### 2️⃣ start()

Internally:

```text
plugin.onRegister()
↓
build modules
↓
eager container initialization
↓
plugin.onInit()
```

All providers are instantiated asynchronously and deterministically.

---

### 3️⃣ Runtime

- `resolve(token)`
- `getProvidersByKind(kind)`
- dynamic `registerModule()`

---

### 4️⃣ shutdown()

```text
plugin.onDestroy()
```

Used for graceful resource cleanup.

---

# 🔄 Runtime Module Registration

You can add modules dynamically:

```ts
await app.registerModule(AdminModule);
```

Plugins are notified automatically.

---

# 📦 What Trinacria Core Does NOT Provide

- HTTP server
- Routing
- Database drivers
- Scheduler
- CLI

All of these are built as plugins.

---

# 🧭 When to Use Trinacria

Use Trinacria if:

- You need strict modular boundaries
- You need a strongly typed DI engine
- You want full control over infrastructure
- You are building your own framework

Do not use it if:

- You want an opinionated full-stack framework
- You prefer implicit conventions
- You want fast scaffolding without explicit architecture

---

# 🏁 Philosophy in One Sentence

> Trinacria is a modular DI engine designed to stay small, explicit, and extensible, keeping domain and infrastructure outside the core.

---
