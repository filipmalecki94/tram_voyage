# Zasady gry — Tramwajarz

## Ogólny przebieg

Gra toczy się w turach. W każdej turze jeden gracz ciągnie karty i zgaduje odpowiedzi w 4 fazach. Błędne zgadnięcie = picie. Poprawne przejście przez wszystkie 4 fazy = tura przechodzi bez kary.

## 4 fazy zgadywania (kolejno)

### Faza 1 — Kolor (color)

Gracz jeszcze nie widzi karty. Zgaduje:
- **Czerwona** (♥ ♦) lub **Czarna** (♠ ♣)

Kara za błąd: **1 łyk**

### Faza 2 — Wyżej / Niżej (highLow)

Gracz widzi kartę z Fazy 1. Zgaduje czy następna karta będzie:
- **Wyżej** (wyższa ranga) lub **Niżej** (niższa ranga)

Hierarchia rang: 2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A

Kara za błąd: **2 łyki**

Edge cases:
- Jeśli karta ma taką samą rangę → gracz pije bez względu na odpowiedź (remis = błąd)
- Opcjonalny wariant: gracz może zgadnąć „równa" — poprawne = 0 łyków, błędne = 3 łyki

### Faza 3 — W środku / Poza (insideOutside)

Gracz widzi karty z Fazy 1 i 2. Zgaduje czy trzecia karta będzie:
- **W środku** (ranga między dwoma poprzednimi, nie włącznie)
- **Poza** (ranga poniżej niższej lub powyżej wyższej)

Kara za błąd: **3 łyki**

Edge cases:
- Jeśli obie poprzednie karty mają tę samą rangę → nie ma „środka", każda odpowiedź „w środku" jest błędna
- Jeśli trzecia karta ma dokładnie rangę jednej z poprzednich → błąd (granica = poza)

### Faza 4 — Kolor karty / Mastík (suit)

Gracz widzi 3 poprzednie karty. Zgaduje kolor (mastík) czwartej karty:
- ♠ Pik / ♥ Kier / ♦ Karo / ♣ Trefl

Kara za błąd: **4 łyki**

## Koniec tury

- **4 poprawne odpowiedzi z rzędu** → tura przechodzi do następnego gracza bez kary
- **Błąd na dowolnej fazie** → gracz pije odpowiednią liczbę łyków, tura przechodzi

## Opcjonalne zasady (warianty)

### Piramida (Etap 2 gry)

Po przejściu przez wszystkich graczy — odkryte karty układane są w piramidę (np. 5-4-3-2-1). Gracze mogą „rozdawać" łyki innym wskazując na karty w piramidzie. Szczegóły do doprecyzowania przy implementacji.

### Auto-pass

Jeśli gracz poprawnie przeszedł przez wszystkie 4 fazy — może zdecydować czy „atakuje" następnego gracza (oni piją 4 łyki) czy po prostu podaje talie dalej.

## Talia

- Standardowa talia 52 kart (bez jokerów)
- Karty używane w rundzie są odkładane na stos odrzuconych
- Gdy talia się wyczerpie → gra się kończy

## Łyki (sips)

Przechowywane jako liczba całkowita na graczu. Wyświetlane na ekranie stołu na końcu gry lub akumulowane dla humorystycznej „sumy" wypitego.
