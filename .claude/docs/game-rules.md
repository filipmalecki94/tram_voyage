# Tramwajarz — zasady gry (iteracja 2)

> Ta wersja zastępuje model z iteracji 1 (4-fazowy cykl zgadywania per tura).
> Gra składa się teraz z trzech sekwencyjnych etapów dla całego stołu.

## Zestaw i setup

- Standardowa talia 52 kart (bez jokerów), tasowanie Fisher-Yates (serwer, seeded RNG dla testów)
- 2–12 graczy, każdy ma rękę kart widoczną wyłącznie dla siebie
- Trzy sekwencyjne etapy rozgrywki: **Zbieranie → Piramida → Tramwaj**

Hierarchia rang: 2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A

## Widok ręki gracza (wszystkie etapy)

- Karty w ręce widoczne jako wachlarz przy dolnej krawędzi ekranu kontrolera
- Posortowane rosnąco (2 → A), częściowo schowane (tylko górne fragmenty kart wystają)
- Widoczne przez cały czas trwania gry

---

## Etap 1 — Zbieranie kart

**Cel:** każdy gracz zbiera do ręki 4 karty w 4 kolejnych rundach.

Rundy są **globalne** — w każdej rundzie wszyscy gracze ciągną po jednej karcie (po kolei),
a dopiero potem następuje kolejna runda. Po Etapie 1 każdy gracz ma dokładnie 4 karty w ręce.

### Runda 1 — Kolor karty (czarna/czerwona)

- Gracz wybiera jeden z dwóch przycisków: **♠♣ Czarna** / **♥♦ Czerwona**
- Po zatwierdzeniu przyciskiem „Ciągnij kartę" serwer zdejmuje kartę z topu talii
- Trafienie: karta trafia do ręki, gracz nie pije
- Pudło: karta trafia do ręki, gracz **pije 1 łyk**

### Runda 2 — Wyżej / niżej

- Porównanie z kartą zebraną w Rundzie 1
- Przyciski: **▲ Wyżej** / **▼ Niżej** (ikony kierunku)
- Trafienie: karta trafia do ręki, gracz nie pije
- Remis rang (nowa karta ma tę samą rangę co karta z R1): traktujemy jak błąd
- Pudło: karta trafia do ręki, gracz **pije 1 łyk**

### Runda 3 — Pomiędzy / poza zakresem

- Porównanie z dwiema kartami w ręce (R1 + R2)
- Przyciski: **↔ Pomiędzy** / **⇤⇥ Poza**
- „Pomiędzy" oznacza: ranga karty jest **ściśle między** niższą a wyższą z dwóch kart w ręce (nie włącznie)
- Karta o randze równej granicy = błąd (granica traktowana jako „poza")
- Edge case: jeśli obie karty w ręce mają tę samą rangę, „pomiędzy" jest niemożliwe
  — poprawna jest wyłącznie odpowiedź „poza"
- Pudło: karta trafia do ręki, gracz **pije 1 łyk**

### Runda 4 — Symbol karty (suit)

- Gracz zgaduje symbol (kolor) nowej karty: **♠ Pik / ♣ Trefl / ♦ Karo / ♥ Kier**
- Cztery przyciski wyboru symbolu, następnie zatwierdzenie przyciskiem „Ciągnij kartę"
- Trafienie: karta trafia do ręki, gracz nie pije (lub patrz: Tęcza)
- Pudło: karta trafia do ręki, gracz **pije 1 łyk**

**Tęcza (rainbow):** jeśli gracz po Rundach 1–3 ma dokładnie 3 karty w 3 różnych symbolach,
przycisk odpowiadający brakującemu (4.) symbolowi podświetla się tęczowo.

- Gracz wybierze tęczowy symbol i **trafi** → **wszyscy pozostali gracze piją**, gracz nie pije
- Gracz wybierze tęczowy symbol i **spudłuje** → pije tylko gracz (standardowa kara)
- Gracz wybierze jeden z 3 już posiadanych symboli → zwykłe zgadywanie (trafienie = nic, pudło = pije)

### Koniec Etapu 1

Po Rundzie 4 każdy gracz ma 4 karty w ręce. Reszta talii (52 − 4×N kart) przechodzi do Etapu 2.

---

## Etap 2 — Piramida

### Układ piramidy

Z pozostałej talii układamy piramidę z **10 zasłoniętych kart**:

| Poziom | Liczba kart | Kolejki do rozdania przy odsłonięciu |
|--------|-------------|--------------------------------------|
| 1      | 1 karta     | 1 kolejka                            |
| 2      | 2 karty     | 2 kolejki każda                      |
| 3      | 3 karty     | 3 kolejki każda                      |
| 4      | 4 karty     | 4 kolejki każda                      |

Odsłaniamy od Poziomu 1, po jednej karcie.

### Rozgrywka

Dla każdej odkrytej karty:
- Każdy gracz, który ma w ręce kartę o tej samej **randze** (niezależnie od symbolu),
  może odłożyć ją na stos przy odkrytej karcie
- Każde takie odłożenie = **jedno rozdanie N kolejek** (N = numer poziomu)
- Gracz z pasującą kartą wyznacza **dowolnego innego gracza** do wypicia N łyków
  (siebie nie można wyznaczyć)
- Można wyznaczyć tę samą osobę wielokrotnie, jeśli gracz odkłada kilka pasujących kart
- Gracz może mieć kilka kart pasujących do jednej karty piramidy — każda to osobne rozdanie

**UI:** przy każdym graczu licznik odebranych kolejek do wypicia rośnie w trakcie rozdawania;
resetuje się do zera po odsłonięciu **następnej** karty piramidy.

### Wyłonienie tramwajarza

Po przejściu przez wszystkie 10 kart piramidy wyłaniamy gracza do Etapu 3:

1. **Kryterium główne:** gracz z **największą liczbą kart pozostałych w ręce** jedzie tramwajem
2. **Tiebreaker 1 (remis liczby kart):** spośród remisujących porównujemy ich **najwyższe karty**
   — przegrywa (jedzie tramwajem) gracz z **najniższą** spośród tych najwyższych kart
3. **Tiebreaker 2 (dalszy remis):** porównujemy kolejne (drugie najwyższe) karty, itd., aż do rozstrzygnięcia
4. **Tiebreaker 3 (całkowity remis rang):** jeśli ręce są identyczne pod względem rang — losowanie

---

## Etap 3 — Jazda tramwajem

- Bierze udział wyłącznie wyłoniony tramwajarz
- Serwer tworzy **nową, potasowaną talię** 52 kart (nie używamy resztek z Etapu 2)
- Pierwsza ciągnięta karta pełni rolę **karty referencyjnej** (brak zgadywania); od drugiej
  gracz zgaduje wyżej/niżej względem poprzedniej
- Gracz musi odgadnąć **5 kart z rzędu** poprawnie (wyżej/niżej)
- Zasada remisu: identyczna ranga = błąd (tak samo jak Runda 2 Etapu 1)

**Przebieg jednego cyklu:**
1. Ciągnij kartę referencyjną (bez zgadywania)
2. Dla każdej kolejnej karty: wybierz **▲ Wyżej** / **▼ Niżej** → zatwierdź „Ciągnij"
3. **Sukces po 5 trafieniach z rzędu** → koniec gry, tramwajarz „wysiada"
4. **Błąd na dowolnej pozycji** (karty 2–6) → gracz **pije 1 łyk** i Etap 3 zaczyna się **od nowa**
   (nowa tasowana talia, licznik streak zerowany do 0)

Etap 3 powtarza się w pętli aż do uzyskania 5-streak sukcesu.
