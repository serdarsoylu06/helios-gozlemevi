# Helios Gözlemevi v3.0 · Etkileşimli Tellurion & Güneş Sistemi

**Canlı Demo:** [https://serdarsoylu06.github.io/helios-gozlemevi/](https://serdarsoylu06.github.io/helios-gozlemevi/)

Vite, TypeScript ve Three.js ile geliştirilmiş; gerçek Kepler eliptik yörüngeleri, 2K gezegen & NASA Black Marble uydu dokuları, özel GLSL shader'ları, gerçek gökyüzü takımyıldız kataloğu ve minimalist gözlemevi arayüzünü bir araya getiren 3D planetaryum ve Tellurion simülatörü.

## Özellikler (v3.0)

- **3 Görüntüleme Modu:**
  - **Tellurion (Gözlemevi):** Şeffaf cam-altın **Holografik Usturlap (Astrolabe)** ekliptik takvim halkası, 5.145° eğik Ay yörünge halkası, düğüm noktaları ve Dünya çevresinde 51.6° eğiklikle dönen minyatür **ISS (Uluslararası Uzay İstasyonu)**.
  - **Tüm Güneş Sistemi:** 8 gezegenin gerçek dışmerkezlik ve eğiklikli Kepler yörüngeleri, parlayan yörünge kuyrukları, 1.200 asteroitli kuşak, Jüpiter'in 4 Galilei uydusu (Io, Europa, Ganymede, Callisto) ve Güneş'ten ters yöne uzanan çift kuyruklu (iyon + toz) **Halley Kuyruklu Yıldızı**.
  - **Boyut Karşılaştırması (109x):** Gezegenlerin ve Güneş'in gerçek çap oranlarını yan yana gösteren sergi dizilimi.
- **Gerçekçi 3D & Özel GLSL Shader'lar:**
  - NASA 2K Dünya uydu görüntüsü, **normal map dağ/kıta kabartması**, dönen bulut katmanı ve **yüzeye düşen yumuşak bulut gölgeleri**, Rayleigh gün batımı saçılması, gerçek **NASA Black Marble** gece şehir ışıkları ve canlı Kutup Işıkları (Aurora Borealis & Australis).
  - Tüm gezegenler için 2K dokular, Satürn halkaları üzerinde gerçek zamanlı gezegen gölgesi ve Uranüs'ün dikey buz halkaları.
  - 3D gürültülü dinamik Güneş plazma fotosferi, plazma kemerleri, korona halesi, Fresnel yumuşatmalı hacimsel ışık huzmesi ve seçici `UnrealBloomPass`.
  - Gerçek J2000 RA/Dec koordinatlı 14 ana & Zodyak takımyıldızı katmanı ve yüksek detaylı Samanyolu gökyüzü.
  - Güneş tutulmasında Dünya yüzeyine düşen gerçek Ay gölgesi + 3D umbra/penumbra konisi; Ay tutulmasında Kanlı Ay efekti.
- **Pro-Grade Minimalist Gözlemevi Arayüzü:**
  - İlk açılışta ekranın ~%85'ini uzaya bırakan ince sol ikon şeridi + tek açılır sekmeli cam çekmece (`Efemeris`, `Konum & Pin`, `Gök Cismi`, `Katmanlar & Kamera`).
  - Reticle (hedef halkası) tarzı 3D gezegen etiketleri ve cubic ease-in-out sinematik kamera uçuşları.
  - **`Ctrl+K` / `⌘K` Hızlı Arama & Komut Paleti** (gezegen, şehir, 2026–2030 tutulmaları ve modlar arasında anlık uçuş).
  - Tek tıkla sol alt köşede tarih/mod damgalı **Yüksek Çözünürlüklü PNG Ekran Görüntüsü**.
  - 5 adımlı **Rehberli Tur**, **Yüzeyden Bakış (Pin)** kamerası ve **`H`** tuşuyla tam ekran Sunum / Planetaryum modu.

## Kurulum & Geliştirme

```bash
npm install
npm run dev      # Geliştirme sunucusu (http://127.0.0.1:5173)
npm test         # Astronomi, Kepler & takımyıldız birim testleri (Vitest)
npm run build    # TypeScript kontrolü ve üretim derlemesi
```

## Klavye Kısayolları

| Tuş | İşlev |
| --- | --- |
| `Ctrl+K` / `⌘K` | Hızlı Arama & Komut Paleti |
| `Space` | Oynat / Duraklat |
| `←` / `→` | ±1 Gün (`Shift` ile ±15 Gün) |
| `1` / `2` / `3` | Tellurion / Güneş Sistemi / Boyut (109x) |
| `H` | Sunum / Planetaryum Modu (Arayüzü gizle/göster) |
| `Esc` | Komut paletinden, Sunum modundan, Tur'dan veya çekmeceden çık |
