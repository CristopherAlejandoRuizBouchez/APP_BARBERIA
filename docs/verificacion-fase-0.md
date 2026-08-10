# Verificación de la Fase 0

**Fecha:** 7 de agosto de 2026
**Node:** v22.22.2 · **TypeScript:** 6.0.3 · **Prettier:** 3.8.1

La salida cruda está en `verificacion-fase-0.txt`, generada por `.verif/ejecutar.sh` **antes** de empaquetar el ZIP.

---

## Lo que no se pudo ejecutar, y por qué

El entorno donde se generó esta entrega **tiene bloqueado el registro de npm**. Comprobado directo y a través del proxy:

```
registry.npmjs.org        403
registry.yarnpkg.com      sin conexión
registry.npmmirror.com    sin conexión
unpkg.com                 sin conexión
cdn.jsdelivr.net          sin conexión
```

Sin acceso al registro no se pueden descargar `next`, `react`, `tailwindcss` ni `vitest`, y por tanto **no se pueden ejecutar aquí**:

| Comando                          | Por qué no                                              |
| -------------------------------- | ------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | No hay registro del que resolver ni descargar           |
| `pnpm lint`                      | ESLint necesita `typescript-eslint` y el plugin de Next |
| `pnpm test`                      | Vitest no está instalado                                |
| `pnpm build`                     | Next no está instalado                                  |
| `pnpm test:e2e`                  | Playwright necesita el build previo                     |
| `pnpm audit --audit-level high`  | La auditoría consulta la base de avisos del registro    |

**Consecuencia directa: no se puede generar `pnpm-lock.yaml`.** Un lockfile escrito a mano sería peor que ninguno: los hashes de integridad no coincidirían y `--frozen-lockfile` fallaría, o —peor— instalaría algo distinto de lo declarado. No se incluye ninguno inventado.

Los tres comandos para generarlo y comprobar que queda estable están en el README, sección _Primer arranque_.

Para reducir al mínimo el riesgo de que esa primera instalación falle, `package.json` se recortó a **8 dependencias y 16 de desarrollo**: exactamente lo que el código importa hoy, ni un paquete más. Se verifica automáticamente (paso 3 de abajo).

---

## Lo que sí se ejecutó

### 1 · `tsc --strict` sobre los módulos puros

Compilación con `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals` y `noUnusedParameters` de `dinero`, `fechas`, `telefono`, `folios`, `errores` y `env-parseo`, junto con sus pruebas.

```
codigo de salida: 0
```

### 2 · Pruebas unitarias

101 pruebas ejecutadas con el runner nativo de Node y `TZ=America/Mexico_City`, sobre el mismo código fuente que consumirá Vitest.

```
# tests 101
# suites 29
# pass 101
# fail 0
# skipped 0
```

Reparto por módulo:

| Módulo       | Pruebas | Cubre                                                                        |
| ------------ | ------- | ---------------------------------------------------------------------------- |
| `env-parseo` | 24      | booleanos literales, cadenas vacías, número de WhatsApp, errores agrupados   |
| `dinero`     | 26      | centavos, redondeo, factor exprés, comisiones, reparto, pagos divididos      |
| `fechas`     | 22      | zona CDMX, hora de pared ↔ UTC, día de la semana, rejilla de slots, traslape |
| `telefono`   | 18      | normalización E.164, formato antiguo `521`, rechazo de números no mexicanos  |
| `folios`     | 11      | alfabeto sin ambigüedades, no correlativos, normalización de la entrada      |

### 3 · Sintaxis, dependencias y fugas de `process.env`

```
43 archivos · 4282 lineas
errores de sintaxis: 0
fugas de process.env: 0
ok todos los imports estan declarados en package.json
declarados aun sin usar (fases 1-12): ninguno
```

El chequeo de `process.env` recorre el árbol sintáctico —no una expresión regular— y confirma que solo `src/lib/env.ts` accede al entorno. Es la misma regla que aplica ESLint, verificada aquí sin poder ejecutarlo.

### 4 · `prettier --check .`

Con la configuración real del proyecto, la misma que usa `pnpm format:check`.

```
Checking formatting...
All matched files use Prettier code style!
codigo de salida: 0
```

### 5 · Validez de configuración

```
ok  package.json
ok  tsconfig.json
ok  vercel.json
ok  .github/workflows/ci.yml
```

---

## Qué falta para cerrar la fase

En una copia limpia, con Node 22 y pnpm 10.28.0:

```bash
corepack prepare pnpm@10.28.0 --activate
cp .env.example .env.local

pnpm install                     # genera pnpm-lock.yaml
rm -rf node_modules
pnpm install --frozen-lockfile   # debe pasar sin tocar el lockfile
git diff --exit-code pnpm-lock.yaml

pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm audit --audit-level high
```

`.github/workflows/ci.yml` ejecuta exactamente esa secuencia en cada push y cada PR: al subir el repositorio tendrás la salida verificada sin depender de nadie.

**La fase 0 no está cerrada hasta que esos comandos pasen.**
