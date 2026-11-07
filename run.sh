#!/usr/bin/env bash
# Friendly launcher for Linux/macOS. Usage: bash run.sh [options] [file]

set -u
cd "$(dirname "$0")"

PYTHON=""
for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
        if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
            PYTHON="$candidate"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo
    echo "  Python 3.9 or newer is required, but it was not found."
    echo "  Serve Python 3.9 o superiore, ma non e' stato trovato."
    echo
    echo "  Python is the engine that runs this converter. It is free and open source."
    echo "  Python e' il motore che esegue il convertitore. E' gratuito e open source."
    echo

    if command -v apt-get >/dev/null 2>&1; then
        PM="apt"
    elif command -v dnf >/dev/null 2>&1; then
        PM="dnf"
    elif command -v pacman >/dev/null 2>&1; then
        PM="pacman"
    elif command -v zypper >/dev/null 2>&1; then
        PM="zypper"
    elif command -v apk >/dev/null 2>&1; then
        PM="apk"
    else
        PM=""
    fi

    if [ -n "$PM" ]; then
        printf 'Install Python automatically with %s? [y/N] / Installare Python automaticamente con %s? [s/N]: ' "$PM" "$PM"
        read -r ANSWER || ANSWER=""
        case "$ANSWER" in
            y|Y|s|S)
                SUDO=""
                if [ "$(id -u)" -ne 0 ]; then
                    if command -v sudo >/dev/null 2>&1; then
                        SUDO="sudo"
                    else
                        echo "sudo not found. Run the command below as root."
                        SUDO=""
                    fi
                fi
                case "$PM" in
                    apt)    $SUDO apt-get update && $SUDO apt-get install -y python3 python3-venv python3-pip ;;
                    dnf)    $SUDO dnf install -y python3 python3-pip ;;
                    pacman) $SUDO pacman -S --needed --noconfirm python ;;
                    zypper) $SUDO zypper install -y python3 python3-pip ;;
                    apk)    $SUDO apk add python3 py3-pip ;;
                esac
                if [ $? -eq 0 ]; then
                    echo
                    echo "Python installed. Run ./run.sh again."
                    echo "Python installato. Avvia di nuovo ./run.sh."
                    exit 0
                fi
                echo
                echo "Automatic installation failed. Please install Python manually."
                echo "Installazione automatica non riuscita. Installa Python manualmente."
                ;;
        esac
    fi

    echo "  Download: https://www.python.org/downloads/"
    echo "  Debian/Ubuntu: sudo apt install python3 python3-venv"
    echo
    exit 1
fi

exec "$PYTHON" run.py "$@"
