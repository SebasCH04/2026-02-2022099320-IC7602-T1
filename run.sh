#!/bin/bash
echo "Iniciando Autrum (Analizador de Espectros)..."
echo "Verificando si Node.js esta instalado..."

if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js no esta instalado. Por favor de instalar desde https://nodejs.org/"
        exit 1
    fi

echo "Iniciando servidor local en el puerto 8080..."
echo "Presione Ctrl+C para detener el servidor."
npx -y http-server . -p 8080 -c-1 -o
