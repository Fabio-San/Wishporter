<p align="center">
  <img src="assets/icon.png" alt="Wishporter" width="140">
</p>

<h1 align="center">Wishporter</h1>

<p align="center"><em>Convertitore da cronologia desideri di Genshin Impact a Paimon.moe</em></p>

<p align="center">
  <a href="https://github.com/Fabio-San/Wishporter/actions/workflows/ci.yml"><img src="https://github.com/Fabio-San/Wishporter/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/python-3.9%2B-3776AB?logo=python&logoColor=white" alt="Python 3.9+">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey" alt="Piattaforme">
  <img src="https://img.shields.io/badge/languages-7-yellow" alt="7 lingue">
  <img src="https://img.shields.io/badge/translations-welcome-brightgreen" alt="Traduzioni benvenute">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="Licenza MIT">
</p>

<p align="center"><a href="README.md">Read in English</a></p>

Wishporter trasforma l'export ufficiale della cronologia desideri di Genshin
Impact (`.xlsx` o `.csv`) in un file Excel importabile su
[Paimon.moe](https://paimon.moe), completando nomi dei banner, tipo di oggetto,
rarità e informazioni sul pity.

- Launcher per Windows e Linux con lo stesso comportamento
- Controlla Python e `openpyxl` e chiede il permesso prima di installare
- Installa solo in una `.venv` locale, mai a livello di sistema
- Interfaccia in inglese, italiano, francese, tedesco, spagnolo, portoghese e russo
- Scarica i dati di Paimon.moe una volta, poi funziona offline
- Nessun login, nessuna telemetria, nessun dato delle tue pull lascia il PC

## Perché esiste Wishporter

Nel 2024 alcuni giocatori hanno perso l'accesso alla cronologia desideri in
gioco. Il supporto di HoYoverse può fornire una copia della cronologia su
richiesta; i passaggi esatti per chiederla sono descritti in questa
discussione su Reddit:
https://www.reddit.com/r/Genshin_Impact/comments/1wz77km/i_got_my_entire_wish_history_from_hoyo_since/

Il file che ricevi dal supporto **non** è in un formato importabile da
Paimon.moe, e convertire migliaia di pull a mano non è realistico.
Wishporter automatizza questo passaggio: gli dai il file ottenuto dal supporto
HoYo e ottieni un file Excel pronto per Paimon.moe.

> Se hai ricevuto l'export tramite un altro canale, Wishporter funziona lo
> stesso, purché il file abbia le cinque colonne `No.`, `UID`, `Wish type`,
> `Wish award`, `Wish time`.

## Avvio rapido

### Windows

1. Scarica lo ZIP da [Releases](https://github.com/Fabio-San/Wishporter/releases)
   ed estrailo dove preferisci.
2. Fai doppio clic su **`run.bat`**.
3. Trascina nella finestra il file esportato dal gioco, oppure scrivine il
   percorso/nome.

Se Python manca, `run.bat` spiega a cosa serve e propone l'installazione con
`winget` (solo dopo conferma). In alternativa apre la pagina ufficiale di
download di Python.

### Linux / macOS

```bash
bash run.sh
```

Lo ZIP può perdere il permesso di esecuzione, quindi `bash run.sh` è il modo
consigliato. Linux è la piattaforma testata; macOS dovrebbe funzionare allo
stesso modo e il feedback è benvenuto.

Al primo avvio il launcher controlla l'ambiente e chiede il permesso prima di
creare una `.venv` locale e installare `openpyxl` con pip. Non viene installato
nulla a livello globale e `sudo` non viene mai usato per i pacchetti Python.

## Come ottenere l'export dal gioco

In Genshin Impact apri **Cronologia desideri** e usa il pulsante **Esporta**. Il
gioco crea un file `.xlsx` (va bene anche un `.csv` con le stesse colonne).
Tieni il file dove vuoi: Wishporter lo legge soltanto.

## Uso

Modo interattivo, il più semplice:

```text
run.bat
```

oppure

```bash
bash run.sh
```

Passando direttamente il file:

```bat
run.bat "C:\Users\tuonome\Downloads\wish_history.xlsx"
```

```bash
bash run.sh ~/Downloads/wish_history.xlsx
```

Per chi preferisce la riga di comando:

```bash
python convert.py history.xlsx
python convert.py history.xlsx -o mia_cronologia_paimonmoe.xlsx
```

### Opzioni

| Opzione | Descrizione |
|---|---|
| `source` | File `.xlsx` o `.csv` di partenza. Se omesso viene richiesto. |
| `-o`, `--output` | File di output. Predefinito: `<sorgente>_paimonmoe.xlsx` accanto alla sorgente. |
| `--offline` | Non scaricare dati da Paimon.moe; usa la cache locale. |
| `--reference FILE` | Usa un export Paimon.moe esistente come fonte dei banner. |
| `--data-dir DIR` | Legge i file JS di Paimon.moe da una cartella (sola lettura). |
| `--server NOME` | `Asia`, `China`, `America` o `Europe`. Predefinito: dedotto dall'UID. |
| `--lang CODICE` | `en`, `it`, `fr`, `de`, `es`, `pt`, `ru`. |
| `--yes` | Sovrascrive l'output e accetta le domande di setup. |
| `--check` | Solo controllo dell'ambiente (launcher). |
| `--debug` | Mostra il traceback completo in caso di errore. |
| `--version` | Mostra la versione ed esce. |

Se il file di output esiste già, Wishporter chiede prima di sovrascriverlo; se
rifiuti, scrive un nuovo file con data e ora nel nome.

## Input e output

L'export del gioco ha cinque colonne: `No.`, `UID`, `Wish type`, `Wish award`,
`Wish time`. La riga di intestazione viene saltata automaticamente. Qualsiasi
UID, server e numero di pull è supportato, purché il file provenga dall'export
ufficiale. Per la v1 i nomi degli oggetti devono essere in inglese (lingua
predefinita del gioco); i nomi localizzati sono nella roadmap.

Il file generato contiene:

- `Character Event`, `Weapon Event`, `Standard`, `Beginners' Wish`
- `Banner List` con tutti i banner noti e le relative date di inizio/fine
- `Information` con il marcatore di export di Paimon.moe

Paimon.moe legge le colonne **A (Type)**, **B (Name)**, **C (Time)** e
**I (Part)**; le altre colonne sono informative.

## Importare su Paimon.moe

1. Apri [paimon.moe](https://paimon.moe) e vai su **Wish History**.
2. Scegli **Import** e seleziona il file `.xlsx` generato.
3. Controlla i contatori e salva.

> **Importante:** Paimon.moe unisce gli import invece di sostituirli. Aggiunge
> solo le pull più nuove della più recente e più vecchie della più vecchia già
> presenti. Per un ripristino completo, svuota prima i dati attuali di
> Paimon.moe (esporta un backup se ti serve), poi importa.

## Lingue

Sono incluse inglese, italiano, francese, tedesco, spagnolo, portoghese e
russo. La lingua viene rilevata dal sistema operativo; puoi forzarla con
`--lang` o con la variabile d'ambiente `PAIMON_LANG`. Le chiavi mancanti
ricadono sull'inglese.

Vuoi aggiungere una lingua? Leggi [`locales/README.md`](locales/README.md). I
cataloghi sono piccoli e le traduzioni della community sono molto benvenute.

## Le traduzioni sono aperte a tutti, gratuitamente

Wishporter è tradotto dalla community e **chiunque può aggiungere una nuova
lingua senza costi**: nessun account, nessuna quota, nessun accordo di
contributo.

1. Fai un fork del repository e copia `locales/en.json` in `locales/<codice>.json`.
2. Traduci i valori (mantieni le chiavi e i `{segnaposto}`).
3. Aggiungi il codice a `SUPPORTED` in `i18n.py`.
4. Apri una pull request.

Se non usi Git, apri una issue con la tua traduzione e la aggiungiamo noi.
Vedi [`locales/README.md`](locales/README.md) per la guida completa.

## Privacy

Wishporter non chiede account HoYoverse, password o cookie. Legge il tuo export
locale e scrive un file Excel locale. Non c'è telemetria e nessun dato delle
pull viene caricato online.

Al primo avvio online scarica quattro file pubblici di metadati (personaggi,
armi, banner, banner doppi) dal
[repository di Paimon.moe](https://github.com/MadeBaruna/paimon-moe) e li salva
in `cache/`. Da quel momento funziona offline. Usa `--offline` per vietare
qualsiasi accesso alla rete, oppure `--reference` per affidarti a un export
Paimon.moe esistente.

## Risoluzione problemi

| Problema | Soluzione |
|---|---|
| Python non trovato | Lascia che `run.bat` / `run.sh` propongano l'installazione dal gestore pacchetti, oppure installa Python 3.9+ da [python.org](https://www.python.org/downloads/). Su Windows seleziona **Add python.exe to PATH**. |
| Manca `openpyxl` | Avvia lo strumento con `run.bat` / `run.sh` e accetta l'installazione locale. |
| `externally-managed-environment` su Debian/Ubuntu | Installa il pacchetto venv: `sudo apt install python3-venv`, poi riprova. |
| Avviso SmartScreen / antivirus | Wishporter è uno script Python leggibile, non un binario compilato. Scegli **Ulteriori informazioni → Esegui comunque**, oppure controlla il codice prima di avviarlo. |
| File non trovato | Trascina il file nella finestra o incolla il percorso completo. Su Windows le virgolette vengono gestite automaticamente. |
| Oggetti sconosciuti | Esegui una volta online per aggiornare il database. Se l'oggetto resta sconosciuto, apri una issue indicando il nome (senza UID). |
| Nessun banner trovato | Esegui online per aggiornare la cache, oppure passa `--reference` con un export Paimon.moe recente. Controlla `--server` se il tuo UID è particolare. |
| L'import sembra ignorato | Paimon.moe è append-only; svuota i dati attuali prima di un import completo. |
| Cache vecchia | Elimina la cartella `cache/` e riavvia online. |

## Sviluppo

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

I test usano dati sintetici e metadati pubblici di esempio; non serve nessun
dato personale. Lo ZIP di release si crea con:

```bash
python scripts/package.py
```

Struttura del progetto:

```text
convert.py          logica di conversione e CLI
run.py              controllo ambiente, venv locale, avvio
run.bat / run.sh    wrapper sottili per Windows / Linux
i18n.py             rilevamento lingua e lookup dei cataloghi
version.py          unica fonte della versione
locales/            traduzioni dell'interfaccia
tests/              fixture sintetiche e test unitari
scripts/package.py  generatore dello ZIP di release
```

## Roadmap

Sono previsti import UIGF JSON, auto-rilevamento delle colonne CSV, nomi degli
oggetti localizzati e una GUI opzionale. Vedi [`ROADMAP.md`](ROADMAP.md).

## Licenza

MIT. Vedi [`LICENSE`](LICENSE) e [`NOTICE`](NOTICE) per l'attribuzione a
Paimon.moe.

Wishporter è uno strumento amatoriale non ufficiale. Non è affiliato,
approvato o sponsorizzato da HoYoverse o Paimon.moe. Genshin Impact e tutti i
nomi e gli asset correlati sono marchi o marchi registrati di HoYoverse.
