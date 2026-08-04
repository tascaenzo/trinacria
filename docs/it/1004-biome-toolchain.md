# Repository: Toolchain Biome

Il monorepo usa Biome come strumento principale di qualità per JavaScript,
TypeScript e JSON. Sostituisce ESLint e gestisce lint, formattazione e
organizzazione degli import con una sola configurazione e un solo binario.

Prettier rimane limitato a Markdown e YAML, perché Biome non offre ancora una
formattazione stabile per questi formati presenti nel repository.

## Configurazione

Il file root `biome.json` abilita:

- scoperta file integrata con Git;
- preset di lint raccomandato;
- eccezioni di compatibilità ereditate dalla precedente policy ESLint;
- formattazione deterministica a due spazi;
- organizzazione sicura degli import;
- esclusione forzata di output generato e build.

## Comandi

```bash
npm run check
npm run check:fix
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

`check` è il comando usato dalla CI: verifica formatter Biome, linter e regole
assist. `check:fix` applica solo correzioni sicure. Le correzioni unsafe
richiedono sempre una revisione manuale esplicita.

## CI e hook

La CI esegue formattazione, controlli Biome, build, test, copertura e audit delle
dipendenze. L'hook pre-commit applica Biome solo ai file JavaScript e TypeScript
in staging, quindi compila e testa i workspace coinvolti.

Quando cambia la toolchain, vanno aggiornati insieme `biome.json`,
`package.json`, lockfile, workflow CI, script pre-commit e questa guida.
