# Kenttäkäytön simulointi, 6.9.2026

## Kokoonpanopäivitys 26.9.2026

218 laskentatestiä läpäisty. Uudet testit kattavat muodon siirtämisen ja palauttamisen, roolin vaihdoksen vaikutuksen vain tuleviin minuutteihin, muutoksen perumisen, tarkan paikkalukituksen, roolikohtaiset rajoitukset, sallittujen paikkojen perusteella muodostetun avauksen sekä rajoitettujen pelaajien kokonaisen ottelukierron. Vaihtoehdotusten sovitus siirtää tarvittaessa joustavan pelaajan toiseen sallittuun paikkaan, jotta se ei vie yhden paikan pelaajan ainoaa mahdollisuutta.

Selaimen kosketustapahtumilla testattu tyhjän paikan veto, uuden pelaajan luonti suoraan paikkaan, kiertolukitus, sopimattoman pudotuksen esto, penkiltä kentälle tehty yksittäinen vaihto, roolin muuttaminen ja tallennuksen palautuminen. 390 × 844 -näkymässä testattu myös reunavieritys, jolla penkkipelaajan voi vetää takaisin näkyviin vierivälle kentälle. Vaihtohälytys testattu Kokoonpano-välilehdellä. Fyysisellä puhelimella tehtyä kenttätestiä tämä ei korvaa.

## Kokonaiset ottelut

192 eri 60 minuutin ottelua: 5v5, 7v7, 8v8 ja 11v11; 0, 1, 2, 3, 5 tai 10 vaihtopelaajaa; 1–4 jaksoa; maalivahti kiinteänä tai kierrossa. Vaihtoväli oli viisi minuuttia ja kaikki ehdotetut ryhmävaihdot toteutettiin. Jaksotauoilla simuloitiin 15 minuutin odotus.

Jokaisessa testissä tarkistettiin, että pelaaja on vain yhdessä paikassa, kentällä vietetyt sekunnit täsmäävät pelaajien yhteisaikaan, pelipaikka-aikojen summa vastaa kokonaisaikaa ja tauolla minuutteja ei kerry. Tasaisen peluutuksen testissä mukana olevien pelaajien peliaikaero jäi korkeintaan yhteen vaihtoväliin. Kiinteä maalivahti jätettiin tasaisuusvertailun ulkopuolelle.

Viisi vaihtopelaajaa, kiinteä maalivahti, 60 minuuttia:

| Pelimuoto | Vanha yhden pelaajan ehdotus | Uusi automaattinen ryhmä |
| --- | --- | --- |
| 5v5 | 20–35 min | 25–30 min |
| 7v7 | 30–35 min | 30–35 min |
| 8v8 | 35–35 min | 35–35 min |
| 11v11 | 35–50 min | 40–40 min |

Nämä ovat toistettavien esimerkkisimulaatioiden tuloksia, eivät takuu samanlaisista minuuteista kaikissa otteluissa. Myöhästyneet tai käsin muutetut vaihdot, rajattu vaihtoryhmä, muuttuva osallistuminen ja erilaiset vaihtovälit vaikuttavat lopputulokseen.

## Virhetilanteet ja painotettu peluutus

- Ryhmävaihto hylätään kokonaan, jos samalle pelaajalle annetaan kaksi kenttäpaikkaa.
- Vaihdon peruminen korjaa sekä pelipaikat että muutoksen jälkeen kertyneet minuutit, myös tallennuksen ja palautuksen jälkeen.
- Ennen määräaikaa tehty tai ryhmävaihdon jälkeen tehty lisävaihto ei siirrä seuraavaa määräaikaa.
- Loukkaantuneelle ei ehdoteta sisäänvaihtoa; tyhjälle paikalle ei kerry minuutteja. Korvaaminen ja paluu säilyttävät aikakirjanpidon.
- Saapunut pelaaja voi liittyä otteluun ja saada minuutteja vasta kentälle tultuaan.
- Pitkä aikahyppy pysähtyy jakson loppuun eikä aloita seuraavaa jaksoa.
- Tauko, negatiivinen aika ja virheelliset numerot eivät muuta minuutteja.
- Painotettu 5v5-esimerkki: neljä vaihtopelaajaa, yksi kenttäpelaaja painolla 2, muut painolla 1. Painon 2 pelaaja sai 50 minuuttia, muut 25–30 minuuttia. Erittäin suuri paino ei voi johtaa yli täyteen otteluaikaan.
- Ennen aloitusta muokattu avaus ei kerrytä raporttiin ylimääräisiä vaihtotapahtumia.

## Selainkokeet

Chrome, erillinen testiprofiili. Työpöytä- ja puhelinkokoinen näkymä; painikkeet testattiin myös hiiritapahtumilla.

Nopeutetussa 2 × 10 minuutin ottelussa testattiin ryhmävaihto, peruminen, kellon tauko, asetusten tallennus, loukkaantuminen, tyhjän paikan täyttäminen, myöhässä saapuminen, usean vaihdon käsivalinta, kaksoisvalinnan hylkäys, tuplaklikkauksen esto, jaksotauko, ottelun päättyminen ja raportti. Näytön päälläpitopyynnön hylkäys ei estä käyttöä.

Erikseen testattiin käynnissä olevan ottelun uudelleenlataus, alaspäin laskeva kello, taustalla jakson loppuun ehtineen ottelun palautuminen sekä kahden välilehden muuttuneiden tietojen tunnistus. Vanha välilehti ei kirjoittanut uudemman tilanteen päälle testatussa tilanteessa.

## Vielä oikealla laitteella varmistettavaa

Simulaatiot ja puhelinkokoinen selain eivät vastaa fyysistä puhelinta. Äänen kuuluvuutta kentällä, näytön päälläpitoa, akun säästötilaa, saapuvaa puhelua tai iOS/Android-taustakäyttäytymistä ei ole varmistettu oikeassa ottelussa. Näistä syistä ensimmäinen treenipeli on edelleen käytännön kokeilu rinnakkaisen kellon kanssa. Tässä vaiheessa ei ole pilvivarmuuskopiota eikä automaattista pelipaikkasoveltuvuuden arviointia.
