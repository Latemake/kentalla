# Kentällä

Suomenkielinen jalkapallon peluutussovellus. Ei asennettavia riippuvuuksia.

**Kokeile selaimessa:** https://latemake.github.io/kentalla/

Lisää omat pelaajasi ja luo ottelu. Sovellus ei sisällä automaattisia demopelaajia. Jokaisen käyttäjän tiedot säilyvät hänen omassa selaimessaan; tämä ei ole yhteinen seuratietokanta. Tietokoneen paikallisen version tietoja ei siirretä verkkoversioon automaattisesti.

## Verkkojulkaisu

GitHub Actions suorittaa testit ja julkaisee sovelluksen GitHub Pagesiin jokaisen `main`-haaran päivityksen jälkeen. Julkaisuun kopioidaan vain sovelluksen HTML, CSS, JavaScript ja logot; testiselaimen tiedostot tai käyttäjien tallennustiedot eivät kuulu julkaisuun.

Staattisen julkaisun voi rakentaa myös paikallisesti komennolla `node build-site.mjs`. Valmiit tiedostot ovat `_site`-kansiossa. GitHub-repositorion Pages-asetuksissa lähteeksi valitaan **GitHub Actions**.

## Käynnistys

Voit avata sovelluksen suoraan kaksoisnapsauttamalla `index.html`-tiedostoa. Mukana oleva `browser.js` toimii ilman palvelinta. Selaimen tallennustila on erillinen tiedostosta ja localhost-osoitteesta avattaessa.

Vaihtoehtoisesti käynnistä paikallinen palvelin:

```sh
npm start
```

Avaa http://localhost:3000. Vaatii Node.js 20 tai uudemman. Testit: `npm test`.

Jos Windows PowerShell estää npm-komennon, käytä `npm.cmd start` ja `npm.cmd test` tai käynnistä suoraan `node server.js`.

Kehitys: muokkaa tiedostoja `app.js` ja `engine.js`, ja suorita `node build.js` päivittääksesi selaimen käyttämän `browser.js`-tiedoston. Palvelimen käynnistys tekee tämän automaattisesti.

## Käyttö

- Sovellus alkaa tyhjästä. Lisää oman joukkueesi pelaajat Pelaajat-näkymässä. Kun pelaajia on vähintään viisi, voit luoda ottelun.
- Pelimuodot 5v5, 7v7, 8v8 ja 11v11; kokoonpano muokataan kentällä pelaajaa painamalla.
- Aseta kokonaispeliaika ja jaksojen määrä. Esimerkiksi 50 minuuttia ja kaksi jaksoa tarkoittaa 2 × 25 minuuttia. Kello pysähtyy jaksotauolle; seuraava jakso aloitetaan erikseen. Alaspäin laskeva kello näyttää jäljellä olevan jaksoajan, ylöspäin laskeva kokonaispeliajan.
- Tasainen peluutus ehdottaa vaihtoryhmää: vähiten pelanneet penkiltä eniten pelanneiden tilalle. Ryhmän koon voi myös rajoittaa asetuksista. Maalivahti on oletuksena kiinteä, ja hänet voi ottaa kiertoon asetuksista.
- Painotetussa peluutuksessa tavoiteosuudet lasketaan pelaajien painoista ja kentän kapasiteetista. Kukaan ei voi saada yli täyttä ottelua peliaikaa. Ehdotus suosii pelaajia, jotka ovat jäljessä seuraavan vaihtovälin tavoitteesta. Pelaajien soveltuvuutta pelipaikoille ei arvioida automaattisesti.
- Vaihdot vahvistetaan käsin. Valitse pelaajat -painikkeesta voi muuttaa useita vaihtoja samassa lomakkeessa. Sama pelaaja ei voi tulla kahteen paikkaan. Ennen aloitusta tehdyt kokoonpanomuutokset eivät näy raportissa ottelun aikaisina vaihtoina.
- Peruuta viimeisin muutos palauttaa edellisen kokoonpanon ja kohdistaa muutoksen jälkeiset peliminuutit takaisin alkuperäisille pelaajille. Peruminen toimii myös sivun uudelleenlatauksen jälkeen, mutta ei ottelun päätyttyä. Asetusten tallennus tyhjentää perumishistorian.
- Osallistujat-painikkeella voi merkitä loukkaantuneen pelaajan pois käytöstä, palauttaa hänet tai lisätä saapuneen pelaajan penkille. Pois merkityn kenttäpelaajan paikalle jää tyhjä paikka, jonka voi täyttää kenttänäkymässä. Minuutteja ei lasketa tyhjälle paikalle.
- Tauko pysäyttää ajan. Ottelu päättyy viimeisen jakson ajan täyttyessä tai Lopeta-painikkeella. Jaksotus lukitaan ottelun alettua.
- Raportit tallentuvat selaimen localStorageen ja voi viedä CSV-tiedostoksi.

Kello käyttää sivun ollessa auki monotonista aikaa, ja sivun uudelleenlatauksessa jatkaa tallennetun aikaleiman perusteella korkeintaan jakson loppuun. Jaksotauko ei koskaan muutu automaattisesti seuraavaksi jaksoksi. Eri välilehdessä muutetut tiedot pysäyttävät vanhan näkymän muokkauksen ja tarjoavat uusimman tilanteen lataamisen.

Sovellus pyytää näytön päälläpitoa kellon käydessä. Ominaisuuden voi poistaa asetuksista. Jos selain tai laite ei salli sitä, ottelunäkymä pyytää varmistamaan näytön päälläpysymisen itse. Taustalla selain voi viivästyttää hälytyksiä. Testaa ääni asetuksista ennen peliä. Toteutuksen pohjana: [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

Tämä on paikallinen MVP: ei käyttäjätilejä, pilvitallennusta tai laitteiden välistä seurasynkronointia. Selaintietojen poistaminen poistaa tallennetut ottelut. Vie raportit talteen pitkäaikaista säilytystä varten. Sovellus käyttää paikallisia kuvia ja järjestelmäfontteja.

## Testaus

`node --test` suorittaa laskentalogiikan testit, mukaan lukien 192 kokonaista 60 minuutin ottelusimulaatiota. Selaintestit vaativat erillisen testiselaimen Chrome DevTools -porttiin 9222 ja paikallisen palvelimen porttiin 3000. Ne käyttävät ja tyhjentävät tämän testiselaimen sovellustiedot, joten älä aja niitä henkilökohtaisessa selainprofiilissa.

- `node browser-check.mjs`: käyttöliittymän perustoiminnot ja mobiiliasettelu.
- `node field-check.mjs`: nopeutettu kokonainen ottelu, ryhmävaihdot, peruminen, loukkaantuminen, saapuminen, jaksotus ja raportti.
- `node resilience-check.mjs`: uudelleenlataus, alaspäin laskeva kello, jaksotauon palautuminen ja ristiriidat kahden välilehden välillä.
- `node onboarding-check.mjs`: tyhjä aloitus, omien pelaajien lisääminen, vanhojen demojen poisto sekä omien pelaajien ja raporttien säilyminen.
- `node startup-check.mjs http://localhost:3000 --assert`: oikeat hiiren klikkaukset. URL:n voi korvata absoluuttisella file-osoitteella.

Tarkemmat tulokset ja testauksen rajat ovat tiedostossa `TESTAUS.md`.
