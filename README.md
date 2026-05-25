# Partes digitales

Aplicacion web local para rellenar partes de trabajo, guardarlos en el equipo, imprimirlos en PDF y exportar un resumen Excel.

## Arrancar

Desde PowerShell, en esta carpeta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Start-Partes.ps1"
```

Despues abre:

```text
http://localhost:3000
```

Para usarla desde otros dispositivos, el equipo que ejecuta el servidor debe estar encendido y conectado a la misma red. El servidor muestra la direccion de red al arrancar.

## Datos

Los partes se guardan en `data/partes.json`. Ese archivo no debe subirse a GitHub porque puede contener datos de clientes y firmas.

Si `data/partes.json` no existe, la app lo crea automaticamente al arrancar.
