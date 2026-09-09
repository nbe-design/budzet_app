# Budžet — specifikacija aplikacije

> Master dokument. Sadrži sve odluke i podatke dogovorene u razgovoru s Claudeom.
> Cilj: moći nastaviti gradnju na bilo kojem računalu bez ponavljanja.
> Zadnje ažurirano: 2026-09-09

---

## 1. Što je ovo

Osobna aplikacija za planiranje i praćenje mjesečnog budžeta. Zamjena za Excel tablicu
na mobitelu. Jedan korisnik (Nikola), koristi se s 2–3 računala **i mobitela**, nikad
istovremeno na dva uređaja.

### Zašto PWA (a ne desktop tkinter ni native Android)

- Troškovi se unose i dok si vani → mobitel mora raditi.
- PWA = jedna baza koda za mobitel + sva računala. Instalira se "Add to Home Screen",
  radi offline (service worker), izgleda kao app, nema trgovine aplikacija.
- **Podaci = jedan JSON u Nikolinom osobnom (plaćenom) Google Driveu.** Nema servera za
  održavati, podaci ostaju kod korisnika. App koristi `drive.file` scope → vidi samo
  datoteke koje je sam napravio, ne ostatak Drivea.
- Hosting: statične datoteke na besplatnom servisu (GitHub Pages / Cloudflare Pages).
- Trošak: 0 €/mj.

### Poznata ograničenja (prihvaćena)

- **Podsjetnici su samo u aplikaciji.** Nema push obavijesti kad je app zatvoren
  (Android web push bez servera je nepouzdan). Dashboard pri otvaranju pokaže što
  dospijeva i je li plaća unesena.
- **Konflikt kod istovremenog uređivanja** — rijetko (jedan korisnik). Ublažavanje:
  atomarno spremanje, timestampirani backupi, Google Drive čuva povijest verzija,
  provjera "je li datoteka novija" pri otvaranju.
- Ne koristi se firmin OneDrive — IT tenanta može pristupiti sadržaju, i gubi se
  pristup pri odlasku iz firme.

---

## 2. Status gradnje

| Dio | Status |
|---|---|
| Specifikacija + podaci | ✅ gotovo (ovaj dokument + `data-seed.json`) |
| Scaffold (index.html, app.js, manifest, sw) | 🚧 započeto |
| Data model + izračuni | ⬜ |
| Dashboard | ⬜ |
| Ekran "Mjesec" | ⬜ |
| Ekran "Lonci" | ⬜ |
| Ekran "Analiza" (grafovi) | ⬜ |
| Ekran "Postavke" | ⬜ |
| Unos honorara (split u ulaganja) | ⬜ |
| Izvoz CSV/Excel | ⬜ |
| Google Drive sync | ⬜ (postavlja se zajedno kasnije) |
| PWA ikone | ⬜ |

**Sljedeći korak:** dovršiti scaffold → data model → dashboard → ostali ekrani.
Testira se lokalno u pregledniku. Kad v1 radi, zajedno se postavi Google Drive OAuth
(~15 min) i hosting.

---

## 3. Arhitektura

Bez build koraka. Obične datoteke, `<script>` tagovi po redu.

```
budzet/
  index.html                # shell + navigacija
  app.css                   # stil
  app.js                    # sve: model, izračuni, render, ekrani, grafovi (hand-rolled SVG)
  data-seed.json            # Nikolini stvarni početni podaci (učitava se pri prvom pokretanju)
  manifest.webmanifest      # PWA manifest
  sw.js                     # service worker (offline cache)
  icons/                    # 192 + 512 PNG (generirati Pillowom)
  SPEC.md                   # ovaj dokument
  README.md
```

- **Pohrana v1:** `localStorage` ključ `budzet_data_v1`. Import/export JSON gumb.
- **Pohrana v2:** apstrakcija `Store` — `load()` / `save()` — zamijeni localStorage
  implementacijom koja čita/piše jedan `budzet.json` u Google Driveu (Drive JS API,
  `drive.file` scope, "Sign in with Google" jednom po uređaju).
- Grafovi: ručno crtani SVG, bez vanjskih biblioteka (offline-first).
- Novac: rad u centima (integer) gdje god moguće da se izbjegne float greška; prikaz s 2 decimale.

---

## 4. Podatkovni model (JSON schema)

```jsonc
{
  "version": 1,
  "meta": { "created": "ISO", "lastModified": "ISO", "deviceId": "string" },

  "settings": {
    "currency": "EUR",
    "startMonth": "2026-09",        // prvi praćeni mjesec
    "startingBalance": 0            // stanje računa na početku praćenja (u centima)
  },

  "income": {
    "recurring": [
      { "id": "...", "name": "Plaća", "amount": 190000, "day": 11 },
      { "id": "...", "name": "Najam", "amount": 70000,  "day": 1  }
    ]
    // honorari se ne planiraju — unose se ad hoc po mjesecu (vidi months[].honorari)
  },

  "fixedCosts": [
    // day = dan u mjesecu dospijeća; startMonth/endMonth = "YYYY-MM" ili null
    // jednokratni trošak: startMonth === endMonth
    { "id": "...", "name": "Kredit", "amount": 96559, "day": 1,
      "startMonth": null, "endMonth": null }
  ],

  "variableCategories": [
    { "id": "...", "name": "Hrana", "plan": 30000 }   // plan = planirani mjesečni iznos
  ],

  "pots": [
    // type "sinking": nakuplja se, pa račun povuče iz lonca (dueMonth 1-12)
    // type "savings": samo raste (ulaganja) — nema dueMonth, nema povlačenja
    { "id": "...", "name": "Servis auto", "type": "sinking",
      "monthly": 3333, "targetAmount": 40000, "dueMonth": 5, "startMonth": "2026-09" },
    { "id": "...", "name": "Ulaganja (T212)", "type": "savings",
      "monthly": 22500, "startMonth": "2026-09" }
  ],

  "months": {
    "2026-09": {
      "opened": true,
      "closed": false,
      "openingBalance": 0,          // = zatvarajuće stanje prošlog mjeseca (ili settings.startingBalance)

      "income": [
        { "refId": "...", "name": "Plaća", "planned": 190000,
          "actual": null, "received": false, "date": null }
      ],
      "honorari": [
        { "id": "...", "gross": 50000, "toInvest": 30000, "toAccount": 20000,
          "date": "ISO", "note": "" }
      ],

      "fixed": [
        { "refId": "...", "name": "Kredit", "planned": 96559,
          "actual": null, "paid": false, "date": null }
      ],

      "variable": [
        { "catId": "...", "name": "Hrana", "plan": 30000,
          "entries": [ { "id": "...", "amount": 1234, "note": "Konzum", "date": "ISO" } ] }
      ],

      "potContribs": [
        { "potId": "...", "name": "Servis auto", "planned": 3333,
          "actual": null, "paid": false }
      ],
      "potSpends": [
        // kad sinking račun dospije i plati se iz lonca
        { "id": "...", "potId": "...", "name": "Servis auto",
          "amount": 39000, "note": "", "date": "ISO" }
      ],

      "adjustments": [
        { "id": "...", "amount": -500, "note": "zaokruženje / ispravak" }
      ]
    }
  }
}
```

---

## 5. Pravila izračuna (VAŽNO — suptilno)

Dogovoreni model lonaca (odluka #2):
**"Sinking fund umanjuje prikazani ostatak odmah; rezerva se vidi kao lonac; veliki
račun se vuče iz lonca."**

### Stanje računa (pravi novac u banci)

`accountBalance` se mijenja s:
- `+` primljeni prihodi (income.actual gdje received) + honorari.toAccount
- `−` plaćeni fiksni troškovi (fixed.actual gdje paid)
- `−` potrošeno u varijabilnim kategorijama (Σ entries)
- `−` **uplate u lonac tipa `savings`** (ulaganja stvarno odlazi brokeru)
- `−` **plaćeni sinking računi** (potSpends — novac stvarno odlazi)
- `±` adjustments

`accountBalance` se **NE mijenja** mjesečnim doprinosom u sinking lonac
(taj novac fizički ostaje na računu, samo je namjenski rezerviran).

### Stanje lonca

- `sinking` lonac: `Σ potContribs.actual (paid) − Σ potSpends.amount`
- `savings` lonac (ulaganja): `Σ potContribs.actual (paid)` — raste zauvijek, nikad se ne povlači

### Slobodno za potrošiti (glavni broj na dashboardu)

```
slobodno = accountBalance − Σ (stanje svih sinking lonaca)
```

(ulaganja se ne oduzima jer je novac već otišao)

### Mjesečni "ostatak" (broj iz Nikoline tablice) = zatvarajuće stanje

```
closingBalance(mj) = openingBalance
                   + Σ income.actual + Σ honorari.toAccount
                   − Σ fixed.actual
                   − Σ variable.entries
                   − Σ potContribs.actual za savings lonce
                   − Σ potSpends (sinking računi plaćeni ovaj mjesec)
```

Kad se mjesec zatvori, `closingBalance` postaje `openingBalance` idućeg mjeseca.

### Projekcije (dashboard)

- **Dnevni budžet** = (preostali planirani varijabilni diskrecijski iznos ovog mjeseca) / (preostali dani u mjesecu)
- **Projekcija kraja mjeseca** = slobodno − (svi preostali planirani odljevi ovog mjeseca: neplaćeni fiksni + preostali plan varijabilnih + neplaćeni doprinosi lonaca + sinking računi koji dospijevaju ovaj mjesec)
- **Upozorenje na manjak lonca**: za svaki sinking lonac, projicirano stanje na `dueMonth` = trenutno stanje + (mjeseci do dueMonth) × monthly. Ako < targetAmount → crveno, prikaži manjak.

### Otvaranje novog mjeseca (ručno)

Kad korisnik klikne "Otvori [mjesec]":
1. `openingBalance` = `closingBalance` prošlog mjeseca.
2. Generiraj `income` iz `settings.income.recurring`.
3. Generiraj `fixed` iz `fixedCosts` gdje je mjesec unutar [startMonth, endMonth].
4. Generiraj `potContribs` iz `pots` gdje je mjesec >= pot.startMonth.
5. Generiraj `variable` iz `variableCategories`; **plan se kopira iz prošlog mjeseca**,
   a ako postoji ≥3 mjeseca povijesti → ponudi prijedlog = prosjek zadnjih 3–6 mj.
6. Ako sinking lonac ima `dueMonth` == ovaj mjesec → dodaj podsjetnik/predložak `potSpend`.

### Promjena fiksnog troška

Kad korisnik mijenja iznos fiksnog troška, pitati: **"samo ovaj mjesec"** (uredi
`months[m].fixed[].planned`) ili **"od sad nadalje"** (uredi `fixedCosts[].amount`).

### Unos honorara

Modal: "Bruto iznos honorara: ___ €". Zatim: "Koliko ide u Ulaganja (T212)? ___ €".
Ostatak → `toAccount` (povećava stanje računa). Zapiši u `months[m].honorari`.
Doprinos u ulaganja pot se knjiži kao `potContrib` (izvanredni, povrh mjesečnih 225).

---

## 6. Nikolini stvarni podaci (seed)

> Puni strukturirani oblik u `data-seed.json`. Ovdje čitljivi pregled.

### Prihodi (mjesečni)

| Stavka | Iznos | Dan |
|---|---|---|
| Plaća | +1.900 € | ~11. |
| Najam | +700 € | ~1. (pretpostavka) |
| Honorari | neredovno, promjenjiv iznos | ad hoc — pita split u ulaganja, ostatak na račun |

### Fiksni troškovi

| Stavka | €/mj | Dan | Kraj |
|---|---|---|---|
| Kredit | 965,59 | 1. | — |
| Osiguranje kredita | 60,32 | 11. | — |
| Javni prijevoz | 40,00 | 11. | — |
| Vrtić 1 | 40,00 | 1. (pretp.) | — |
| Vrtić 2 | 40,00 | 1. (pretp.) | — |
| Teretana | 25,60 | 1. | — |
| Dopunsko zdravstveno | 15,50 | 13. | — |
| Bon | 10,88 | 11. | — |
| Claude (pretplata) | 22,50 | 11. | — |
| Rata banka 1 | 16,67 | ~11. | **zadnja uplata 2027-08** |
| Rata banka 2 | 55,56 | ~7. | **zadnja uplata 2027-03** |
| **Kasko (pola, jednokratno)** | **250,00** | ~15. | **samo 2026-11** |

*Napomena: rate su obje aktivne sada (rujan 2026). Iznos rate 2 varira par centi po
mjesecu — nebitno. Kasko se ove godine dijeli pola-pola sa suprugom → jednokratni
fiksni trošak 250 € u studenom; lonac "Kasko" kreće tek 2026-12 za idući ciklus.*

**Stalno fiksno ukupno (bez rata i kaska): 1.220,39 €/mj**

### Varijabilne kategorije (mjesečni plan)

| Kategorija | Plan €/mj | Dan |
|---|---|---|
| Hrana | 300 | ~11. |
| Život | 200 | ~11. |
| Gorivo | 150 | varijabilno |
| Porez na najam | 58,80 | varijabilno |

*(Porez na najam je premješten iz fiksnih u varijabilne na Nikolin zahtjev.)*

**Varijabilni plan ukupno: 708,80 €/mj**

### Lonci

| Lonac | Tip | €/mj | Cilj/god | Dospijeva | Lonac kreće |
|---|---|---|---|---|---|
| Ulaganja (T212) | savings | 225,00 | — (raste zauvijek) | — | 2026-09 |
| More | sinking | 50,00 | 600 | **srpanj** | 2026-09 |
| Kasko | sinking | 41,67 | ~500 | studeni | **2026-12** |
| Servis auto | sinking | 33,33 | ~400 | svibanj | 2026-09 |
| Registracija + osiguranje auto | sinking | 33,33 | ~400 | srpanj | 2026-09 |
| Osiguranje doma | sinking | 5,01 | 60,13 | lipanj | 2026-09 |
| Osiguranje od nezgode | sinking | 0,61 | 7,30 | srpanj | 2026-09 |

**Mjesečna rezervacija u lonce:**
- rujan–studeni 2026: ~347 €/mj (bez kaska)
- od prosinca 2026: ~389 €/mj (s kaskom)

*Honorari se ulijevaju u lonac "Ulaganja (T212)" povrh mjesečnih 225.*

### Tipičan mjesec

| | Iznos |
|---|---|
| Prihodi (plaća + najam) | +2.600 € |
| Fiksni (rujan 2026, obje rate) | −1.292,62 € |
| Rezervacija u lonce | −347,28 € |
| Varijabilni plan | −708,80 € |
| **Ostatak** | **~251 € + honorari** |

Od svibnja 2027 (rata 2 otpala) i rujna 2027 (rata 1 otpala): ~265–282 € + honorari.

---

## 7. Poznati problemi — prva godina

Lonci kreću od **0** u rujnu 2026 (dogovoreno). Do prvih dospijeća neće biti puni:

| Račun | Dospijeva | Ušteđeno do tada | Treba | Manjak |
|---|---|---|---|---|
| Kasko | ~~stu 2026~~ → riješeno jednokratnim 250 € (pola-pola) | | | — |
| Servis auto | svi 2027 | ~267 € (8 mj) | ~400 € | ~133 € |
| Osiguranje doma | lip 2027 | ~45 € (9 mj) | 60 € | ~15 € |
| Registracija+osig. | srp 2027 | ~333 € (10 mj) | ~400 € | ~67 € |
| More | srp 2027 | ~500 € (10 mj) | 600 € | ~100 € |
| Osiguranje nezgode | srp 2027 | ~6 € | 7,30 € | ~1 € |

**Manjkovi se pokrivaju iz mjesečnog ostatka kad račun stigne** (odluka: opcija a).
App to samo jasno prikazuje unaprijed.

**Studeni 2026 je najtjesnji mjesec:** zbog 250 € kaska ostatak pada na ~1 € (prije
honorara). Ventil: taj mjesec uplatiti manje u ulaganja, ili pokriti honorarom.

**Srpanj 2027 je težak:** registracija + nezgoda + more dospijevaju istovremeno;
lonci pokrivaju većinu, ostane ~170 € manjka raspoređeno.

---

## 8. Odluke (referenca)

| # | Pitanje | Odluka |
|---|---|---|
| 1 | Podsjetnici | Bez push obavijesti. Dashboard pri otvaranju pokaže dospijeća + "plaća nije unesena". |
| 2 | Budžetski mjesec | = kalendarski. Prošli mjeseci uredivi ali označeni "zaključen". Novi mjesec se otvara **ručno**. |
| 3 | Sinking fund | Umanjuje prikazani ostatak odmah; rezerva vidljiva kao "lonac"; veliki račun se vuče iz lonca. |
| 4 | Plan vs. ostvareno | Po kategoriji po mjesecu. Plan se kopira iz prošlog mjeseca uz prijedlog po prosjeku. |
| 5 | Fiksni kad se promijene | App pita: "samo ovaj mjesec" ili "od sad nadalje". |
| 6 | Kategorije | Fiksna lista u postavkama, dopunjiva. Plosnata + neobavezni tag (ne pune potkategorije). |
| 7 | Fiksni trošak model | Iznos + početni mjesec + trajanje/završni mjesec. Nova rata = nova stavka s datumima. |
| 8 | Honorari | Idu u Ulaganja (T212). Pri unosu pitati koliko od honorara ide u ulaganja; ostatak na stanje računa. |
| 9 | Ulaganja | Fiksni mjesečni ulog 225 € (može se uplatiti manje neki mjesec). Lonac vodi **ukupni zbroj kroz vrijeme**. |
| 10 | Lonci početno stanje | Svi kreću od 0 (osim kaska koji kreće 2026-12). |
| 11 | Dugovi prema drugima | Nema (osim kredita i bankovnih rata — modelirani kao fiksni troškovi). |
| 12 | Ciljevi štednje | Izbačeno iz v1 (sinking + ulaganja djelomično pokrivaju). |
| 13 | Plaćeno / nije plaćeno | Kvačica po stavci (fiksni, doprinosi lonaca, prihodi). |

---

## 9. Funkcije v1 (opseg)

- **Stanje računa** koje se prenosi iz mjeseca u mjesec (Nikolin "ostatak").
- **Fiksni troškovi** s iznosom + trajanjem otplate → auto-generiranje svaki mjesec,
  auto-gašenje na kraju. Dodavanje nove rate = nova stavka. Podrška za jednokratni trošak.
- **Lonci**: 6 sinking + 1 savings (ulaganja). Rezervacija umanjuje slobodni novac,
  sinking račun se vuče iz lonca, upozorenje na manjak prije dospijeća.
- **Varijabilne kategorije** s planom po mjesecu (kopira se iz prošlog + prijedlog po prosjeku).
  Inline unos pojedinačnih troškova (Enter-za-dodati).
- **Plaćeno / nije plaćeno** kvačica po stavci.
- **Unos honorara** → pita split u ulaganja, ostatak na račun.
- **Dashboard**: slobodno za potrošiti • dnevni budžet do kraja mjeseca • projekcija
  kraja mjeseca • što dospijeva ovaj tjedan • je li plaća unesena • stanja lonaca s
  upozorenjima na manjak.
- **Analiza**: potrošnja po mjesecima (stupčasti graf) • prosjek po kategoriji •
  top 5 stavki mjeseca • plan vs. ostvareno kumulativno kroz godinu.
- **Ručno otvaranje novog mjeseca**; prošli uredivi, označeni "zaključen".
- **Izvoz** CSV/Excel + izvoz/uvoz cijelog JSON-a.
- **Podaci**: v1 localStorage; v2 jedan JSON u Google Driveu (atomarno + timestampirani backupi).

### Izvan v1 (moguće kasnije)

- Google Drive sync (postavlja se zajedno nakon što v1 radi).
- Prave push obavijesti (tray app / scheduled task na jednom računalu).
- Ciljevi štednje s rokom.
- Fotografija računa uz trošak.
- Tagovi koji presijecaju kategorije.

---

## 10. Google Drive sync — bilješke za kasnije

1. Google Cloud Console → novi projekt (besplatno).
2. OAuth consent screen: External, dodati Nikolin mail kao test usera (ili objaviti —
   `drive.file` je "ne-osjetljiv" scope pa verifikacija nije nužna za produkciju).
3. Credentials → OAuth client ID, tip "Web application", dodati origin hostinga
   (npr. `https://nikola.github.io`) u Authorized JavaScript origins.
4. U aplikaciji: Google Identity Services (GIS) token client, scope
   `https://www.googleapis.com/auth/drive.file`.
5. Datoteka `budzet.json` u dediciranom app folderu (ili u korijenu Drivea).
6. `Store.load()` → traži datoteku po imenu, GET media. `Store.save()` → PATCH media,
   uz provjeru `modifiedTime` (ako je novije nego zadnje viđeno → upozori na konflikt).
7. Prije svakog spremanja: kopija u `budzet-backup-YYYYMMDD-HHMMSS.json` (zadrži zadnjih ~20).

---

## 11. Nastavak na drugom računalu

Cijela mapa `budzet/` je samodostatna. Kopiraj je na drugo računalo (ili kroz Git /
Drive) i nastavi. `SPEC.md` + `data-seed.json` sadrže sve odluke i podatke.
Reci Claudeu: *"nastavljam gradnju budžet aplikacije, pročitaj SPEC.md"*.
