# Budžet — specifikacija aplikacije

> Master dokument. Sadrži sve odluke i podatke dogovorene u razgovoru s Claudeom.
> Cilj: moći nastaviti gradnju na bilo kojem računalu bez ponavljanja.
> Zadnje ažurirano: 2026-09-10

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
| Scaffold (index.html, app.js, manifest, sw) | ✅ gotovo |
| Data model + izračuni | ✅ gotovo |
| Dashboard | ✅ gotovo |
| Ekran "Mjesec" | ✅ gotovo |
| Ekran "Lonci" | ✅ gotovo |
| Ekran "Analiza" (grafovi) | ✅ gotovo (osnovno) |
| Ekran "Postavke" | ✅ gotovo — pregled + izvoz/uvoz JSON + **uređivanje kroz UI** (dodaj/uredi/obriši za prihode, fiksne troškove, varijabilne kategorije, lonce, + uredivo početno stanje računa) |
| Unos honorara (split u ulaganja) | ✅ gotovo |
| Izvoz CSV/Excel | ✅ gotovo — CSV (ne Excel binarno, ali otvara se izravno u Excelu) |
| Google Drive sync | ✅ gotovo, potvrđeno uživo (odjeljak 10) |
| PWA ikone | ✅ gotovo (`icons/icon-192.png`, `icon-512.png`) |
| Hosting (GitHub Pages) | ✅ gotovo — https://nbe-design.github.io/budzet_app/ — potvrđeno na mobitelu |

**2026-09-10:** (a) model lonaca promijenjen (odluka #22) — uplate u lonce sad stvarno
napuštaju tekući račun (Nikola ih drži na odvojenim štednim računima), pa svi dashboard
brojevi prikazuju čisto stanje tekućeg. (b) Dashboard pojednostavljen (odluka #23):
glavna kartica je sad **"Stanje računa"** = čisti trenutni `accountBalance`, bez
projekcija; maknuti redovi "Trenutni (stvarni) ostatak" i "Predviđeno stanje prije iduće
plaće"; kartica "Projekcija" ima samo "Planirani ostatak na kraju mjeseca".

**Sljedeći korak:** sve iz v1 opsega (odjeljak 9) je gotovo. App radi na računalu i
mobitelu, na javnoj adresi, sa Google Drive sinkronizacijom, uređivanjem postavki kroz UI
i CSV izvozom. Preostaje samo (nije hitno): "Add to Home Screen" na mobitelu za pravi
app-like osjećaj, i eventualno izvan-v1 stavke iz odjeljka 9 ako ustreba.

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

- **Pohrana v1:** `localStorage` ključ `budzet_data_v1`. Import/export JSON gumb. Uvijek aktivno.
- **Pohrana v2 (Google Drive):** `Drive` objekt u `app.js` (odjeljak 10) — **uz** localStorage,
  ne umjesto njega (localStorage ostaje brzi lokalni cache za offline; Drive je sinkronizirana
  kopija). `persist()` uvijek sprema lokalno, i dodatno gura na Drive ako je korisnik prijavljen.
  Jedina vanjska ovisnost o mreži: `<script src="https://accounts.google.com/gsi/client">` u
  `index.html` (Google Identity Services) — učitava se async, app radi i bez interneta,
  samo bez Drive dijela.
- Grafovi: ručno crtani SVG, bez vanjskih biblioteka (offline-first).
- Novac: rad u centima (integer) gdje god moguće da se izbjegne float greška; prikaz s 2 decimale.
  `parseEur()` mora prvo skinuti sve točke (tisućice, hr-HR format "1.900,00") pa tek onda
  zamijeniti zarez točkom — obrnut redoslijed (ili preskakanje tog koraka) tiho krivo parsira
  sve iznose ≥1.000 € (npr. "1.850,00" → 18,50 umjesto 1.850,00). Popravljeno 2026-09-09.

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
    // recurrence: "annual" (opcionalno) = ponavlja se svake godine samo u mjesecu
    //   iz startMonth (npr. startMonth "2027-07" + recurrence "annual" → svaki srpanj od 2027)
    { "id": "...", "name": "Kredit", "amount": 96559, "day": 1,
      "startMonth": null, "endMonth": null }
  ],

  "variableCategories": [
    // analyze: true (opcionalno) = uključi u "Prosjek po kategoriji" u Analizi (odluka #18).
    // Kategorije bez tog flaga (npr. Porez na najam, Ulaganja) postoje i vode se,
    // samo se ne prikazuju u toj prosječnoj usporedbi (nisu "diskrecijsko trošenje").
    { "id": "...", "name": "Život", "plan": 20000, "analyze": true }   // plan = planirani mjesečni iznos
  ],

  "pots": [
    // type "sinking": nakuplja se, pa račun povuče iz lonca. nextDue = "YYYY-MM" sljedećeg
    //   dospijeća (ne samo mjesec 1-12 — puna godina, jer prvi ciklus može preskočiti godinu).
    //   Nakon dospijeća app automatski postavi nextDue += 12 mj. i monthly = targetAmount / 12.
    // type "savings": samo raste — nema nextDue, nema povlačenja
    { "id": "...", "name": "Servis auto", "type": "sinking",
      "monthly": 4444, "targetAmount": 40000, "nextDue": "2027-05", "startMonth": "2026-09" }
    // od odluke #22 izračun ne razlikuje "sinking" i "savings" — svaka plaćena uplata u
    // lonac jednako izlazi iz tekućeg. "savings" se trenutno ne koristi (Ulaganja T212 je
    // premješteno u variableCategories, odluka #17).
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

Dogovoreni model lonaca (odluka #22, ranije #2/#3):
**"Mjesečna uplata u lonac odmah napušta tekući račun (fizički ide na odvojeni štedni
račun); saldo lonca vidi se u kartici Lonci; veliki račun se plaća iz lonca i ne dira
tekući."**

### Stanje računa (pravi novac na TEKUĆEM računu)

`accountBalance` se mijenja s:
- `+` primljeni prihodi (income.actual gdje received) + honorari.toAccount
- `−` plaćeni fiksni troškovi (fixed.actual gdje paid)
- `−` potrošeno u varijabilnim kategorijama (Σ entries)
- `−` **plaćene uplate u lonce** (potContribs gdje paid — novac ide na odvojene štedne
  račune, vidi odluku #22)
- `±` adjustments

`accountBalance` se **NE mijenja** isplatom iz lonca (`potSpends`) — taj novac odlazi
sa štednog računa lonca, ne s tekućeg.

### Varijabilne kategorije — plan je referenca, ne "omotnica"

`plan` po kategoriji (npr. Život 200 €) **ne rezervira/ne oduzima ništa unaprijed** —
služi samo za prikaz ("potrošeno X / plan Y", dnevni budžet). `accountBalance` se
mijenja isključivo stvarno unesenim `entries`:
- Ako se na neku kategoriju potroši **više** od plana → prikazuje se prekoračenje
  (crveno, "+X"), i `accountBalance` se stvarno umanji za taj veći iznos. Ništa se
  ne posuđuje iz drugih kategorija automatski — plan je samo signal, ne ograda.
- Ako se potroši **manje** → razlika se ne "vraća" nikamo posebno, jer nikad nije
  ni bila oduzeta. Neiskorišteni dio jednostavno ostaje u `accountBalance` jer se
  samo stvarni trošak (entries) oduzima od stanja.

### Uneseni "stvarni" iznos vs. planirani (odluka #19)

Za `income` i `potContribs` korisnik može upisati stvarni iznos (npr. plaća koja je
sjela) koji se razlikuje od planiranog — čekiranje "primljeno/plaćeno" ne mora
koristiti planirani broj. `actual` polje se koristi u izračunima kad postoji
(`actual ?? planned`).

### Stanje lonca (= saldo odvojenog štednog računa tog lonca)

- `sinking` lonac: `Σ potContribs.actual (paid) − Σ potSpends.amount`
- prati se u kartici Lonci (`potBalance()`), neovisno o tekućem računu

### Glavni broj na dashboardu = "Stanje računa"

```
prikazano = accountBalance = closingBalance zadnjeg otvorenog mjeseca
```

Čisto trenutno stanje tekućeg, bez ikakvih projekcija budućih plaćanja (odluka #23).
Lonci se drže na odvojenim štednim računima pa i nisu u ovom broju. Što Nikola planira
potrošiti prati sam kroz štikliranje stavki i "Preostalo za Život".

### Mjesečni "ostatak" (broj iz Nikoline tablice) = zatvarajuće stanje

```
closingBalance(mj) = openingBalance
                   + Σ income.actual + Σ honorari.toAccount
                   − Σ fixed.actual
                   − Σ variable.entries
                   − Σ potContribs.actual (sve plaćene uplate u lonce — odluka #22)
                   ± Σ adjustments
```

(`potSpends` se ovdje NE oduzima — isplata ide sa štednog računa lonca, ne s tekućeg)

Kad se mjesec zatvori, `closingBalance` postaje `openingBalance` idućeg mjeseca.

### Projekcije (dashboard)

- **Preostalo za "Život"** = `var-zivot` kategorija: plan − stvarno potrošeno (istaknuto veliko, odluka #21 —
  Nikolina ključna dnevna kontrolna stavka, zamijenilo raniji "Dnevni budžet" koji je bio
  previše apstraktan i nesvjesno uključivao Porez na najam/Ulaganja u prosjek po danu).
- **Planirani ostatak na kraju mjeseca** (jedini red u kartici "Projekcija") = `closingPlanned`:
  openingBalance + Σ planiranih prihoda (uklj. plaću) − Σ planiranih fiksnih −
  Σ planiranog varijabilnog plana − Σ planiranih uplata u lonce. Gdje završavaš mjesec
  ako sve prođe po planu i plaća sjedne.
- **Upozorenje na manjak lonca**: za svaki sinking lonac, projicirano stanje na `nextDue` = trenutno stanje + (mjeseci do nextDue) × monthly. Ako < targetAmount → crveno, prikaži manjak.

> "Predviđeno stanje prije iduće plaće" (bivša odluka #20) **maknuto 2026-09-10** — vidi
> odluku #23. Nikola prati stvarno stanje i sam štiklira što potroši; projekcija
> pred-plaća mu nije bila korisna.

### Rata lonca — prvi ciklus vs. ustaljeni ciklus (odluka #15)

Lonci kreću od 0. Da bi prvi ciklus svejedno stigao na `targetAmount` točno do prvog
`nextDue` (bez čekanja punih 12 mjeseci), **prva rata se računa unaprijed** kao:

```
monthly (prvi ciklus) = targetAmount / (broj mjeseci od startMonth do nextDue, uključivo)
```

**Automatski reset ciklusa**: kad se generira mjesec u kojem `pot.nextDue == mjesec`
(tj. lonac dospijeva), app pored `potSpend` predloška odmah postavi za sve buduće mjesece:
- `pot.nextDue = pot.nextDue + 12 mjeseci`
- `pot.monthly = round(pot.targetAmount / 12)`

Tako se svaki lonac zasebno, čim jednom dospije, prebacuje na standardnu ratu
(cilj podijeljen na punih 12 mjeseci) za idući ciklus — bez ručnog uređivanja.
Rata za mjesec u kojem se dešava reset ostaje po staroj (prvog-ciklusa) stopi;
tek sljedeći mjesec koristi novu.

### Otvaranje novog mjeseca (ručno)

Kad korisnik klikne "Otvori [mjesec]":
1. `openingBalance` = `closingBalance` prošlog mjeseca.
2. Generiraj `income` iz `settings.income.recurring`.
3. Generiraj `fixed` iz `fixedCosts` gdje je mjesec unutar [startMonth, endMonth]
   (ako `recurrence: "annual"` → samo kad se mjesec-broj poklapa s mjesecom iz startMonth).
4. Generiraj `potContribs` iz `pots` gdje je mjesec >= pot.startMonth, po trenutnoj `pot.monthly`.
5. Generiraj `variable` iz `variableCategories`; **plan se kopira iz prošlog mjeseca**,
   a ako postoji ≥3 mjeseca povijesti → ponudi prijedlog = prosjek zadnjih 3–6 mj.
6. Ako sinking lonac ima `nextDue` == ovaj mjesec → dodaj podsjetnik/predložak `potSpend`
   i pokreni automatski reset ciklusa (gore).

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
| Plaća | +1.900 € (plan; stvaran iznos se upisuje svaki mjesec — odluka #19) | ~11. |
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
| **Osiguranje od nezgode (godišnje)** | **7,30** | ~15. (pretp.) | **jednom/god, prvi put srpanj 2027 — vidi odluku #14** |
| **Hrana** | **350,00** | 11. | — (premješteno iz varijabilnih, odluka #16) |

*Napomena: rate su obje aktivne sada (rujan 2026). Iznos rate 2 varira par centi po
mjesecu — nebitno. Kasko za 2026. dijeli se pola-pola sa suprugom → jednokratni
fiksni trošak 250 € u studenom 2026.; lonac "Kasko" (ispod) kreće već 2026-09
za ciklus koji dospijeva 2027-11. Osiguranje od nezgode se od 2026. ne skuplja
kroz lonac nego plaća jednokratno kad dospije (odluka #14) — modelirano kao
godišnji fiksni trošak (`recurrence: "annual"`), ne mjesečni. Hrana je od
2026-09-09 fiksni trošak 350 € (ranije varijabilna kategorija, plan 300 €) —
odluka #16, jer je stvarna potrošnja dosljedno oko tog iznosa.*

**Stalno fiksno ukupno (bez rata i kaska): 1.570,39 €/mj**

### Varijabilne kategorije (mjesečni plan)

| Kategorija | Plan €/mj | Analizira se u Analizi? |
|---|---|---|
| Život | 200 | da |
| Gorivo | 150 | da |
| Porez na najam | 58,80 | ne (pass-through, nije diskrecijsko trošenje) |
| Ulaganja (T212) | 225 | ne (ulaganje, ne trošenje — vidi odluku #17) |

*(Porez na najam je premješten iz fiksnih u varijabilne na Nikolin zahtjev. Hrana je
izašla iz ove liste u Fiksne troškove — odluka #16. Ulaganja (T212) je ušlo u ovu
listu iz Lonaca — odluka #17. "Analizira se" = prikazuje li se u "Prosjek po
kategoriji" u Analizi; odluka #18.)*

**Varijabilni plan ukupno: 633,80 €/mj**

### Lonci

Svi lonci kreću od 0 u rujnu 2026. **Prvi ciklus** svakog sinking lonca koristi ratu
= cilj / preostali mjeseci do prvog dospijeća (da stigne na cilj bez manjka — vidi
odluku #15). Nakon prvog dospijeća app automatski prelazi na standardnu ratu
(cilj/12) za idući (i svaki sljedeći) ciklus.

| Lonac | Tip | €/mj (prvi ciklus, sada) | Cilj | Prvo dospijeće | Lonac kreće | €/mj nakon reseta |
|---|---|---|---|---|---|---|
| More | sinking | 54,50 | 600 | **srpanj 2027** | 2026-09 | 50,00 |
| Kasko | sinking | 33,33 | ~500 | **studeni 2027** | 2026-09 | 41,67 |
| Servis auto | sinking | 44,44 | ~400 | svibanj 2027 | 2026-09 | 33,33 |
| Registracija + osiguranje auto | sinking | 36,36 | ~400 | srpanj 2027 | 2026-09 | 33,33 |
| Osiguranje doma | sinking | 6,01 | 60,13 | lipanj 2027 | 2026-09 | 5,01 |

*Osiguranje od nezgode više nije lonac (odluka #14) — vidi Fiksni troškovi.
Ulaganja (T212) više nije lonac (odluka #17) — vidi Varijabilne kategorije gore;
ukupan uloženi iznos kroz vrijeme se i dalje prikazuje, sad u ekranu Analiza.*
*Kasko za 2026. (studeni) plaćen izvan lonca, jednokratnim fiksnim troškom 250 €
(pola-pola); lonac "Kasko" gore je za idući ciklus, dospijeva studeni 2027, i kreće
već sad (rujan 2026) umjesto tek u prosincu.*

**Mjesečna rezervacija u lonce (svih 5 sinking lonaca, prvi ciklus): ~174,64 €/mj od
rujna 2026.** Postupno pada kako svaki lonac zasebno dospijeva i prelazi na nižu
standardnu ratu; kad svi prođu prvi ciklus (do studenog 2027): ~163,34 €/mj.

*Honorari se ulijevaju u varijabilnu kategoriju "Ulaganja (T212)" povrh mjesečnih 225
(odluka #17; ranije kao doprinos lonca, ista svrha).*

### Tipičan mjesec

| | Iznos |
|---|---|
| Prihodi (plaća + najam) | +2.600 € |
| Fiksni (rujan 2026, obje rate + Hrana) | −1.642,62 € |
| Rezervacija u lonce (5 sinking, prvi ciklus) | −174,64 € |
| Varijabilni plan (uklj. Ulaganja 225) | −633,80 € |
| **Ostatak** | **~148,94 € + honorari** |

*Napomena: "Ostatak" ovdje je ono što ostane na tekućem nakon što sve prođe po planu —
podudara se s `closingPlanned` iz odjeljka 5 (od odluke #22 `closingBalance`/`closingPlanned`
oduzimaju i uplate u lonce jer novac stvarno ode na štednju).
Ukupni zbroj se nije promijenio premještanjem Ulaganja/Hrane između kategorija (isti
novac, samo drugi red u tablici) — pao je jedino za +50 € razlike Hrane (300→350).*

Studeni 2026 je iznimka: uz redovan mjesec dolazi i jednokratni trošak Kasko (pola)
250 € → ostatak na tekućem (ilustrativno) pada na **~−101,06 € prije honorara**. Ventil: taj mjesec
uplatiti manje u ulaganja (varijabilna kategorija, može se preskočiti/smanjiti bez
posljedica), ili pokriti honorarom.

Od svibnja 2027 (prvi lonci resetiraju na nižu ratu, rata banka 2 otpala) situacija se
postupno opušta.

---

## 7. Poznati problemi — prva godina (riješeno)

Lonci kreću od **0** u rujnu 2026. Ranije je ovo značilo manjak na prvom dospijeću
svakog lonca (nedovoljno mjeseci da se skupi cijeli cilj). **Riješeno (2026-09-09,
razgovor s Claudeom): prva rata svakog lonca preračunata je na cilj / preostali
mjeseci do prvog dospijeća**, pa lonac stiže na cilj točno na vrijeme, bez manjka —
vidi tablicu u odjeljku 6 i pravilo u odjeljku 5 ("Rata lonca — prvi ciklus vs.
ustaljeni ciklus"). Nakon prvog dospijeća app automatski prelazi na standardnu ratu
(cilj/12), pa se manjak ne može ponoviti u idućim ciklusima.

Osiguranje od nezgode je izbačeno iz lonaca posebno (odluka #14) — plaća se
jednokratno kad dospije, umjesto skupljanja 0,61 €/mj kroz godinu.

**Preostala posljedica (ne manjak, samo tjesniji mjesec):** studeni 2026 je tjesniji
nego prije, jer se lonac "Kasko" za idući ciklus već puni od rujna 2026 UZ jednokratni
trošak od 250 € za ovogodišnji kasko. Vidi "Tipičan mjesec" u odjeljku 6.

**Srpanj 2027 ostaje mjesec s više istovremenih dospijeća** (More + Registracija/osiguranje
auto), ali oba lonca su tada već puna na cilj (bez manjka), pa se samo istovremeno
prazne — ne stvara se rupa u računu.

---

## 8. Odluke (referenca)

| # | Pitanje | Odluka |
|---|---|---|
| 1 | Podsjetnici | Bez push obavijesti. Dashboard pri otvaranju pokaže dospijeća + "plaća nije unesena". |
| 2 | Budžetski mjesec | = kalendarski. Prošli mjeseci uredivi ali označeni "zaključen". Novi mjesec se otvara **ručno**. |
| 3 | Sinking fund | Mjesečna uplata odmah napušta tekući (ide na odvojeni štedni račun — odluka #22); rezerva vidljiva kao "lonac" u kartici Lonci; veliki račun se plaća iz lonca (ne dira tekući). |
| 4 | Plan vs. ostvareno | Po kategoriji po mjesecu. Plan se kopira iz prošlog mjeseca uz prijedlog po prosjeku. |
| 5 | Fiksni kad se promijene | App pita: "samo ovaj mjesec" ili "od sad nadalje". |
| 6 | Kategorije | Fiksna lista u postavkama, dopunjiva. Plosnata + neobavezni tag (ne pune potkategorije). |
| 7 | Fiksni trošak model | Iznos + početni mjesec + trajanje/završni mjesec. Nova rata = nova stavka s datumima. |
| 8 | Honorari | Idu u Ulaganja (T212). Pri unosu pitati koliko od honorara ide u ulaganja; ostatak na stanje računa. |
| 9 | Ulaganja | Fiksni mjesečni ulog 225 € (može se uplatiti manje neki mjesec). Ukupni zbroj kroz vrijeme se prati — od #17 kao varijabilna kategorija, prikazano u Analizi. |
| 10 | Lonci početno stanje | Svi kreću od 0. Svi (uklj. Kasko) kreću 2026-09 — vidi #15. |
| 11 | Dugovi prema drugima | Nema (osim kredita i bankovnih rata — modelirani kao fiksni troškovi). |
| 12 | Ciljevi štednje | Izbačeno iz v1 (sinking + ulaganja djelomično pokrivaju). |
| 13 | Plaćeno / nije plaćeno | Kvačica po stavci (fiksni, doprinosi lonaca, prihodi). |
| 14 | Osiguranje od nezgode | Izbačeno iz lonaca (2026-09-09). Plaća se jednokratno kad dospije (prvi put srpanj 2027), modelirano kao godišnji fiksni trošak (`recurrence: "annual"`), ne kao sinking lonac. |
| 15 | Rata lonca prve godine | Svi lonci kreću od 0 u 2026-09, ali prva rata svakog = cilj / preostali mjeseci do prvog dospijeća (ne cilj/12), da se izbjegne manjak na prvom dospijeću. Kasko time kreće već 2026-09 (ne 2026-12), rata 33,33 €. Nakon dospijeća app **automatski resetira**: nextDue +12 mj., rata = cilj/12 — posebno po lonac, bez ručnog uređivanja. |
| 16 | Hrana | Premješteno iz varijabilnih kategorija (plan 300 €) u fiksne troškove, 350 €/mj (2026-09-09) — stvarna potrošnja je dosljedno oko tog iznosa, nema smisla tretirati ga kao promjenjivo. |
| 17 | Ulaganja (T212) lokacija | Premješteno iz Lonaca (type "savings") u varijabilne kategorije, plan 225 €/mj (2026-09-09). Honorar-investicija se knjiži kao unos u tu kategoriju (ne kao potContrib). Ukupan uloženi iznos kroz vrijeme prikazan u Analizi. Razlog: iznos varira po mjesecu i konceptualno je bliže "varijabilnom" unosu nego fiksnoj rezervaciji. |
| 18 | Analiza — koje kategorije | "Prosjek po kategoriji" u Analizi prikazuje samo kategorije s `analyze: true` (Život, Gorivo) — Porez na najam (pass-through) i Ulaganja (investicija, ne trošenje) nisu korisne za tu usporedbu, pa su izostavljene (2026-09-09). |
| 19 | Stvarni vs. planirani iznos | Prihodi i uplate u lonce imaju uređivo polje za stvarni iznos (ne samo checkbox), jer se npr. plaća rijetko poklapa točno s planom (2026-09-09). |
| 20 | ~~Predviđeno stanje prije plaće~~ | Dodano 2026-09-09, **maknuto 2026-09-10 (odluka #23)** — Nikoli nije bilo informativno. |
| 21 | Dnevni budžet → Preostalo za Život | Zamijenjeno (2026-09-09): umjesto agregatnog "dnevnog budžeta" (koji je nesvjesno uključivao Porez na najam i Ulaganja), Dashboard sad istaknuto prikazuje samo preostalo za kategoriju "Život" — to je stavka koju Nikola stvarno prati iz dana u dan. |
| 22 | Lonci = odvojeni štedni računi | (2026-09-10) Nikola fizički drži novac za lonce na zasebnim štednim računima, ne na tekućem. Zato: plaćena uplata u lonac (`potContrib.paid`) odmah **izlazi iz `accountBalance`** u cijeloj aplikaciji (prije: "ostaje na računu, samo rezervirano"). `closingBalance` i `closingPlanned` oduzimaju plaćene/planirane uplate u lonce. Stanje lonaca prati se odvojeno u kartici Lonci (`potBalance`). Isplata iz lonca (`potSpend`) više ne dira tekući. Tip `savings` maknut iz izračuna — sve uplate u lonce tretiraju se jednako. Maknut redundantan red "Trenutni (stvarni) ostatak" s dashboarda. |
| 23 | Dashboard = samo stvarno stanje | (2026-09-10) Nikola želi dashboard koji pokazuje **trenutno stvarno stanje tekućeg**, bez projekcija budućih plaćanja — potrošnju prati sam štikliranjem. Zato: glavna kartica preimenovana "Slobodno za potrošiti" → **"Stanje računa"** i prikazuje čisti `accountBalance` (bez oduzimanja nadolazećih uplata u lonce). "Predviđeno stanje prije iduće plaće" red **maknut**. Kartica "Projekcija" ostavljena samo s "Planirani ostatak na kraju mjeseca". Uklonjene funkcije `freeToSpend`, `projectedBeforePayday`, `nextPayday`, `absDay`, `daysInMonth`. |

---

## 9. Funkcije v1 (opseg)

- **Stanje računa** koje se prenosi iz mjeseca u mjesec (Nikolin "ostatak").
- **Fiksni troškovi** s iznosom + trajanjem otplate → auto-generiranje svaki mjesec,
  auto-gašenje na kraju. Dodavanje nove rate = nova stavka. Podrška za jednokratni trošak.
- **Lonci**: 5 sinking (More, Kasko, Servis auto, Registracija+osiguranje, Osiguranje
  doma). Rezervacija umanjuje slobodni novac, sinking račun se vuče iz lonca,
  upozorenje na manjak prije dospijeća. Automatski reset rate nakon dospijeća (#15).
- **Varijabilne kategorije** s planom po mjesecu (kopira se iz prošlog + prijedlog po prosjeku).
  Inline unos pojedinačnih troškova (Enter-za-dodati).
- **Plaćeno / nije plaćeno** kvačica po stavci.
- **Unos honorara** → pita split u ulaganja, ostatak na račun.
- **Dashboard** (#23): stanje računa (čisti `accountBalance`) • preostalo za "Život" (#21) •
  planirani ostatak na kraju mjeseca • što dospijeva ovaj tjedan • je li plaća unesena •
  stanja lonaca s upozorenjima na manjak.
- **Analiza**: potrošnja po mjesecima (stupčasti graf) • prosjek po kategoriji •
  top 5 stavki mjeseca • plan vs. ostvareno kumulativno kroz godinu.
- **Ručno otvaranje novog mjeseca**; prošli uredivi, označeni "zaključen".
- **Izvoz** CSV (ravna lista svih transakcija, otvara se u Excelu) + izvoz/uvoz cijelog JSON-a.
- **Uređivanje postavki kroz UI**: dodaj/uredi/obriši za prihode, fiksne troškove
  (uklj. godišnje/annual), varijabilne kategorije (uklj. `analyze` flag), lonce
  (uklj. tip sinking/savings). Mijenja samo predloške — ne utječe retroaktivno na
  već otvorene mjesece (isto ponašanje kao i prije, kroz JSON uređivanje).
  Uz to, **početno stanje računa** (`settings.startingBalance`) je uredivo —
  uređivanje pokrene `ensureMonthChain()` pa se `openingBalance` već otvorenih
  mjeseci ispravno preračuna (za slučaj da se stanje unosi nakon što je tracking
  već počeo, npr. Nikolin stvarni slučaj 2026-09-09: postavio 847,99 €, pa to
  spustio na 147,99 € kad se sjetio da je 700 € najma već uključeno, i taj iznos
  ručno čekirao kao primljen prihod da ne duplira).
- **Podaci**: v1 localStorage; v2 jedan JSON u Google Driveu (atomarno + timestampirani backupi).

### Izvan v1 (moguće kasnije)

- Prave push obavijesti (tray app / scheduled task na jednom računalu).
- Ciljevi štednje s rokom.
- Fotografija računa uz trošak.
- Tagovi koji presijecaju kategorije.

---

## 10. Google Drive sync — status: gotovo, potvrđeno uživo (2026-09-09)

Google Cloud projekt `budzet-app` postoji, OAuth consent screen (External, Testing,
Nikola dodan kao test user), Drive API omogućen, OAuth Client ID kreiran s
Authorized JavaScript origin `http://localhost:8761`.

**Client ID je u kodu**: `app.js`, konstanta `GOOGLE_CLIENT_ID` (na vrhu, odmah nakon
`Store` bloka). Nije tajna — client ID za web-app OAuth je namjerno javan (sigurnost
dolazi od Authorized origins provjere na Googleovoj strani, ne od skrivanja ID-a).

### Kako radi (`Drive` objekt u app.js)

- **Tiha prijava pri učitavanju**: `Drive.init()` (poziva se kad se GIS skripta učita,
  vidi kraj `app.js`) pokuša `requestAccessToken({prompt:''})` — bez popupa, radi
  samo ako je korisnik već jednom pristao na tom uređaju/pregledniku. Prvi put ne
  uspijeva (nema popupa još) — normalno, treba klik na "Prijavi se".
- **Postavke → "Prijavi se"** (`Drive.signIn()`) — otvara Googleov popup, **bez**
  forsiranog `prompt:'consent'` (maknuto 2026-09-09 — ranije je tjeralo puni "app
  nije provjerena" ekran pri SVAKOM kliku, iritantno na mobitelu). Sad Google
  prikaže samo što je nužno: prvi put puni consent + "Google hasn't verified this
  app" ekran (klik "Advanced" → "Go to Budžet (unsafe)", normalno za Testing app),
  a nakon toga samo brzi odabir računa.
- **Pri spajanju** (`_syncOnConnect`): traži `budzet.json` na Driveu. Ne postoji →
  kreira ga sa trenutnim lokalnim stanjem. Postoji i **novije** je od lokalnog →
  pita (confirm dijalog) da učita Drive verziju (zamjenjuje lokalnu).
- **Svako spremanje** (`persist()`) dok je `Drive.status === 'signed-in'` → i
  `Drive.push()` u pozadini (fire-and-forget, ne blokira UI). Prije prepisivanja
  postojeće Drive datoteke pravi se `budzet-backup-YYYYMMDD...json` kopija —
  najviše 1×/24h (da ne spamira Drive), stare backupove iznad 20 briše.
- **"Spremi na Drive sada"** gumb u Postavkama — ručni forsirani push.
- **Odjava** — revoke tokena, sljedeći put treba ponovni klik "Prijavi se".

### Testirano

- ✅ **Potvrđeno uživo (2026-09-09), radi kraj-do-kraja.** Nikola se prijavio kroz
  "Prijavi se" u Firefoxu, `budzet.json` se stvorio na njegovom stvarnom Google Driveu,
  Postavke pokazuju "Povezano. Zadnja sinkronizacija: ...".

### Zamka na koju se naletjelo (za buduće referenc)

**Google Cloud ima "My First Project" — automatski zadani projekt** koji postoji od
prvog ikad otvaranja Cloud Consolea, prije nego korisnik svjesno stvori svoj. Drive
API + OAuth Client su (nesvjesno) kreirani na tom zadanom projektu (`handy-cell-508119-a3`,
naziv klijenta "Budget-app"), ali kad je trebalo dodati test-usera, "Get started" wizard
na Auth Platformu je odveo na **drugi**, novo-stvoreni projekt "budzet-app"
(`budzet-app-508119`) koji nema nikakve klijente. Rezultat: sat vremena "access_denied"
grešaka jer se test-user dodavao na krivi projekt.

**Dijagnoza koja je pomogla**: Google Cloud Console → gornji lijevi padajući izbornik s
nazivom projekta → provjeriti **Clients** stranicu na svakom projektu dok se ne nađe
onaj gdje stvarni Client ID (`88610669220-...`) postoji. Audience/test-useri se
podešavaju **na tom istom projektu**, ne na onom trenutno "otvorenom" u UI-u po defaultu.

Prazan projekt "budzet-app" (`budzet-app-508119`) ostaje nekorišten — može se obrisati,
nije hitno, ne utječe na rad.

### Preostali koraci za bilo koga koji nastavlja ovo

1. ✅ Hostano na GitHub Pages: **https://nbe-design.github.io/budzet_app/** — dodano
   kao Authorized JavaScript origin (`https://nbe-design.github.io`) na istom OAuth
   klijentu ("My First Project" → Clients → Budget-app). `http://localhost:8761`
   ostaje dodatno za lokalni dev.
2. Repo: **https://github.com/nbe-design/budzet_app** (public, GitHub Pages iz
   `master` grane, root foldera).
3. Ako se port lokalnog servera opet promijeni, ili se doda još jedan origin, treba i
   tu dodati u Authorized origins, inače prijava puca s "access_denied" greškom.
4. `drive.file` scope znači: app vidi samo `budzet.json` (i backup datoteke) koje je
   sam kreirao — ne cijeli Nikolin Drive. To je namjerno (odluka iz odjeljka 1).

### Referenca — originalni plan (za usporedbu)

1. Google Cloud Console → novi projekt (besplatno). ✅
2. OAuth consent screen: External, dodati Nikolin mail kao test usera. ✅
3. Credentials → OAuth client ID, tip "Web application", dodati origin
   (`http://localhost:8761` sada; hosting origin kasnije) u Authorized JavaScript origins. ✅
4. U aplikaciji: Google Identity Services (GIS) token client, scope
   `https://www.googleapis.com/auth/drive.file`. ✅
5. Datoteka `budzet.json` u korijenu Drivea (ne u posebnom folderu — jednostavnije, i
   `drive.file` scope svejedno ograničava vidljivost samo na datoteke koje app kreira). ✅
6. `Drive._syncOnConnect()` → traži datoteku po imenu. `Drive.push()` → PATCH media.
   Provjera `modifiedTime` radi se **pri spajanju** (ne na svakom pojedinom save-u —
   vidi "Poznata ograničenja" u odjeljku 1: konflikt je prihvaćen rizik jer je jedan
   korisnik). ✅
7. Prije prepisivanja: kopija u `budzet-backup-<ISO timestamp>.json`, max 1×/24h
   (ne na svaki save — previše poziva), stare iznad 20 se brišu. ✅

---

## 11. Nastavak na drugom računalu

### Ako samo želiš KORISTITI app (unositi troškove, gledati stanje) — ne treba USB

App je već hostana i sinkronizirana: otvori **https://nbe-design.github.io/budzet_app/**
u bilo kojem pregledniku na bilo kojem uređaju, Postavke → "Prijavi se" (Google Drive),
i svi podaci (stvarni Nikolini, ne seed) se učitaju automatski. Folder na USB-u nije
potreban za ovo — samo za nastavak RAZVOJA (da Claude Code može uređivati kod).

### Ako nastavljaš RAZVOJ koda na drugom računalu (USB ili Git)

1. **Kopiraj cijelu mapu `budzet/`** (uklj. skriveni `.git` folder ako želiš puni git
   log ponijeti) na USB, pa na drugo računalo. Alternativa bez USB-a: `git clone
   https://github.com/nbe-design/budzet_app.git` — repo je već public na GitHubu,
   sve do zadnjeg commita je tamo (pushano 2026-09-09).
2. **Python treba biti instaliran** na tom računalu za `Pokreni budžet.bat` (lokalni
   dev server). Ako nije: `winget install --id Python.Python.3.13 -e --source winget
   --accept-source-agreements --accept-package-agreements`. Pažljivo — Windows ima
   "python" App execution alias koji glumi da je Python instaliran a nije; bat
   datoteka to već zaobilazi tražeći po punim putanjama (vidi njen sadržaj).
3. **Port 8761** je već hardkodiran u `Pokreni budžet.bat` i već je odobren kao
   Authorized JavaScript origin za Google Drive OAuth (`http://localhost:8761`,
   na projektu "My First Project" / klijent "Budget-app" — vidi odjeljak 10). Dok
   god bat datoteka ostane na tom portu, Drive prijava radi lokalno bez dodatnog
   Google Cloud podešavanja. Ako se port promijeni, treba dodati novi origin.
4. Nakon uređivanja: `git add -A && git commit -m "..." && git push` — GitHub Pages
   se automatski redeploya iz `master` grane u par minuta (nema build koraka).
5. Reci Claudeu: *"nastavljam gradnju budžet aplikacije, pročitaj SPEC.md"* — ovaj
   dokument + `data-seed.json` sadrže sve odluke, brojke i "zamke" na koje se već
   naletjelo, da se ne ponavlja isti posao.

### Ključni linkovi (za brzu referencu)

- Live app: https://nbe-design.github.io/budzet_app/
- GitHub repo: https://github.com/nbe-design/budzet_app
- Google Cloud projekt s OAuth klijentom: "My First Project" (`handy-cell-508119-a3`)
  — **ne** "budzet-app" projekt (taj je prazan, zabuna iz odjeljka 10)
