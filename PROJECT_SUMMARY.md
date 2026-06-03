# StellarCourier — Proje Özeti

## Ne Yapıyor?
Blockchain tabanlı **güvenli kargo/teslimat protokolü**. Gönderen parayı (USDC) bir akıllı sözleşmeye kilitler; kurye teslim edip alıcının QR'ını taradığında para otomatik açılır. Teslimat olmazsa para gönderene iade edilir. Ortada banka/platform yok — **Stellar Soroban escrow** hakem rolünü oynar.

## Çözdüğü Sorun
Geleneksel kargo ödemelerinde "param kuryeye/platforma güvenli mi?" sorunu vardır. Burada para ne kuryede ne platformda — akıllı sözleşmede kilitli. Güven sorunu ve komisyon riski ortadan kalkar.

---

## Roller & Akış

| Rol | Sayfa | Akış |
|-----|-------|------|
| **Gönderen** | `/send` | Haritada A→B seç → tutar gir → kurye seç → USDC kilitlenir → alıcıya WhatsApp linki |
| **Kurye** | `/courier` | Araç+plaka kaydı → yakındaki paketleri gör → kabul et → QR tara → para cüzdana |
| **Alıcı** | `/receive` | Linki aç → QR'ı kuryeye göster → teslimat onayı |

---

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Frontend | SvelteKit + Svelte 5 (runes) |
| Blockchain | Stellar Soroban (escrow contract) |
| Token | USDC (testnet) |
| Auth | Supabase + Google OAuth |
| Database | Supabase PostgreSQL |
| Harita | Leaflet (İstanbul) |
| Cüzdan | Kullanıcı ID'sinden deterministik üretilen Stellar keypair (testnet/demo) |

---

## Otonom Agent Sistemi (9 adet)

Arka planda sürekli çalışan otomatik karar vericiler. Kullanıcı müdahalesi olmadan fiyatlandırma, güvenlik, eşleştirme ve iade işlerini yönetir.

| # | Agent | Periyot | Görev |
|---|-------|---------|-------|
| 1 | **CourierAgent** | 30s | Talep + hava + saat → dinamik fiyatlandırma (surge) |
| 2 | **Dispatcher** | 10s | En yakın/uygun kuryeyi otomatik atar (mesafe+yük+puan skoru) |
| 3 | **ExpiryGuardian** | 60s | Teslimat süresini izler, dolmadan uyarır |
| 4 | **GeoFence** | 15s | Kurye teslim bölgesinden çıkarsa alarm verir |
| 5 | **AutoRefundBot** | 60s | Süresi dolan escrow'u otomatik iade eder |
| 6 | **MultiHopRouter** | 45s | USDC yoksa DEX'ten otomatik swap yapar |
| 7 | **Analytics** | 30s | Teslimat istatistikleri (başarı oranı, hacim) |
| 8 | **EventIndexer** | 10s | Soroban contract olaylarını indeksler |
| 9 | **ReputationScorer** | 60s | Kurye puanlama; düşük puanlıyı askıya alır |

---

## Veritabanı Şeması

- **users** — profil (ad, telefon, cinsiyet, doğum tarihi, stellar_address)
- **couriers** — araç, km ücreti, güven skoru, rating, kazanç, konum
- **courier_vehicles** — plaka, marka, model, yıl, renk
- **deliveries** — gönderen, kurye, koordinatlar, tutar, durum, escrow contract
- **agent_logs** — agent log kayıtları
- **fraud_events** — FraudDetector tespitleri

---

## Öne Çıkan Özellikler
- 🌐 TR/EN dil değiştirme (navbar butonu)
- 📍 "Konumdan Teslim Al" — GPS ile otomatik başlangıç noktası
- 🗺️ Yoğunluk haritası — bölgelere göre kurye dağılımı (kırmızı/sarı/yeşil)
- 📦 Gerçek zamanlı paket akışı (Supabase Realtime)
- ⚡ Dinamik surge fiyatlandırma
- 🔗 Otomatik cüzdan bağlama + hata toleranslı işlem akışı
