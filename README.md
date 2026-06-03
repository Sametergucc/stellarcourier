# StellarCourier

Blockchain tabanlı güvenli kargo ve teslimat protokolü. Gönderen USDC’yi Stellar Soroban escrow sözleşmesine kilitler; kurye teslim edip alıcının QR kodunu taradığında ödeme otomatik serbest kalır. Teslimat gerçekleşmezse fonlar gönderene iade edilir — arada banka veya platform yok.

**Repo:** [github.com/Sametergucc/stellarcourier](https://github.com/Sametergucc/stellarcourier)

---

## Sorun & Çözüm

Geleneksel kargo ödemelerinde “param kuryeye veya platforma güvenli mi?” sorusu vardır. StellarCourier’da para ne kuryede ne platformda tutulur; akıllı sözleşmede kilitlidir. Güven riski ve gereksiz komisyon baskısı azalır.

---

## Roller & Akış

| Rol | Sayfa | Akış |
|-----|-------|------|
| **Gönderen** | `/send` | Haritada A→B seç → tutar gir → kurye seç → USDC kilitlenir → alıcıya WhatsApp linki |
| **Kurye** | `/courier` | Araç + plaka kaydı → yakındaki paketleri gör → kabul et → QR tara → ödeme cüzdana |
| **Alıcı** | `/receive` | Linki aç → QR’ı kuryeye göster → teslimat onayı |

---

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Frontend | SvelteKit + Svelte 5 (runes) |
| Blockchain | Stellar Soroban (escrow contract) |
| Token | USDC (testnet) |
| Auth | Supabase + Google OAuth |
| Veritabanı | Supabase PostgreSQL |
| Harita | Leaflet (İstanbul) |
| Cüzdan | Kullanıcı ID’sinden deterministik Stellar keypair (testnet / demo) |

---

## Otonom Agent Sistemi

Arka planda çalışan 9 agent; fiyatlandırma, eşleştirme, güvenlik ve iade süreçlerini kullanıcı müdahalesi olmadan yönetir.

| # | Agent | Periyot | Görev |
|---|-------|---------|-------|
| 1 | **CourierAgent** | 30s | Talep + hava + saat → dinamik surge fiyatlandırma |
| 2 | **Dispatcher** | 10s | En yakın / uygun kuryeyi otomatik atama (mesafe + yük + puan) |
| 3 | **ExpiryGuardian** | 60s | Teslimat süresini izleme, süre dolmadan uyarı |
| 4 | **GeoFence** | 15s | Kurye teslim bölgesinden çıkınca alarm |
| 5 | **AutoRefundBot** | 60s | Süresi dolan escrow’u otomatik iade |
| 6 | **MultiHopRouter** | 45s | USDC yoksa DEX üzerinden otomatik swap |
| 7 | **Analytics** | 30s | Teslimat istatistikleri (başarı oranı, hacim) |
| 8 | **EventIndexer** | 10s | Soroban contract olaylarını indeksleme |
| 9 | **ReputationScorer** | 60s | Kurye puanlama; düşük puanlıları askıya alma |

---

## Veritabanı

`supabase/schema.sql` ile kurulur:

- **users** — profil (ad, telefon, cinsiyet, doğum tarihi, `stellar_address`)
- **couriers** — araç, km ücreti, güven skoru, rating, kazanç, konum
- **courier_vehicles** — plaka, marka, model, yıl, renk
- **deliveries** — gönderen, kurye, koordinatlar, tutar, durum, escrow contract
- **agent_logs** — agent log kayıtları
- **fraud_events** — FraudDetector tespitleri

---

## Öne Çıkan Özellikler

- TR / EN dil değiştirme (navbar)
- “Konumdan Teslim Al” — GPS ile otomatik başlangıç noktası
- Yoğunluk haritası — bölgesel kurye dağılımı (kırmızı / sarı / yeşil)
- Gerçek zamanlı paket akışı (Supabase Realtime)
- Dinamik surge fiyatlandırma
- Otomatik cüzdan bağlama ve hata toleranslı işlem akışı

---

## Proje Yapısı

```
stellarcourier/
├── contracts/escrow/     # Soroban escrow sözleşmesi (Rust)
├── frontend/             # SvelteKit uygulaması
├── packages/escrow-client/
├── scripts/              # testnet deploy, e2e, bindings
└── supabase/             # şema ve seed SQL
```

---

## Hızlı Başlangıç

### 1. Testnet & contract

```bash
./scripts/setup-testnet.sh
```

Contract deploy ve binding üretimi için `scripts/deploy.sh` ve `scripts/generate-bindings.sh` kullanılır.

### 2. Supabase

`supabase/schema.sql` dosyasını Supabase SQL editöründe çalıştırın. Gerekirse `patch_rls.sql`, `patch_stellar_address.sql` ve `seed_couriers.sql` dosyalarını uygulayın.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_* değişkenlerini setup-testnet çıktısına göre doldurun
npm run dev
```

`.env.example` içinde escrow contract ID, USDC contract, OpenWeather ve (sunucu tarafı) Twilio alanları tanımlıdır.

---

## Lisans

Bu depo hackathon / demo amaçlı geliştirilmiştir. Üretim kullanımı için güvenlik denetimi ve ana ağ yapılandırması gerekir.
