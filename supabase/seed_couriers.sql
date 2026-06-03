-- ══════════════════════════════════════════════════════════════════
--  100 seed kurye — İstanbul'un 20 farklı mahallesine yayılmış
--  Supabase SQL Editor'da çalıştır (service role erişimi gerekli)
-- ══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  uid uuid;
  i   int := 0;
  r   record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- ── Beşiktaş (5) ──────────────────────────────────────────────
    ('Ahmet Yılmaz',    'moto',       41.0425, 29.0059,  8.5, 4.8, 85),
    ('Fatma Kaya',      'car',        41.0432, 29.0048, 12.0, 4.6, 80),
    ('Mehmet Demir',    'moto',       41.0418, 29.0072,  8.0, 4.3, 75),
    ('Zeynep Şahin',    'car',        41.0440, 29.0035, 11.5, 4.9, 90),
    ('Ali Çelik',       'commercial', 41.0415, 29.0081, 17.0, 4.7, 82),
    -- ── Kadıköy (5) ───────────────────────────────────────────────
    ('Ayşe Yıldız',     'moto',       40.9833, 29.0333,  8.5, 4.5, 78),
    ('Mustafa Doğan',   'car',        40.9845, 29.0355, 12.5, 4.2, 72),
    ('Hatice Çetin',    'moto',       40.9820, 29.0315,  7.5, 4.7, 84),
    ('Hasan Arslan',    'car',        40.9858, 29.0372, 13.0, 3.9, 68),
    ('Elif Öztürk',     'moto',       40.9810, 29.0298,  9.0, 4.8, 88),
    -- ── Üsküdar (5) ───────────────────────────────────────────────
    ('Hüseyin Aydın',   'moto',       41.0231, 29.0154,  8.0, 4.4, 76),
    ('Merve Özdemir',   'car',        41.0245, 29.0168, 11.0, 4.6, 81),
    ('İbrahim Erdoğan', 'moto',       41.0218, 29.0140,  8.5, 4.1, 70),
    ('Selin Koç',       'moto',       41.0256, 29.0182,  9.0, 4.9, 92),
    ('Ömer Kurt',       'car',        41.0208, 29.0125, 12.0, 4.3, 74),
    -- ── Fatih (5) ─────────────────────────────────────────────────
    ('Yusuf Güneş',     'moto',       41.0186, 28.9408,  7.5, 4.2, 73),
    ('Büşra Polat',     'moto',       41.0198, 28.9422,  8.0, 4.7, 83),
    ('Murat Kılıç',     'car',        41.0172, 28.9392, 11.5, 4.0, 69),
    ('Gül Acar',        'moto',       41.0210, 28.9438,  8.5, 4.5, 79),
    ('Kemal Bulut',     'commercial', 41.0162, 28.9378, 16.5, 4.6, 81),
    -- ── Beyoğlu (5) ───────────────────────────────────────────────
    ('Osman Yılmaz',    'car',        41.0342, 28.9771, 12.0, 4.7, 84),
    ('Esra Kaya',       'moto',       41.0355, 28.9785,  8.5, 4.8, 87),
    ('Emre Demir',      'moto',       41.0328, 28.9758,  8.0, 4.3, 75),
    ('Pınar Şahin',     'car',        41.0368, 28.9798, 13.0, 4.5, 80),
    ('Burak Çelik',     'moto',       41.0315, 28.9742,  7.5, 4.1, 70),
    -- ── Şişli (5) ─────────────────────────────────────────────────
    ('Serkan Yıldız',   'car',        41.0602, 28.9877, 12.5, 4.6, 82),
    ('Derya Doğan',     'moto',       41.0615, 28.9892,  8.5, 4.8, 88),
    ('Fatih Çetin',     'moto',       41.0588, 28.9862,  8.0, 4.2, 73),
    ('Canan Arslan',    'car',        41.0628, 28.9908, 11.5, 4.9, 91),
    ('Caner Öztürk',    'commercial', 41.0575, 28.9848, 18.0, 4.4, 77),
    -- ── Bakırköy (5) ──────────────────────────────────────────────
    ('Enes Aydın',      'moto',       40.9819, 28.8738,  7.5, 4.3, 75),
    ('Sevgi Özdemir',   'car',        40.9832, 28.8752, 11.0, 4.7, 83),
    ('Berkay Erdoğan',  'moto',       40.9806, 28.8724,  8.0, 4.1, 70),
    ('Sibel Koç',       'moto',       40.9845, 28.8766,  8.5, 4.8, 87),
    ('Onur Kurt',       'car',        40.9793, 28.8710, 12.5, 4.0, 68),
    -- ── Maltepe (5) ───────────────────────────────────────────────
    ('Volkan Güneş',    'car',        40.9335, 29.1317, 12.0, 4.5, 79),
    ('Yasemin Polat',   'moto',       40.9348, 29.1332,  8.5, 4.7, 84),
    ('Tolga Kılıç',     'moto',       40.9322, 29.1302,  8.0, 4.2, 73),
    ('Şeyma Acar',      'car',        40.9362, 29.1348, 11.5, 4.9, 90),
    ('Barış Bulut',     'commercial', 40.9308, 29.1285, 17.0, 4.6, 82),
    -- ── Ataşehir (5) ──────────────────────────────────────────────
    ('Arda Yılmaz',     'moto',       40.9908, 29.1181,  8.5, 4.4, 77),
    ('Tuğba Kaya',      'car',        40.9922, 29.1196, 12.0, 4.8, 88),
    ('Selçuk Demir',    'moto',       40.9894, 29.1166,  8.0, 4.1, 70),
    ('Özlem Şahin',     'moto',       40.9936, 29.1212,  9.0, 4.7, 85),
    ('Kadir Çelik',     'car',        40.9880, 29.1150, 13.0, 4.3, 75),
    -- ── Sarıyer (5) ───────────────────────────────────────────────
    ('Cemal Yıldız',    'moto',       41.1666, 29.0567,  8.5, 4.6, 81),
    ('Nuray Doğan',     'car',        41.1680, 29.0582, 12.5, 4.8, 88),
    ('Ercan Çetin',     'moto',       41.1652, 29.0552,  8.0, 4.3, 74),
    ('Müge Arslan',     'moto',       41.1694, 29.0598,  8.5, 4.9, 92),
    ('Gökhan Öztürk',   'commercial', 41.1638, 29.0535, 18.5, 4.5, 80),
    -- ── Ümraniye (5) ──────────────────────────────────────────────
    ('Haluk Aydın',     'moto',       41.0166, 29.1000,  8.0, 4.2, 73),
    ('Lale Özdemir',    'car',        41.0180, 29.1015, 11.5, 4.7, 84),
    ('İlhan Erdoğan',   'moto',       41.0152, 29.0985,  8.5, 4.4, 77),
    ('Kübra Koç',       'moto',       41.0194, 29.1030,  9.0, 4.8, 89),
    ('Kamil Kurt',      'car',        41.0138, 29.0970, 12.0, 4.0, 68),
    -- ── Pendik (5) ────────────────────────────────────────────────
    ('Levent Güneş',    'moto',       40.8774, 29.2313,  7.5, 4.3, 75),
    ('Jale Polat',      'car',        40.8788, 29.2328, 12.0, 4.6, 81),
    ('Nuri Kılıç',      'moto',       40.8760, 29.2298,  8.0, 4.1, 70),
    ('İrem Acar',       'moto',       40.8802, 29.2344,  8.5, 4.8, 87),
    ('Okan Bulut',      'commercial', 40.8746, 29.2282, 16.0, 4.5, 79),
    -- ── Kartal (5) ────────────────────────────────────────────────
    ('Salih Yılmaz',    'car',        40.9085, 29.1903, 12.0, 4.4, 77),
    ('Hanım Kaya',      'moto',       40.9098, 29.1918,  8.5, 4.7, 84),
    ('Tarık Demir',     'moto',       40.9072, 29.1888,  8.0, 4.2, 73),
    ('Gülay Şahin',     'car',        40.9112, 29.1934, 11.5, 4.9, 91),
    ('Ümit Çelik',      'commercial', 40.9058, 29.1872, 17.5, 4.6, 82),
    -- ── Bağcılar (5) ──────────────────────────────────────────────
    ('Veli Yıldız',     'moto',       41.0392, 28.8558,  7.5, 4.1, 70),
    ('Filiz Doğan',     'moto',       41.0405, 28.8572,  8.0, 4.6, 81),
    ('Yasin Çetin',     'car',        41.0378, 28.8543, 12.0, 4.3, 74),
    ('Ebru Arslan',     'moto',       41.0418, 28.8588,  8.5, 4.8, 88),
    ('Zeki Öztürk',     'commercial', 41.0364, 28.8528, 18.0, 4.4, 77),
    -- ── Gaziosmanpaşa (5) ─────────────────────────────────────────
    ('Alpay Aydın',     'moto',       41.0666, 28.9119,  8.0, 4.2, 73),
    ('Ceyda Özdemir',   'car',        41.0680, 28.9134, 11.5, 4.7, 84),
    ('Berk Erdoğan',    'moto',       41.0652, 28.9104,  8.5, 4.4, 77),
    ('Berna Koç',       'moto',       41.0694, 28.9150,  9.0, 4.8, 89),
    ('Cem Güneş',       'car',        41.0638, 28.9088, 12.5, 4.0, 68),
    -- ── Kağıthane (5) ─────────────────────────────────────────────
    ('Deniz Polat',     'moto',       41.0833, 28.9833,  8.0, 4.3, 75),
    ('Azra Kılıç',      'car',        41.0848, 28.9848, 12.0, 4.7, 84),
    ('Erdem Acar',      'moto',       41.0818, 28.9818,  8.5, 4.5, 80),
    ('Aysun Bulut',     'moto',       41.0862, 28.9862,  9.0, 4.9, 92),
    ('Furkan Yılmaz',   'commercial', 41.0804, 28.9804, 17.0, 4.6, 82),
    -- ── Avcılar (5) ───────────────────────────────────────────────
    ('Güven Kaya',      'moto',       40.9797, 28.7219,  7.5, 4.2, 73),
    ('Arzu Demir',      'car',        40.9811, 28.7234, 11.0, 4.7, 84),
    ('Hamza Şahin',     'moto',       40.9783, 28.7204,  8.0, 4.3, 75),
    ('Aslı Çelik',      'moto',       40.9825, 28.7250,  8.5, 4.8, 88),
    ('İsmet Yıldız',    'car',        40.9769, 28.7188, 12.5, 4.0, 68),
    -- ── Küçükçekmece (5) ──────────────────────────────────────────
    ('Hakan Doğan',     'car',        40.9799, 28.7789, 12.0, 4.4, 77),
    ('Asel Çetin',      'moto',       40.9813, 28.7804,  8.5, 4.7, 84),
    ('Rıza Arslan',     'moto',       40.9785, 28.7774,  8.0, 4.2, 73),
    ('Arin Öztürk',     'car',        40.9827, 28.7820, 11.5, 4.9, 91),
    ('Soner Aydın',     'commercial', 40.9771, 28.7758, 16.5, 4.5, 79),
    -- ── Esenyurt (5) ──────────────────────────────────────────────
    ('Taner Özdemir',   'moto',       41.0325, 28.6758,  7.5, 4.1, 70),
    ('Didem Erdoğan',   'moto',       41.0338, 28.6772,  8.0, 4.6, 81),
    ('Uğur Koç',        'car',        41.0312, 28.6743, 12.0, 4.3, 74),
    ('Ala Güneş',       'moto',       41.0352, 28.6788,  8.5, 4.8, 88),
    ('Vedat Polat',     'commercial', 41.0298, 28.6727, 18.0, 4.4, 77),
    -- ── Başakşehir (5) ────────────────────────────────────────────
    ('Yavuz Kılıç',     'moto',       41.0798, 28.7995,  8.0, 4.3, 75),
    ('Zafer Acar',      'car',        41.0812, 28.8010, 12.0, 4.7, 84),
    ('Metin Bulut',     'moto',       41.0784, 28.7980,  8.5, 4.5, 80),
    ('Sami Yılmaz',     'commercial', 41.0768, 28.7964, 17.0, 4.6, 82),
    ('Sibel Kaya',      'car',        41.0826, 28.8026, 11.5, 4.9, 91)
  ) AS t(full_name, vehicle, lat, lng, price_per_km, rating, trust_score)
  LOOP
    i   := i + 1;
    uid := gen_random_uuid();

    -- auth.users (minimum alanlar — service role ile çalışır)
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data
    ) VALUES (
      uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'courier' || lpad(i::text, 3, '0') || '@seed.dev',
      now(), now(), now(),
      jsonb_build_object('full_name', r.full_name),
      '{"provider":"email","providers":["email"]}'
    ) ON CONFLICT DO NOTHING;

    -- public.users
    INSERT INTO public.users (id, email, name, stellar_address)
    VALUES (
      uid,
      'courier' || lpad(i::text, 3, '0') || '@seed.dev',
      r.full_name,
      'GSEED' || lpad(i::text, 51, '0')   -- placeholder Stellar adresi
    ) ON CONFLICT (id) DO NOTHING;

    -- public.couriers (active=true, konum set)
    INSERT INTO public.couriers (
      id, vehicle, price_per_km, rating, trust_score,
      active, suspended, location
    ) VALUES (
      uid,
      r.vehicle,
      r.price_per_km,
      r.rating,
      r.trust_score,
      true,
      false,
      jsonb_build_object('lat', r.lat, 'lng', r.lng)
    ) ON CONFLICT (id) DO NOTHING;

  END LOOP;

  RAISE NOTICE '% kurye başarıyla eklendi.', i;
END;
$$;
