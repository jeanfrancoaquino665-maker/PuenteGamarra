# Puente Gamarra

Plataforma web, pensada para el celular, que guía a los comerciantes de Gamarra (de galería y ambulantes) hacia la formalización tributaria y laboral y, a cambio, les da visibilidad ante los compradores con la insignia **«Negocio verificado»**.

Este repositorio contiene el **MVP (Release 1.0)**: las historias *Must* del Product Backlog en Jira (proyecto `SCRUM`).

| Historia | Funcionalidad |
|---|---|
| HU-01, HU-04 | Registro con DNI, celular y contraseña, con consentimiento de datos (Ley N.° 29733) |
| HU-02, HU-03 | Inicio de sesión con JWT, bloqueo tras 5 intentos y roles (comerciante, fiscalizador, admin) |
| HU-05 | Registro del negocio (galería o ambulante) |
| HU-09, HU-10 | Diagnóstico de formalidad y ruta personalizada |
| HU-11 | Validación del RUC con un servicio externo e insignia «Negocio verificado» |
| HU-14, HU-15 | Vitrina pública de búsqueda, sin datos personales |

## Arquitectura

- **Frontend:** HTML, CSS y JavaScript (mobile-first), servido por el backend.
- **Backend/API:** Node.js + Express (REST, JSON).
- **Base de datos:** SQLite embebida (sql.js) con consultas parametrizadas.
- **Autenticación:** contraseñas con bcrypt y sesiones con JWT (HS256, 2 horas).
- **Servicio externo:** consulta de RUC mediante un adaptador (`RUC_API_URL`); sin configurar, usa un padrón simulado.

## Ejecutar en local

```bash
npm install
npm test        # pruebas unitarias y de integración
npm start       # http://localhost:3000
```

Variables de entorno: `JWT_SECRET` (obligatoria en producción), `ADMIN_DNI` y `ADMIN_PASSWORD` (crean el administrador), `RUC_API_URL` y `RUC_API_TOKEN` (proveedor RUC real).

## Ramas y flujo de trabajo

- `main`: producción. Solo recibe cambios mediante Pull Request.
- `test`: integración y pruebas. Cada push ejecuta el pipeline de CI.

## Pipeline CI/CD (GitHub Actions)

1. **Build:** `npm ci` y verificación de sintaxis.
2. **Pruebas:** Jest + Supertest con reporte de cobertura.
3. **Seguridad:** `npm audit` (dependencias), Gitleaks (secretos) y CodeQL (SAST).
4. **Deploy:** solo en `main`, mediante el Deploy Hook de Render, y verificación de `/api/salud`.
