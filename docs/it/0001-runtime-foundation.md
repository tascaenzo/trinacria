# 🏛 Trinacria Core

> Un motore di Dependency Injection modulare, async-first ed estendibile.

Trinacria Core non è un framework HTTP.
Non è uno scheduler.
Non è un layer database.

È una **fondazione**.

Trinacria fornisce un motore fortemente tipizzato, modulare e basato su plugin che permette di costruire framework e runtime system senza accoppiare infrastruttura e logica di dominio.

---

# 🎯 Perché nasce Trinacria

Molti framework backend moderni mescolano:

- Dependency Injection
- Routing
- Server HTTP
- Convenzioni di dominio
- Sistema moduli
- Lifecycle applicativo

Nel tempo questo porta a:

- Accoppiamento forte
- Dipendenze implicite
- Strutture poco chiare
- Difficoltà di estensione

Trinacria adotta un approccio diverso.

Invece di essere un framework completo, isola il motore:

- Token tipizzati
- Container deterministico
- Confini modulari espliciti
- Visibilità controllata
- Estensioni tramite plugin

Tutto il resto vive fuori dal core.

---

# 🧠 Filosofia di Design

### 🔹 Esplicito > Implicito

Nessuna magia nascosta.
Nessuna reflection per l’injection.
Nessuna dipendenza globale accidentale.

Le dipendenze devono essere dichiarate.
I moduli devono esportare esplicitamente.
I plugin devono dichiarare il loro ambito tramite `ProviderKind`.

---

### 🔹 Motore > Framework

Trinacria Core è una base.

HTTP, Cron, GraphQL, CLI, scheduler — tutto viene costruito come plugin sopra il core.

Il motore non cambia per supportare feature di dominio.

---

### 🔹 Lifecycle Deterministico

Trinacria impone fasi chiare:

```text
Configurazione
↓
Costruzione Moduli
↓
Inizializzazione Container (eager, async)
↓
Runtime
↓
Shutdown
```

Questo rende l’infrastruttura prevedibile e sicura.

---

# 🧱 Architettura

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

# 🧩 Concetti Fondamentali

---

## 🔹 Token

Un identificatore tipizzato per una dipendenza.

```ts
const USER_SERVICE = createToken<UserService>("USER_SERVICE");
```

- Basato su `symbol`
- Type-safe
- Nessuna injection string-based

---

## 🔹 Provider

Definisce come creare una dipendenza.

Tipi supportati:

- `classProvider`
- `factoryProvider`
- `valueProvider`

Esempio:

```ts
const UserServiceProvider = classProvider(USER_SERVICE, UserService);
```

Il provider è dichiarativo.
L’istanziazione avviene durante l’inizializzazione del container.

---

## 🔹 ProviderKind

Sistema di tagging tipizzato usato dai plugin.

```ts
const HTTP_CONTROLLER_KIND = createProviderKind<BaseHttpController>();
```

Permette ai plugin di scoprire provider compatibili senza accoppiamento diretto.

---

## 🔹 Modulo

I moduli organizzano provider e definiscono i confini di visibilità.

```ts
export const UserModule = defineModule({
  name: "UserModule",
  providers: [UserServiceProvider],
  exports: [USER_SERVICE],
});
```

Regole:

- I provider interni sono privati
- Solo i token esportati sono visibili all’esterno
- Gli import definiscono cosa è accessibile
- Nessun accesso globale implicito

I moduli sono unità architetturali, non semplici cartelle.

---

## 🔹 Plugin

I plugin estendono il sistema senza modificare il core.

```ts
export const HttpPlugin = definePlugin({
  name: "http",

  async onInit(app) {
    const controllers = app.getProvidersByKind(HTTP_CONTROLLER_KIND);

    for (const provider of controllers) {
      const instance = await app.resolve(provider.token);

      // Registrazione delle route
    }
  },
});
```

Il core non conosce HTTP.
Il plugin interpreta i provider tramite `ProviderKind`.

---

## 🔹 Provider Globali

Servizi infrastrutturali possono essere registrati a livello globale:

```ts
app.registerGlobalProvider(valueProvider(LOGGER_TOKEN, new ConsoleLogger()));
```

I provider globali:

- Vivono nel Root Container
- Sono visibili a tutti i moduli
- Vanno usati per infrastruttura (logger, config, metriche)

Non usarli per logica di dominio.

---

# 🚀 API Principale

L’entry point è `TrinacriaApp`.

```ts
const app = new TrinacriaApp();

app
  .registerGlobalProvider(valueProvider(CONFIG_TOKEN, config))
  .use(HttpPlugin)
  .registerModule(UserModule)
  .registerModule(OrderModule);

await app.start();
```

Risoluzione dipendenze:

```ts
const orderService = await app.resolve(ORDER_SERVICE);
```

Shutdown:

```ts
await app.shutdown();
```

---

# 🔄 Lifecycle

### 1️⃣ Fase di Configurazione

- `use(plugin)`
- `registerModule(module)`
- `registerGlobalProvider(provider)`

In questa fase non avviene alcuna istanziazione.

---

### 2️⃣ start()

Internamente:

```text
plugin.onRegister()
↓
build moduli
↓
inizializzazione eager del container
↓
plugin.onInit()
```

Tutti i provider vengono istanziati in modo asincrono e deterministico.

---

### 3️⃣ Runtime

- `resolve(token)`
- `getProvidersByKind(kind)`
- `registerModule()` dinamico

---

### 4️⃣ shutdown()

```text
plugin.onDestroy()
```

Serve per il rilascio pulito delle risorse.

---

# 🔄 Registrazione Moduli a Runtime

È possibile aggiungere moduli dinamicamente:

```ts
await app.registerModule(AdminModule);
```

I plugin vengono notificati automaticamente.

---

# 📦 Cosa NON Fornisce Trinacria Core

- Server HTTP
- Routing
- Driver database
- Scheduler
- CLI

Tutto questo si costruisce tramite plugin.

---

# 🧭 Quando Usare Trinacria

Usa Trinacria se:

- Vuoi confini modulari rigidi
- Hai bisogno di un motore DI fortemente tipizzato
- Vuoi controllo totale sull’infrastruttura
- Stai costruendo un tuo framework

Non usarlo se:

- Cerchi un framework full-stack opinionated
- Preferisci convenzioni implicite
- Vuoi scaffolding rapido senza architettura esplicita

---

# 🏁 Filosofia in una Frase

> Trinacria è un motore DI modulare progettato per restare piccolo, esplicito ed estendibile — lasciando dominio e infrastruttura fuori dal core.

---
