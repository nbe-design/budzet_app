# Budžet

Osobna PWA za planiranje i praćenje mjesečnog budžeta. Zamjena za Excel na mobitelu.

**Puna specifikacija, sve odluke i podaci: [`SPEC.md`](SPEC.md).**

## Pokretanje lokalno

Treba se posluživati preko HTTP-a (service worker i `type=module` ne rade s `file://`):

```bash
cd "budzet"
python -m http.server 8000
```

Otvori `http://localhost:8000`.

## Stanje

v1 skeleton. Radi: boot iz ugrađenog seeda, auto-otvaranje rujna 2026, dashboard,
ekran Mjesec (prihodi / fiksni / varijabilno inline unos / lonci / godišnji računi),
ekran Lonci, Analiza (graf + prosjeci + top 5 + plan vs. ostvareno), Postavke (pregled
+ izvoz/uvoz JSON + reset). Pohrana: `localStorage` (`budzet_data_v1`).

### Sljedeće (vidi SPEC.md §2)

- Uređivanje stavki u Postavkama (dodaj/uredi/obriši prihode, fiksne, kategorije, lonce)
- Dijalog "samo ovaj mjesec / od sad nadalje" pri promjeni fiksnog troška
- Izvoz CSV/Excel
- Google Drive sync (zamijeni `Store.load/save`; §10 u SPEC.md)
- Poliranje PWA ikona

## Datoteke

| | |
|---|---|
| `index.html` | shell + navigacija |
| `app.css` | stil (tamna tema) |
| `app.js` | sve: seed, model, izračuni, ekrani, grafovi |
| `data-seed.json` | referentna kopija početnih podataka (kanonski je SEED u `app.js`) |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA |
| `SPEC.md` | master specifikacija |

## Nastavak na drugom računalu

Cijela mapa je samodostatna (`git clone` ili kopiraj). Reci Claudeu:
*"nastavljam gradnju budžet aplikacije, pročitaj SPEC.md"*.
