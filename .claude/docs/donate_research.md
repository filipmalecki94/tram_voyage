---
name: Donate button research (buycoffee.to + PL legal)
description: Podsumowanie researchu nt. przycisku "postaw mi piwko" — opcje techniczne (rekomendacja buycoffee.to) i aspekty prawne w PL (darowizny vs. działalność, limity 2026)
type: reference
originSessionId: 76aab044-69ef-4945-a7a5-12b3c0f7d17b
---
# Donate / „Postaw mi piwko" — zebrane ustalenia (2026-04-11)

Pełny research: `/home/fifi/.claude/plans/quizzical-dreaming-blanket.md`

## Rekomendacja techniczna
- **buycoffee.to** — polska platforma, BLIK/karta/P24, prowizja ~5%. Integracja = `<a href>` lub embed HTML. Pasuje do grupy docelowej (imprezowicze PL).
- Alternatywy: Ko-fi / Buy Me a Coffee (globalne, Stripe), Patronite (subskrypcje, ~10%), Revolut.me (prywatny IBAN — nieanonimowe).
- Własny Stripe/P24/Tpay = wymaga JDG, KYC, webhooków → overkill dla hobby.

## Docelowe miejsca osadzenia (gdyby implementować)
- `src/app/page.tsx` — stopka landing page
- `src/app/table/[code]/page.tsx` — dyskretna belka na dużym ekranie
- ewentualnie nowy komponent `src/components/DonateButton.tsx`

## Kluczowe reguły prawne (PL, stan 2026)

**Darowizna vs. przychód** — fiskus patrzy na charakter, nie na nazwę przycisku. Żadnych perków za wpłatę (np. „wpłać 20 zł = dostaniesz kartę") — to świadczenie wzajemne = działalność gospodarcza = ZUS/VAT/PIT.

**Kwota wolna od darowizn** (III grupa, osoby obce): **5 733 PLN / 5 lat / darczyńca**. Powyżej — obdarowany składa SD-Z2/SD-3.

**Działalność nierejestrowana 2026:** od 1 stycznia 2026 limit **kwartalny 10 813,50 PLN** (225% minimalnego wynagrodzenia 4 806 PLN). Bez ZUS, rozliczenie w PIT-36 jako „inne źródła". Warunek: brak DG w ostatnich 60 miesiącach.

**Anonimowe wpłaty** są prawnie niejasne — dwie interpretacje KIS. buycoffee/BMC pokazują nick wpłacającego → można traktować jako darowizny imienne.

**Minimalne obowiązki formalne jeśli włączymy donate:**
- sekcja w regulaminie: „wsparcie dobrowolne, bez świadczenia wzajemnego, brak zwrotów"
- wzmianka w polityce prywatności o redirect do zewnętrznego serwisu
- prosta ewidencja wpłat (CSV eksport z BMC wystarczy)
- roczny PIT-36 („inne źródła") lub SD-3 (darowizny)

## Czego NIE robić
- ❌ Perków za wpłatę („wpłać X = odblokuj Y") — to sprzedaż, wymaga JDG + VAT
- ❌ Oznaczania projektu jako charytatywny / OPP jeśli nie jest zarejestrowany
- ❌ Zbiórki publicznej w rozumieniu ustawy z 2014 (ale online tip jary są poza tą ustawą)

## Status
Sam research, bez implementacji. Autor (hobby, bez JDG) jeszcze nie zdecydował czy włącza.
