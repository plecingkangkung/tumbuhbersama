// Ringkasan pilihan kemampuan; bukan instrumen skrining atau terjemahan resmi.
// IDs remain stable to preserve saved observations.
const raw = [
  [
    1,
    "https://www.healthychildren.org/English/ages-stages/baby/Pages/Developmental-Milestones-1-Month.aspx",
    {
      "Gerak tubuh": [
        "Mendekatkan tangan ke area mulut atau mata.",
        "Menoleh ke samping saat tengkurap dalam keadaan terjaga dan diawasi.",
      ],
      "Penglihatan & pendengaran": [
        "Memperhatikan wajah dari jarak sekitar 20–30 cm.",
        "Bereaksi terhadap suara keras.",
        "Kadang menoleh ke suara yang dikenalnya.",
      ],
    },
  ],
  [
    2,
    "2-months",
    {
      "Sosial & emosi": [
        "Lebih tenang saat diajak bicara atau digendong.",
        "Memperhatikan wajah orang tua.",
        "Tersenyum saat diajak bicara atau diberi senyuman.",
      ],
      Komunikasi: [
        "Mengeluarkan suara selain tangisan.",
        "Bereaksi terhadap suara keras.",
      ],
      "Belajar & berpikir": [
        "Mengamati orang yang bergerak.",
        "Memperhatikan mainan selama beberapa detik.",
      ],
      "Gerak tubuh": [
        "Mengangkat kepala saat tengkurap.",
        "Menggerakkan kedua lengan dan tungkai.",
        "Membuka telapak tangan sebentar.",
      ],
    },
  ],
  [
    4,
    "4-months",
    {
      "Sosial & emosi": [
        "Tersenyum sendiri untuk menarik perhatian.",
        "Tertawa kecil ketika diajak bercanda.",
      ],
      Komunikasi: [
        "Mengeluarkan suara seperti “ooo” atau “aaa”.",
        "Membalas suara saat diajak berbicara.",
        "Menoleh ke arah suara orang tua.",
      ],
      "Belajar & berpikir": ["Memperhatikan tangannya dengan tertarik."],
      "Gerak tubuh": [
        "Menahan kepala dengan stabil saat digendong.",
        "Memegang mainan yang diletakkan di tangannya.",
        "Membawa tangan ke mulut.",
        "Bertumpu pada siku saat tengkurap.",
      ],
    },
  ],
  [
    6,
    "6-months",
    {
      "Sosial & emosi": [
        "Mengenali orang yang akrab.",
        "Tertawa.",
        "Senang melihat bayangannya di cermin.",
      ],
      Komunikasi: [
        "Bergantian bersuara dengan orang tua.",
        "Membuat suara mencicit atau pekikan.",
      ],
      "Belajar & berpikir": [
        "Meraih mainan yang diinginkan.",
        "Menutup bibir saat tidak ingin makan lagi.",
      ],
      "Gerak tubuh": [
        "Berguling dari tengkurap ke telentang.",
        "Mengangkat tubuh dengan lengan lurus saat tengkurap.",
        "Duduk dengan tangan sebagai penopang.",
      ],
    },
  ],
  [
    9,
    "9-months",
    {
      "Sosial & emosi": [
        "Menoleh ketika namanya dipanggil.",
        "Tersenyum atau tertawa saat bermain cilukba.",
        "Menunjukkan beberapa ekspresi wajah.",
      ],
      Komunikasi: [
        "Mengoceh berulang, misalnya “mamama” atau “bababa”.",
        "Mengangkat lengan untuk meminta digendong.",
      ],
      "Belajar & berpikir": [
        "Mencari benda yang jatuh dari pandangan.",
        "Membenturkan dua benda satu sama lain.",
      ],
      "Gerak tubuh": [
        "Beralih ke posisi duduk sendiri.",
        "Duduk tanpa penopang.",
        "Memindahkan benda dari satu tangan ke tangan lain.",
      ],
    },
  ],
  [
    12,
    "1-year",
    {
      "Sosial & emosi": [
        "Bermain permainan interaktif, misalnya tepuk tangan bersama.",
      ],
      Komunikasi: [
        "Melambaikan tangan untuk berpamitan.",
        "Memanggil orang tua dengan sebutan khusus.",
        "Berhenti sebentar ketika mendengar larangan “tidak”.",
      ],
      "Belajar & berpikir": [
        "Memasukkan benda ke wadah.",
        "Mencari benda yang dilihatnya disembunyikan.",
      ],
      "Gerak tubuh": [
        "Menarik tubuh untuk berdiri.",
        "Berjalan sambil berpegangan pada perabot.",
        "Menjepit benda dengan ibu jari dan telunjuk.",
        "Minum dari cangkir yang dipegang orang dewasa.",
      ],
    },
  ],
  [
    15,
    "15-months",
    {
      "Sosial & emosi": [
        "Menunjukkan benda yang disukai kepada orang tua.",
        "Bertepuk tangan saat senang.",
        "Menunjukkan kasih sayang dengan pelukan atau ciuman.",
      ],
      Komunikasi: [
        "Mencoba satu atau dua kata selain panggilan orang tua.",
        "Menunjuk untuk meminta sesuatu atau bantuan.",
        "Mengikuti arahan dengan gabungan kata dan isyarat.",
      ],
      "Belajar & berpikir": [
        "Mencoba menggunakan benda sesuai kegunaannya.",
        "Menumpuk setidaknya dua benda kecil.",
      ],
      "Gerak tubuh": [
        "Melangkah beberapa langkah sendiri.",
        "Mengambil makanan dengan jari untuk makan.",
      ],
    },
  ],
  [
    18,
    "18-months",
    {
      "Sosial & emosi": [
        "Menunjuk untuk memperlihatkan sesuatu yang menarik.",
        "Melihat beberapa halaman buku bersama.",
        "Membantu saat dipakaikan baju.",
      ],
      Komunikasi: [
        "Mencoba setidaknya tiga kata selain panggilan orang tua.",
        "Mengikuti satu arahan tanpa bantuan isyarat.",
      ],
      "Belajar & berpikir": [
        "Meniru pekerjaan rumah sederhana.",
        "Memainkan mainan sesuai fungsi sederhana, seperti mendorong mobil.",
      ],
      "Gerak tubuh": [
        "Berjalan tanpa berpegangan.",
        "Mencoret-coret.",
        "Mencoba menggunakan sendok.",
        "Naik dan turun kursi tanpa bantuan.",
      ],
    },
  ],
  [
    24,
    "2-years",
    {
      "Sosial & emosi": [
        "Memperhatikan saat orang lain sedih atau kesakitan.",
        "Melihat ekspresi orang tua dalam situasi baru.",
      ],
      Komunikasi: [
        "Menggabungkan setidaknya dua kata.",
        "Menunjuk setidaknya dua bagian tubuh ketika diminta.",
        "Menunjuk gambar di buku ketika ditanya.",
      ],
      "Belajar & berpikir": [
        "Memegang wadah dengan satu tangan sambil membuka dengan tangan lain.",
        "Mencoba tombol atau sakelar pada mainan.",
      ],
      "Gerak tubuh": [
        "Menendang bola.",
        "Berlari.",
        "Berjalan menaiki beberapa anak tangga, dengan atau tanpa bantuan.",
        "Makan menggunakan sendok.",
      ],
    },
  ],
];
export const milestoneStages = raw.map(([month, source, groups]) => ({
  month,
  source: source.startsWith("https:")
    ? source
    : `https://www.cdc.gov/act-early/milestones/${source}.html`,
  sourceName: month === 1 ? "AAP / HealthyChildren" : "CDC",
  items: Object.entries(groups).flatMap(([category, texts], g) =>
    texts.map((text, i) => ({ id: `m${month}-${g}-${i}`, category, text })),
  ),
}));
export const milestoneIds = new Set(
  milestoneStages.flatMap((s) => s.items.map((i) => i.id)),
);
export function completedMonths(dob, date) {
  const a = new Date(dob + "T00:00:00Z"),
    b = new Date(date + "T00:00:00Z");
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    b.getUTCMonth() -
    a.getUTCMonth() -
    (b.getUTCDate() < a.getUTCDate() ? 1 : 0)
  );
}
export function stageForAge(months) {
  return milestoneStages.filter((s) => s.month <= months).at(-1)?.month ?? 1;
}
