# Partes digitales

Aplicacion web estatica para capturar partes de trabajo de tecnicos desde GitHub Pages y guardarlos en Google Sheets mediante Google Apps Script.

No necesita Render ni servidor Node para funcionar en produccion.

## Estructura importante

```text
public/
  index.html
  app.js
  operarios.js
  styles.css
  config.js
  config.example.js
google-apps-script/
  Code.gs
```

## 1. Crear el Google Sheets

1. Crea un Google Sheets nuevo.
2. Ponle un nombre, por ejemplo `Partes digitales`.
3. Abre `Extensiones` > `Apps Script`.
4. Borra el contenido inicial y pega el contenido de:

```text
google-apps-script/Code.gs
```

5. Guarda el proyecto.

El script creara automaticamente una hoja por mes con nombre `YYYY-MM`, por ejemplo `2026-05`.
Si ya existia una hoja mensual antes de una actualizacion de columnas, puedes ejecutar la funcion `actualizarEncabezados` desde Apps Script para refrescar los encabezados.

## 2. Desplegar Google Apps Script como Web App

1. En Apps Script pulsa `Implementar` > `Nueva implementación`.
2. Tipo: `Aplicación web`.
3. Ejecutar como: `Yo`.
4. Quien tiene acceso: `Cualquier usuario`.
5. Pulsa `Implementar`.
6. Autoriza los permisos cuando Google lo pida.
7. Copia la URL que termina en `/exec`.

Esa URL se usara para guardar los partes en tu Google Sheets.

## 3. Configurar la web

Abre:

```text
public/config.js
```

Y pega la URL de Apps Script:

```js
window.PARTES_CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/TU_ID_DE_DEPLOYMENT/exec",
};
```

La URL de Apps Script no es una clave privada. Es normal que este en el frontend.

## 4. Subir a GitHub Pages

Sube al repositorio como minimo estos archivos:

```text
public/index.html
public/app.js
public/operarios.js
public/styles.css
public/config.js
google-apps-script/Code.gs
README.md
```

En GitHub:

1. Ve a `Settings` > `Pages`.
2. En `Build and deployment`, selecciona `Deploy from a branch`.
3. Elige la rama `main`.
4. Si subes los archivos dentro de la carpeta `public`, puedes configurar Pages para usar esa carpeta si tu repositorio lo permite, o mover el contenido de `public` a la raiz del repositorio.

Si tu usuario es `igyomee` y el repositorio se llama `Partes`, la URL sera normalmente:

```text
https://igyomee.github.io/Partes/
```

## Funcionamiento

Al guardar un parte:

- La web valida los campos obligatorios.
- `Jefe de Obra` es obligatorio y se guarda con su codigo.
- Cada tecnico se introduce con codigo, nombre completo autocompletado y DNI.
- `Horas Jornada` admite como maximo 8 horas.
- La web envia los datos al Apps Script.
- Apps Script crea o usa la hoja mensual `YYYY-MM`.
- Si hay varios operarios, inserta una fila por operario.
- Cada fila queda con `Estado Procesado = Pendiente`.

## Campos guardados

Cada hoja mensual se crea con estos encabezados:

```text
Timestamp Guardado
Mes
Fecha Trabajo
Cliente
Instalación
Código Operario
Operario
DNI Operario
Tipo Servicio
Jefe de Obra
Año OT
OT
Hora Entrada
Hora Salida
Horas Jornada
Horas Adicionales
Tiempo Comida
Almuerzo
Comida
Total Horas Declaradas
Total Horas Reales
Descripción Trabajo
Observaciones
KM
Prima
Busca
Nocturnidad
Firma Técnico
Firma Cliente
Estado Procesado
Fecha Procesado
PDF Generado
Error Procesamiento
```

La columna `Jefe de Obra` guarda el codigo del jefe seleccionado en el desplegable, por ejemplo `EP` para Jessica Parra.
La columna `Firma Cliente` guarda el DNI introducido en el campo Firma del Cliente. No es obligatorio.
La columna `Firma Técnico` queda vacia porque ahora cada tecnico introduce su DNI. Se mantiene para que un agente posterior pueda usarla si hace falta.

## Preparacion para agentes

Un agente posterior podra:

- Leer filas con `Estado Procesado = Pendiente`.
- Generar PDF.
- Guardar enlace en `PDF Generado`.
- Cambiar `Estado Procesado` a `Procesado`.
- Rellenar `Fecha Procesado`.
- Escribir errores en `Error Procesamiento`.

## Desarrollo local opcional

Puedes abrir `public/index.html` directamente en el navegador, pero para probarlo parecido a GitHub Pages puedes usar cualquier servidor estatico.

Con Node instalado:

```bash
npx serve public
```

Luego abre la URL que indique el comando.
