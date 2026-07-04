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

Note di sicurezza startup:

- lo startup mantiene uno stato interno (`idle | starting | started | failed`)
- se lo startup fallisce, l'app entra in stato `failed` e va ricreata prima di ritentare `start()`

---

### 3️⃣ Runtime

- `resolve(token)`
- `getProvidersByKind(kind)`
- `registerModule()` dinamico
- `unregisterModule()` dinamico
- `isModuleRegistered(module)`
- `listModules()`
- `hasToken(token)`
- `describeGraph()`

---

### 4️⃣ shutdown()

`shutdown()` e fail-safe:

1. esegue `plugin.onDestroy()` su tutti i plugin (collezionando errori)
2. prova sempre a distruggere registry/container
3. lancia errori aggregati solo dopo aver completato il tentativo di cleanup

---

# 🔄 Registrazione Moduli a Runtime

È possibile aggiungere moduli dinamicamente:

```ts
await app.registerModule(AdminModule);
```

La registrazione runtime è transazionale:

1. il modulo viene aggiunto alla lista runtime interna
2. il grafo modulo viene costruito nel registry
3. i container vengono inizializzati (eager)
4. i plugin vengono notificati via `onModuleRegistered`

Se un plugin fallisce, Trinacria esegue rollback:

1. chiama `onModuleUnregistered` sui plugin già notificati (ordine inverso)
2. rimuove il modulo dal registry (cleanup container/export/kind-index)
3. rimuove il modulo dalla lista runtime
4. lancia `ModuleRegistrationError` con dettagli su errore di registrazione + rollback

Questo mantiene lo stato runtime coerente anche in caso di failure parziali dei plugin.

---

# 🔧 Dettagli `unregisterModule()`

`unregisterModule(module)` esegue:

1. validazione che nessun altro modulo importi il modulo target
2. esecuzione hook `onDestroy()` dei provider modulo (ordine inverso di creazione)
3. rimozione alias dei token esportati dalla visibilità root
4. pulizia riferimenti provider-kind usati dalla discovery plugin
5. notifica plugin via `onModuleUnregistered`

Se gli hook plugin falliscono in unregistration, il cleanup resta valido e Trinacria solleva `ModuleUnregistrationError`.

---

# 🔬 Hook Lifecycle Provider

Le istanze provider possono esporre hook opzionali:

- `onInit(): void | Promise<void>`
- `onDestroy(): void | Promise<void>`

Comportamento:

- `onInit` viene invocato dopo l’istanziazione del provider
- `onDestroy` viene invocato in unregistration modulo e shutdown applicativo
- l’ordine di destroy è inverso all’ordine di istanziazione per minimizzare problemi di teardown dipendenze

Comportamento runtime aggiuntivo:

- i token esportati da modulo sono riesposti sul root tramite provider alias lazy
- i provider alias non rieseguono `onInit/onDestroy`; il lifecycle resta in carico alle istanze del modulo
- il fallimento di istanziazione di un provider non resta cached per sempre, quindi un resolve futuro puo ritentare

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
