# Helios Gözlemevi · Etkileşimli Tellurion & Güneş Sistemi

**Canlı Demo:** [https://serdarsoylu06.github.io/helios-gozlemevi/](https://serdarsoylu06.github.io/helios-gozlemevi/)

Vite, TypeScript ve Three.js ile geliştirilmiş; gerçek Kepler eliptik yörüngeleri, NASA 2K uydu dokuları, özel GLSL shader'ları ve etkileşimli astronomi araçlarını bir araya getiren 3D gözlemevi ve Tellurion simülatörü.

## Özellikler

- **3 Görüntüleme Modu:**
  - **Tellurion (Gözlemevi):** Yüzen ekliptik takvim/mevsim diski, 5.145° eğik Ay yörünge halkası ve düğüm noktaları.
  - **Tüm Güneş Sistemi:** 8 gezegenin gerçek dışmerkezlik ve eğiklikli Kepler yörüngeleri, parlayan yörünge kuyrukları, 1.200 asteroitli kuşak ve Jüpiter'in 4 Galilei uydusu (Io, Europa, Ganymede, Callisto).
  - **Boyut Karşılaştırması (109x):** Gezegenlerin ve Güneş'in gerçek çap oranlarını yan yana gösteren sergi dizilimi.
- **Gerçekçi 3D & Özel GLSL Shader'lar:**
  - NASA 2K Dünya uydu görüntüsü, okyanus parlaması, dönen bulut katmanı, Rayleigh atmosfer halesi, gece kıta şehir ışıkları, alacakaranlık şeridi ve canlı Kutup Işıkları (Aurora Borealis & Australis).
  - 3D gürültülü dinamik Güneş plazma fotosferi, plazma kemerleri, korona halesi ve seçici `UnrealBloomPass`.
  - Satürn halkaları üzerinde gerçek zamanlı gezegen gölgesi ve Uranüs'ün dikey buz halkaları.
  - Güneş tutulmasında Dünya yüzeyine düşen gerçek Ay gölgesi + 3D umbra/penumbra konisi; Ay tutulmasında Kanlı Ay (bakır kızılı) efekti.
- **Eğitsel & Etkileşimli Araçlar:**
  - Gerçek tarih/saat (`UTC`) seçici, `Şu An` canlı düğmesi, ekinoks/gündönümü/tutulma hızlı atlama butonları.
  - Dünya üzerinde serbest tıklamayla özel enlem/boylam pini, canlı gündüz süresi & öğle Güneş yüksekliği SVG yayı, 90° dik ışın noktası, paralel Güneş ışını okları ve `K`/`G` kutup işaretleri.
  - 5 adımlı **Rehberli Tur**, **Yüzeyden Bakış (Pin)** kamerası ve **`H`** tuşuyla tam ekran Sunum / Planetaryum modu.

## Kurulum & Geliştirme

```bash
npm install
npm run dev      # Geliştirme sunucusu (http://127.0.0.1:5173)
npm test         # Astronomi & Kepler birim testleri (Vitest)
npm run build    # TypeScript kontrolü ve üretim derlemesi
```

## Klavye Kısayolları

| Tuş | İşlev |
| --- | --- |
| `Space` | Oynat / Duraklat |
| `←` / `→` | ±1 Gün (`Shift` ile ±15 Gün) |
| `1` / `2` / `3` | Tellurion / Güneş Sistemi / Boyut (109x) |
| `H` | Sunum / Planetaryum Modu (Arayüzü gizle/göster) |
| `Esc` | Sunum modundan veya Rehberli Tur'dan çık |
