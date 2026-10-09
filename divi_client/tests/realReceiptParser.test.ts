import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../src/services/receiptParser';

/**
 * Real-receipt regression fixtures.
 *
 * These are intentionally skipped until the expected values have been
 * reviewed against the source photos. The text is a hand-transcribed,
 * OCR-like representation of each image so the parser can be tested without
 * depending on a user's Photos Library path or on-device OCR availability.
 */
describe('real receipt OCR fixtures', () => {
  it('1 — Jinya: shadow, small text, merchant fee, and tip guide', () => {
    // Source: /Users/charlieduong/Pictures/Photos Library.photoslibrary/resources/derivatives/8/84E3B33A-B280-4EF0-8C26-B97102EC86EA_1_105_c.jpeg
    const rawText = `
Server: Ariana
115/1
Guests: 3
Zardetto Prosecco G (4 @10.00)
Aburi Oshi-Sushi Salmon
French Fries TruffleRanch
JINYA Tonkotsu Black
Birria Ramen
Spicy Chicken Ramen
Subtotal
Tax
Balance Due
Total
Merchant Fee
Let others know,
www.jinyaramenbar.com
(202) 204-0162
Washington DC 20007
1525 Wisconsin Ave NW
Scan the QR code below.
Enjoyed your experience?
JINYA Ramen Bar
1 5 5 2=22=I=#=========
22% $25.59
20% $23.26
18% $20.93
Suggested Gratuity
Thank You!
leave us a Google review!
131.42
3:23 PM
09/12/2026
131.42
3.49
11.63
116.30
20.30
20.80
21.50
8.20
5.50
40.00
30018`;

    const blocks = [
      {
        text: 'Server: Ariana',
        boundingBox: {
          height: 868.6403837890625,
          width: 81.39086856079135,
          y: 1524.8009082436638,
          x: 2868.243914657915,
        },
      },
      {
        boundingBox: {
          height: 332.09303271484345,
          width: 74.7209454345703,
          y: 1527.627900402268,
          x: 2802.034875773994,
        },
        text: '115/1',
      },
      {
        text: 'Guests: 3',
        boundingBox: {
          height: 562.2529199218746,
          width: 80.89632202148444,
          y: 1545.7503715155428,
          x: 2722.8204232168823,
        },
      },
      {
        text: 'Zardetto Prosecco G (4 @10.00)',
        boundingBox: {
          height: 1810.7160859375003,
          width: 106.83730789947492,
          y: 1547.23318495699,
          x: 2578.928767796432,
        },
      },
      {
        boundingBox: {
          height: 1400.9142519531247,
          y: 1557.5756485131799,
          width: 90.84972072601325,
          x: 2451.9825108896525,
        },
        text: 'Aburi Oshi-Sushi Salmon',
      },
      {
        text: 'French Fries TruffleRanch',
        boundingBox: {
          height: 1511.1419531249999,
          width: 90.76826321411153,
          y: 1557.887886139809,
          x: 2522.6544485945215,
        },
      },
      {
        boundingBox: {
          height: 1221.8652714843752,
          y: 1558.8100757307127,
          width: 80.52048495483369,
          x: 2321.060385074582,
        },
        text: 'JINYA Tonkotsu Black',
      },
      {
        text: 'Birria Ramen',
        boundingBox: {
          height: 741.6744145507816,
          width: 62.26747359466539,
          y: 1560.837206031586,
          x: 2391.0697513078994,
        },
      },
      {
        text: 'Spicy Chicken Ramen',
        boundingBox: {
          height: 1167.7284062499996,
          width: 90.15642079925544,
          y: 1568.890715430945,
          x: 2245.980906073379,
        },
      },
      {
        text: 'Subtotal',
        boundingBox: {
          height: 489.23084765624986,
          width: 64.04776024246212,
          y: 1570.7076672605658,
          x: 2118.740964262677,
        },
      },
      {
        text: 'Tax',
        boundingBox: {
          height: 199.25581091308635,
          width: 62.267449081420786,
          y: 1571.9069766039217,
          x: 2048.598833287487,
        },
      },
      {
        text: 'Balance Due',
        boundingBox: {
          height: 698.7244208984379,
          width: 63.80766935348506,
          y: 1582.1693145611064,
          x: 1634.1729611686342,
        },
      },
      {
        text: 'Total',
        boundingBox: {
          height: 569.3242973632807,
          y: 1591.7948467609588,
          width: 76.40862512969973,
          x: 1767.4116685019892,
        },
      },
      {
        text: 'Merchant Fee',
        boundingBox: {
          height: 748.0281313476561,
          width: 77.68080124282844,
          y: 1579.216051220775,
          x: 1906.5437582608315,
        },
      },
      {
        text: 'Let others know,',
        boundingBox: {
          height: 987.5648466796875,
          width: 74.09523669433602,
          y: 1603.8492639166943,
          x: 924.9324996739887,
        },
      },
      {
        text: 'www.jinyaramenbar.com',
        boundingBox: {
          height: 1310.6751806640618,
          width: 90.21266235351571,
          y: 2200.73614159447,
          x: 1422.372923674443,
        },
      },
      {
        text: '(202) 204-0162',
        boundingBox: {
          height: 866.50024394104001,
          width: 74.39552394104001,
          y: 2367.432867319106,
          x: 3022.1919256773344,
        },
      },
      {
        text: 'Washington DC 20007',
        boundingBox: {
          height: 1168.0557724609373,
          width: 88.47147024536162,
          y: 2178.0016473357714,
          x: 3082.0832486232953,
        },
      },
      {
        text: '1525 Wisconsin Ave NW',
        boundingBox: {
          height: 1288.2655283203123,
          width: 81.38892792892452,
          y: 2112.328742616561,
          x: 3157.4137410169374,
        },
      },
      {
        text: 'Scan the QR code below.',
        boundingBox: {
          height: 1419.9155537109375,
          width: 85.15772898101801,
          y: 2167.6771209380445,
          x: 863.7409241576096,
        },
      },
      {
        text: 'Enjoyed your experience?',
        boundingBox: {
          height: 1488.6836083984374,
          width: 94.53315440368661,
          y: 2156.166273036328,
          x: 995.9501817153836,
        },
      },
      {
        text: 'JINYA Ramen Bar',
        boundingBox: {
          height: 933.5063076171878,
          width: 75.32161798095692,
          y: 2289.557227011322,
          x: 3226.922817937644,
        },
      },
      {
        text: '1 5 5 2=22=I=#=========',
        boundingBox: {
          height: 1209.7092587890625,
          width: 55.88900273323043,
          y: 2289.961683680948,
          x: 1097.392220345215,
        },
      },
      {
        text: '22% $25.59',
        boundingBox: {
          height: 630.9767563476559,
          width: 74.72096586227417,
          y: 2579.2558039290793,
          x: 1151.9476583351795,
        },
      },
      {
        text: '20% $23.26',
        boundingBox: {
          height: 625.972771452893,
          width: 82.53508145141616,
          y: 2576.222915452893,
          x: 1219.648158762723,
        },
      },
      {
        text: '18% $20.93',
        boundingBox: {
          height: 625.4868935546873,
          width: 80.78046017074593,
          y: 2576.365583097723,
          x: 1294.3888172024074,
        },
      },
      {
        text: 'Suggested Gratuity',
        boundingBox: {
          height: 1123.2098554687498,
          width: 87.48036708068834,
          y: 2322.0925010314104,
          x: 1359.8993872577391,
        },
      },
      {
        text: 'Thank You!',
        boundingBox: {
          height: 611.6519814453126,
          width: 66.32141475105287,
          y: 2566.7786582082667,
          x: 1514.1852260015899,
        },
      },
      {
        text: 'leave us a Google review!',
        boundingBox: {
          height: 1543.15806640625,
          width: 87.16623802185066,
          y: 2654.588766996438,
          x: 941.3576072186077,
        },
      },
      {
        text: '131.42',
        boundingBox: {
          height: 734.8829311523436,
          width: 83.00379920196511,
          y: 3407.532300597689,
          x: 1793.867828507779,
        },
      },
      {
        text: '3:23 PM',
        boundingBox: {
          height: 474.52234887695323,
          width: 88.56909015655486,
          y: 3615.2808658120703,
          x: 2829.3649396461665,
        },
      },
      {
        text: '09/12/2026',
        boundingBox: {
          height: 627.6765400390619,
          width: 79.63763227844278,
          y: 3450.1772483655427,
          x: 2898.258129617772,
        },
      },
      {
        text: '131.42',
        boundingBox: {
          height: 387.441861816406,
          width: 68.49420134353639,
          y: 3774.7906945772625,
          x: 1662.540689753486,
        },
      },
      {
        text: '3.49',
        boundingBox: {
          height: 265.67441455078136,
          width: 68.49420134353639,
          y: 3874.4186052021287,
          x: 1942.744178155848,
        },
      },
      {
        text: '11.63',
        boundingBox: {
          height: 325.0478317871092,
          width: 73.02758683776844,
          y: 3806.3427853711287,
          x: 2079.0989150308997,
        },
      },
      {
        text: '116.30',
        boundingBox: {
          height: 376.37210180664056,
          width: 74.7209454345703,
          y: 3741.5813888661887,
          x: 2148.2267363082965,
        },
      },
      {
        text: '20.30',
        boundingBox: {
          height: 321.0232436523433,
          width: 74.72094543457077,
          y: 3785.86046852189,
          x: 2285.215108366726,
        },
      },
      {
        text: '20.80',
        boundingBox: {
          height: 321.0232436523439,
          width: 62.267457252502474,
          y: 3785.860469190688,
          x: 2359.936038504272,
        },
      },
      {
        text: '21.50',
        boundingBox: {
          height: 321.0232436523439,
          width: 68.49420134353639,
          y: 3785.860469190688,
          x: 2428.4302245593726,
        },
      },
      {
        text: '8.20',
        boundingBox: {
          height: 254.60465454101595,
          width: 68.49420134353639,
          y: 3841.209299221998,
          x: 2496.924410644802,
        },
      },
      {
        text: '5.50',
        boundingBox: {
          height: 265.67441455078136,
          width: 68.49419725799589,
          y: 3830.1395335897255,
          x: 2565.4185988119184,
        },
      },
      {
        text: '40.00',
        boundingBox: {
          height: 329.764979003906,
          width: 74.95203179168713,
          y: 3770.2943139873273,
          x: 2629.1239696476277,
        },
      },
      {
        text: '30018',
        boundingBox: {
          height: 332.09303271484345,
          width: 68.49420134353639,
          y: 3752.651156400718,
          x: 2777.127898985761,
        },
      },
    ];

    const parsed = parseReceiptText(rawText, blocks);

    expect(parsed).toEqual({
      title: 'JINYA Ramen Bar',
      items: [
        { name: 'Zardetto Prosecco G (4 @10.00)', quantity: 1, amountMinorUnits: 4000 },
        { name: 'French Fries TruffleRanch', quantity: 1, amountMinorUnits: 550 },
        { name: 'Aburi Oshi-Sushi Salmon', quantity: 1, amountMinorUnits: 820 },
        { name: 'Birria Ramen', quantity: 1, amountMinorUnits: 2150 },
        { name: 'JINYA Tonkotsu Black', quantity: 1, amountMinorUnits: 2080 },
        { name: 'Spicy Chicken Ramen', quantity: 1, amountMinorUnits: 2030 },
      ],
      taxMinorUnits: 1163,
      tipMinorUnits: 0,
      fees: [{ name: 'Merchant Fee', amountMinorUnits: 349 }],
      discounts: [],
      totalMinorUnits: 13142,
    });
  });

  it.skip('2 — H Mart: logo title, shadow, weighted produce, and plastic-bag quantity', () => {
    // Source: /Users/charlieduong/Pictures/Photos Library.photoslibrary/resources/derivatives/9/961E0241-AE3D-44CA-8899-E319D0834A7A_1_105_c.jpeg
    const parsed = parseReceiptText(`
      H MART
      http://www.hmart.com
      7885 Heritage DR.
      Annandale, VA 22003
      TEL (703) 914-4222
      Your Cashier was ROSSY
      FW MIXED BOUQUET 18.99 T
      FZ BF SHORT PLATE 17.63 B
      PK SLD JOWL MEAT 11.21 B
      P&G ORG JUMBO EGG 7.49 B
      HMART SMART MEMBER 40136276997
      POBLANO PEPPER 2.28 B
      0.43 lb @ 2.49 /lb
      WT JALAPENO PEPPER 1.07 B
      HGB RNBW SWT RC CK 4.99 B
      2 @ 0.05
      PLASTIC BAG 0.10
      TAX 1.59
      **** BALANCE 65.35
      Visa Credit - H
      TOTAL AMOUNT: $65.35
      Visa 65.35
    `);

    expect(parsed).toEqual({
      title: 'H Mart',
      items: [
        { name: 'FW MIXED BOUQUET', quantity: 1, amountMinorUnits: 1899 },
        { name: 'FZ BF SHORT PLATE', quantity: 1, amountMinorUnits: 1763 },
        { name: 'PK SLD JOWL MEAT', quantity: 1, amountMinorUnits: 1121 },
        { name: 'P&G ORG JUMBO EGG', quantity: 1, amountMinorUnits: 749 },
        { name: 'POBLANO PEPPER', quantity: 1, amountMinorUnits: 228 },
        { name: 'WT JALAPENO PEPPER', quantity: 1, amountMinorUnits: 107 },
        { name: 'HGB RNBW SWT RC CK', quantity: 1, amountMinorUnits: 499 },
        { name: 'PLASTIC BAG', quantity: 1, amountMinorUnits: 10 },
      ],
      taxMinorUnits: 159,
      tipMinorUnits: 0,
      fees: [],
      discounts: [],
      totalMinorUnits: 6535,
    });
  });

  it.skip('3 — Ingle Korean Steakhouse: zero-dollar items, discount, and payment section', () => {
    // Source: /Users/charlieduong/Pictures/Photos Library.photoslibrary/resources/derivatives/F/F07009AE-CB48-44C4-8368-0179E90940E5_1_105_c.jpeg
    const parsed = parseReceiptText(`
      INGLE KOREAN STEAKHOUSE
      8369 - Leesburg Pike
      Vienna, VA 22182
      Server: minsung c
      Check #31
      Guest Count: 2
      2 Moo-Ssam $0.00
      1 Scallion Pancake $0.00
      2 Cuts of the day $168.00
      1 Mushrooms $0.00
      1 Mul Mak-Guksu (S) $0.00
      1 Bibim Mak-Guksu (S) $0.00
      1 Emily's Margarita $10.00
      1 Passion 5 $10.00
      1 Osulloc Tea $0.00
      Cherry Blossom
      1 Ice Cream $0.00
      Open % Check (10%) -$18.80
      Pre-discount Subtotal $188.00
      Discount Total -$18.80
      Subtotal $169.20
      Tax $16.92
      Total $186.12
      Mastercard $186.12
      Add a Tip:
    `);

    expect(parsed).toEqual({
      title: 'Ingle Korean Steakhouse',
      items: [
        { name: 'Moo-Ssam', quantity: 2, amountMinorUnits: 0 },
        { name: 'Scallion Pancake', quantity: 1, amountMinorUnits: 0 },
        { name: 'Cuts of the day', quantity: 2, amountMinorUnits: 16800 },
        { name: 'Mushrooms', quantity: 1, amountMinorUnits: 0 },
        { name: 'Mul Mak-Guksu (S)', quantity: 1, amountMinorUnits: 0 },
        { name: 'Bibim Mak-Guksu (S)', quantity: 1, amountMinorUnits: 0 },
        { name: "Emily's Margarita", quantity: 1, amountMinorUnits: 1000 },
        { name: 'Passion 5', quantity: 1, amountMinorUnits: 1000 },
        { name: 'Osulloc Tea', quantity: 1, amountMinorUnits: 0 },
        { name: 'Ice Cream', quantity: 1, amountMinorUnits: 0 },
      ],
      taxMinorUnits: 1692,
      tipMinorUnits: 0,
      fees: [],
      discounts: [{ name: 'Open % Check (10%)', amountMinorUnits: 1880 }],
      totalMinorUnits: 18612,
    });
  });

  it.skip('4 — Miso Cafe: multiple tax lines and quantity-prefixed items', () => {
    // Source: /Users/charlieduong/Pictures/Photos Library.photoslibrary/resources/derivatives/3/33665335-D559-4F28-96B1-C24B3A6B88AB_1_105_c.jpeg
    const parsed = parseReceiptText(`
      MISO CAFE
      7410-B LITTLE RIVER TNPK
      Annandale, VA 22003
      (703) 256-5737
      TABLE 22-2
      Server: Manager
      ORDER #22
      Invoice #66783
      1 SAUSAGE KATSU $5.95
      1 TOFU KATSU $5.95
      1 DONKOTSU RAMEN (L) $16.95
      1 CHICKEN & M $17.95
      3 PORK & M $53.85
      SUBTOTAL: $100.65
      SALES TAX (6%): $6.04
      MEAL TAX (4%): $4.03
      TOTAL: $110.72
      Tip Guide
      18%=$18.12, 20%=$20.13, 22%=$22.14
    `);

    expect(parsed).toEqual({
      title: 'Miso Cafe',
      items: [
        { name: 'SAUSAGE KATSU', quantity: 1, amountMinorUnits: 595 },
        { name: 'TOFU KATSU', quantity: 1, amountMinorUnits: 595 },
        { name: 'DONKOTSU RAMEN (L)', quantity: 1, amountMinorUnits: 1695 },
        { name: 'CHICKEN & M', quantity: 1, amountMinorUnits: 1795 },
        { name: 'PORK & M', quantity: 3, amountMinorUnits: 5385 },
      ],
      taxMinorUnits: 1007,
      tipMinorUnits: 0,
      fees: [],
      discounts: [],
      totalMinorUnits: 11072,
    });
  });

  it.skip('5 — Mochi restaurant: blur, obstruction, multiple taxes, and handwritten tip', () => {
    // Source: /Users/charlieduong/Pictures/Photos Library.photoslibrary/resources/derivatives/6/6EAD1244-6504-4AE4-A1A2-0541BA47EC8A_1_105_c.jpeg
    const parsed = parseReceiptText(`
      MOCHI
      13041 Lee Jackson Memorial Highway
      Fairfax, VA 22033
      Server: Nakyong L
      Check #24
      Guest Count: 6
      1 Draft Sapporo $10.00
      1 Yakult Classic $10.00
      1 Kook's Old Fashioned $10.00
      8 Brisket $84.00
      1 Soybean Soup $0.00
      1 Angry Egg $0.00
      1 Corn Cheese $0.00
      2 Rib Fingers $24.00
      1 Soybean Soup #charge $2.50
      1 Angry Egg #charge $2.50
      1 Corn Cheese #charge $2.50
      3 Thick Pork Belly $30.00
      1 Denver $28.00
      1 Old Fashioned $10.00
      Subtotal $213.50
      VA STATE $12.81
      FFX COUNTY $8.54
      Total $234.85
      Amount $234.85
      + Tip: 50.00
      = Total: 284.85
    `);

    expect(parsed).toEqual({
      title: 'Mochi',
      items: [
        { name: 'Draft Sapporo', quantity: 1, amountMinorUnits: 1000 },
        { name: 'Yakult Classic', quantity: 1, amountMinorUnits: 1000 },
        { name: "Kook's Old Fashioned", quantity: 1, amountMinorUnits: 1000 },
        { name: 'Brisket', quantity: 8, amountMinorUnits: 8400 },
        { name: 'Soybean Soup', quantity: 1, amountMinorUnits: 0 },
        { name: 'Angry Egg', quantity: 1, amountMinorUnits: 0 },
        { name: 'Corn Cheese', quantity: 1, amountMinorUnits: 0 },
        { name: 'Rib Fingers', quantity: 2, amountMinorUnits: 2400 },
        { name: 'Soybean Soup #charge', quantity: 1, amountMinorUnits: 250 },
        { name: 'Angry Egg #charge', quantity: 1, amountMinorUnits: 250 },
        { name: 'Corn Cheese #charge', quantity: 1, amountMinorUnits: 250 },
        { name: 'Thick Pork Belly', quantity: 3, amountMinorUnits: 3000 },
        { name: 'Denver', quantity: 1, amountMinorUnits: 2800 },
        { name: 'Old Fashioned', quantity: 1, amountMinorUnits: 1000 },
      ],
      taxMinorUnits: 2135,
      tipMinorUnits: 5000,
      fees: [],
      discounts: [],
      totalMinorUnits: 23485,
    });
  });

  it.skip('6 — Wegmans: logo-only merchant title, weighed items, and discount line', () => {
    // Source: /Users/charlieduong/Pictures/Photos Library.photoslibrary/resources/derivatives/6/6DA84392-4503-41EB-A818-2128B87E9DED_1_105_c.jpeg
    const parsed = parseReceiptText(`
      Wegmans
      1835 CAPITAL ONE DRIVE SOUTH
      TYSONS, VA 22102
      (571) 423-0700
      06/21/26 OP# 482902
      WB BLUEBERRY SCONE 4.99 B
      MAOLA WH MILK UP 2.49 B
      SC LAYS BBQ CHIPS 5.49 B
      SC 20398 LAYS CHED & SC PTY 0.50-B
      POLAR ORGANIC VANILLA 1.19 B
      MONSTER ULTRA ZERO 24.99 B
      0.48 lb @ 2.49 /lb
      WT PEPPER GREEN 1.20 B
      WB ORGANIC MEDLEY 4.99 B
      0.38 lb @ 4.49 /lb
      WT GARLIC BULK 1.71 B
      1.52 lb @ 0.73 /lb
      WT BANANA ORGANIC 1.11 B
      0.51 lb @ 2.49 /lb
      WT PEPPER GREEN 1.27 B
      SESAME CHKN BWL 12.00 B
      ENCHILADA GOLD PAN 16.00 B
      TAX 0.77
      **** BALANCE 77.70
      MASTERCARD PURCHASE 77.70
    `);

    expect(parsed).toEqual({
      title: 'Wegmans',
      items: [
        { name: 'WB BLUEBERRY SCONE', quantity: 1, amountMinorUnits: 499 },
        { name: 'MAOLA WH MILK UP', quantity: 1, amountMinorUnits: 249 },
        { name: 'SC LAYS BBQ CHIPS', quantity: 1, amountMinorUnits: 549 },
        { name: 'SC 20398 LAYS CHED & SC PTY', quantity: 1, amountMinorUnits: 50 },
        { name: 'POLAR ORGANIC VANILLA', quantity: 1, amountMinorUnits: 119 },
        { name: 'MONSTER ULTRA ZERO', quantity: 1, amountMinorUnits: 2499 },
        { name: 'WT PEPPER GREEN', quantity: 1, amountMinorUnits: 120 },
        { name: 'WB ORGANIC MEDLEY', quantity: 1, amountMinorUnits: 499 },
        { name: 'WT GARLIC BULK', quantity: 1, amountMinorUnits: 171 },
        { name: 'WT BANANA ORGANIC', quantity: 1, amountMinorUnits: 111 },
        { name: 'WT PEPPER GREEN', quantity: 1, amountMinorUnits: 127 },
        { name: 'SESAME CHKN BWL', quantity: 1, amountMinorUnits: 1200 },
        { name: 'ENCHILADA GOLD PAN', quantity: 1, amountMinorUnits: 1600 },
      ],
      taxMinorUnits: 77,
      tipMinorUnits: 0,
      fees: [],
      discounts: [{ name: 'SC 20398 LAYS CHED & SC PTY', amountMinorUnits: 50 }],
      totalMinorUnits: 7770,
    });
  });

  it.skip('7 — Genki Izakaya: indented modifiers, folded paper, and handwritten tip', () => {
    // Source: /Users/charlieduong/Pictures/Photos Library.photoslibrary/resources/derivatives/6/66DA74EE-1AC1-45E2-91BF-46EC5E9C0840_1_105_c.jpeg
    const parsed = parseReceiptText(`
      Genki Izakaya
      9350 Fairfax Boulevard
      Fairfax, VA 22031
      Server: Nawapol L
      Check #52
      Guest Count: 4
      1 Yakitori Platter $21.00
      Nagima - Chicken thigh w. leek
      Tohasaki - Chicken Wings
      Gyu-Harami - Beef Skirt
      Butabara - Pork Belly
      Shishito - Peppers
      1 White Rice $2.00
      1 Asahi (Can) $7.00
      1 Butabara $4.00
      1 Shrimp Tempura Roll $8.00
      Maki
      1 Toro Bowl $28.00
      1 Koro Oolong $17.00
      1 Gyu Don $24.00
      Subtotal $111.00
      Tax $11.10
      Total $122.10
      Amount $122.10
      + Tip: 22.20
      = Total: 144.30
      CHARLIE DUONG
    `);

    expect(parsed).toEqual({
      title: 'Genki Izakaya',
      items: [
        { name: 'Yakitori Platter', quantity: 1, amountMinorUnits: 2100 },
        { name: 'White Rice', quantity: 1, amountMinorUnits: 200 },
        { name: 'Asahi (Can)', quantity: 1, amountMinorUnits: 700 },
        { name: 'Butabara', quantity: 1, amountMinorUnits: 400 },
        { name: 'Shrimp Tempura Roll', quantity: 1, amountMinorUnits: 800 },
        { name: 'Toro Bowl', quantity: 1, amountMinorUnits: 2800 },
        { name: 'Koro Oolong', quantity: 1, amountMinorUnits: 1700 },
        { name: 'Gyu Don', quantity: 1, amountMinorUnits: 2400 },
      ],
      taxMinorUnits: 1110,
      tipMinorUnits: 2220,
      fees: [],
      discounts: [],
      totalMinorUnits: 14430,
    });
  });

  it.skip('8 — IKEA: logo/header noise, article-number rows, and long item list', () => {
    // Source: /Users/charlieduong/Pictures/Photos Library.photoslibrary/resources/derivatives/D/DF085352-6C45-4592-8EF1-FDD92F766C4F_1_105_c.jpeg
    const parsed = parseReceiptText(`
      IKEA Woodbridge!
      Welcome to IKEA Woodbridge!
      Article 2053872 18351
      HOLMERUD side tbl 31 2 x 49.99 99.98
      Article 00331383 23241
      BANARP N floor/read 69.99
      Article 20611108 12413
      FRAKTA shop bag 0.99
      Article 70613379 21633
      MOLNART N5 LED bulb E 15.99
      Article 70598482 15621
      STRANDAD floor 1 mp w 19.99
      Article 90556719 90176
      KLIPPLAL gls 8 oz cl 0.99
      Article 00614297 18314
      OLIVTRAST gls 10 oz 1.99
      Article 30594716 16790
      SKUGGSTUBB mug 14 oz 7.99
      Article 00462675 22217
      MARKFROST tbl lmp ma 27.99
      Article 10591479 21633
      SOLHETTA N3 LED bulb 2.49
      Article 00550498 21633
      SOLHETTA LED bulb E12 7.99
      Article 90525150 22217
      VARMBLIXT LED tbl w/l 99.99
      Article 70493013 23079
      EKOLN trsh can 1 gal 14.99
      Article 90568726 22204
      TRIXIG crpntr lvl NA 9.99
      Article 60146764 14412
      FORSA work lmp nicke 39.99
      Net total 421.34
      TAX 25.28
      Total 446.62
      Total Articles: 16
      EFT VISA USD 446.62
    `);

    expect(parsed).toEqual({
      title: 'IKEA Woodbridge',
      items: [
        { name: 'HOLMERUD side tbl 31 2 x 49.99', quantity: 1, amountMinorUnits: 9998 },
        { name: 'BANARP N floor/read', quantity: 1, amountMinorUnits: 6999 },
        { name: 'FRAKTA shop bag', quantity: 1, amountMinorUnits: 99 },
        { name: 'MOLNART N5 LED bulb E', quantity: 1, amountMinorUnits: 1599 },
        { name: 'STRANDAD floor 1 mp w', quantity: 1, amountMinorUnits: 1999 },
        { name: 'KLIPPLAL gls 8 oz cl', quantity: 1, amountMinorUnits: 99 },
        { name: 'OLIVTRAST gls 10 oz', quantity: 1, amountMinorUnits: 199 },
        { name: 'SKUGGSTUBB mug 14 oz', quantity: 1, amountMinorUnits: 799 },
        { name: 'MARKFROST tbl lmp ma', quantity: 1, amountMinorUnits: 2799 },
        { name: 'SOLHETTA N3 LED bulb', quantity: 1, amountMinorUnits: 249 },
        { name: 'SOLHETTA LED bulb E12', quantity: 1, amountMinorUnits: 799 },
        { name: 'VARMBLIXT LED tbl w/l', quantity: 1, amountMinorUnits: 9999 },
        { name: 'EKOLN trsh can 1 gal', quantity: 1, amountMinorUnits: 1499 },
        { name: 'TRIXIG crpntr lvl NA', quantity: 1, amountMinorUnits: 999 },
        { name: 'FORSA work lmp nicke', quantity: 1, amountMinorUnits: 3999 },
      ],
      taxMinorUnits: 2528,
      tipMinorUnits: 0,
      fees: [],
      discounts: [],
      totalMinorUnits: 44662,
    });
  });
});

describe('captured Wegmans OCR regression', () => {
  it('uses aligned receipt item rows instead of the street address or balance as content', () => {
    const rawText = `06/21/26 OP# 482902
TY S, 423-22002
1835 CAPITAL ONE DRIVE SOUTH
WB BLUEBERRY SCONE
Wegmans
SC 20398 LAYS CHED & SC PTY
WT
WT
WT
WT
SC
MASTERCARD PURCHASE
CARD NUMBER: ************8317 H
MASTERCARD 07
AUTH: 07762Z RCPT: 10405
AID: A0000000041010
VERIFIED BY PIN
CODE: 0000
**** BALANCE
0.51 lb @ 2.49 /1b
1.52 lb @ 0.73 /1b
0.38 lb @ 4.49 /Ib
0.48 lb @ 2.49 /1b
BANANA ORGANIC
WB ORGANIC MEDLEY
MONSTER ULTRA ZERO
POLAR ORNG VANILLA
PEPPER GREEN
GARLIC BULK
SESAME CHKN BWL
PEPPER GREEN
LAYS BBQ CHIPS
MAOLA WH MILK UP
ENCHILADA GOLD PAN
TAX
Every day you get cue best!
ARM
77 70
77.70
0.77
16.00 B
12.00 B
1.27 B
1.11 B
1.71 B
4.99 B
1.20 B
24.99 B
1.19 B
0.50-B
5.49 B
2.49 B
4.99 B
2024
superior airflow
quiet cooling pe
ontinuing the le
fins and a 20%
reduction in fin`;

    // Exact captured coordinates for the merchant/address, receipt rows,
    // tax, and balance. Keeping these actual observations exercises the
    // rotated layout and repeated left edge of the item column.
    const capturedBlocks = [
      ['Wegmans', 3095.909646612059, 1036.5406797351297, 625.5805523071292, 2976.616494140624],
      [
        '06/21/26 OP# 482902',
        2735.145993490421,
        1767.619984240589,
        111.73707651901243,
        1612.3764384765625,
      ],
      [
        'TY S, 423-22002',
        2901.508445340382,
        1911.0468714147828,
        200.9752679443358,
        1307.7938466796877,
      ],
      ['WT', 1214.2151083950298, 1062.6976749648206, 74.7209454345703, 177.11627636718717],
      ['WT', 1394.7906918212182, 1051.6279074424524, 80.94768544006348, 177.1162763671878],
      ['WT', 1575.3662712524367, 1051.6279001792689, 87.17443361663811, 177.11629089355483],
      ['WT', 1849.3430174337475, 1051.6279002597767, 80.94768544006348, 177.1162908935542],
      ['SC', 2297.6685967734124, 1040.5581362935593, 74.7209454345703, 188.1860509033209],
      [
        'MASTERCARD PURCHASE',
        555.9679717048003,
        1080.746958897512,
        116.8708935127258,
        1602.434708984375,
      ],
      [
        'CARD NUMBER: ************8317 H',
        459.6541631308042,
        1081.1150698181236,
        139.14838723754886,
        2609.1851679687497,
      ],
      [
        'MASTERCARD 07',
        374.3634819775567,
        1081.890349135322,
        105.07968783187872,
        1113.4827675781248,
      ],
      [
        'AUTH: 07762Z RCPT: 10405',
        278.9240774563491,
        1091.8582205399653,
        125.69480770111086,
        2110.44315234375,
      ],
      [
        'AID: A0000000041010',
        98.19733516085893,
        1102.9118139324844,
        113.01269674301147,
        1612.3871298828121,
      ],
      [
        'VERIFIED BY PIN',
        9.028991057458864,
        1103.2613616973383,
        107.30704703521728,
        1280.0795136718748,
      ],
      ['CODE: 0000', 187.91489951967844, 1103.9115236702432, 100.9955810852051, 968.8122944335936],
      [
        '1835 CAPITAL ONE DRIVE SOUTH',
        3073.710366755228,
        1448.535911294911,
        109.45962041473399,
        2217.9036386718753,
      ],
      [
        'WB BLUEBERRY SCONE',
        2475.9047190005854,
        1701.9348159023284,
        99.48549576187155,
        1444.6348984375,
      ],
      [
        'MAOLA WH MILK UP',
        2389.6763847023635,
        1713.7447836880724,
        87.59633515548744,
        1287.9221250000003,
      ],
      [
        'LAYS BBQ CHIPS',
        2300.7302282469977,
        1702.4723026713464,
        93.5027401657101,
        1144.5357246093754,
      ],
      [
        'SC 20398 LAYS CHED & SC PTY',
        2200.0621050353952,
        1037.548338542111,
        115.77273692321764,
        2219.90641796875,
      ],
      [
        'POLAR ORNG VANILLA',
        2119.9105867555672,
        1700.8789968249814,
        113.74531182861311,
        1479.9437324218752,
      ],
      [
        'MONSTER ULTRA ZERO',
        2031.6255620926488,
        1701.8182634550024,
        108.2431629066467,
        1478.1480410156246,
      ],
      [
        'PEPPER GREEN',
        1859.0456055259324,
        1701.6374999743305,
        101.32742096328744,
        1091.2383671874998,
      ],
      [
        'WB ORGANIC MEDLEY',
        1768.064086582072,
        1701.3301920894396,
        110.1562459716796,
        1413.123721679688,
      ],
      [
        'GARLIC BULK',
        1581.0029898530934,
        1710.9753931302134,
        108.23142514801015,
        1016.138094726562,
      ],
      [
        'BANANA ORGANIC',
        1396.4922483805378,
        1710.5652694991925,
        121.12259731292734,
        1272.0257470703123,
      ],
      [
        'PEPPER GREEN',
        1218.1997642786089,
        1712.798054329616,
        99.99195165252678,
        1102.3820664062498,
      ],
      [
        'SESAME CHKN BWL',
        1120.6548784169202,
        1723.1426826072557,
        109.69069451522842,
        1268.3690537109374,
      ],
      [
        'ENCHILADA GOLD PAN',
        1028.5831042421432,
        1723.351752602196,
        108.57485979080208,
        1523.3819863281249,
      ],
      ['TAX', 940.2383663877081, 1726.8837249435642, 80.94768544006348, 276.7441745605462],
      ['**** BALANCE', 750.505251510859, 1294.253605199312, 94.10322886276242, 1042.3494716796874],
      [
        '0.51 lb @ 2.49 /1b',
        1287.811489932488,
        1147.3560960342015,
        118.45813835906966,
        1535.1675185546876,
      ],
      [
        '1.52 lb @ 0.73 /1b',
        1469.7604292531141,
        1136.893339475741,
        121.56317385864263,
        1546.1675810546874,
      ],
      [
        '0.38 lb @ 4.49 /Ib',
        1656.3492783772565,
        1136.7729912284296,
        117.27324165344247,
        1546.3279521484371,
      ],
      [
        '0.48 lb @ 2.49 /1b',
        1925.455105513094,
        1136.9893457026872,
        113.78235134124736,
        1512.3245156249998,
      ],
      ['4.99 B', 2491.6895355405727, 3613.9851745564692, 103.98113903045657, 501.66617333984357],
      ['2.49 B', 2410.659200925705, 3623.585516391016, 97.809504798889, 501.66617333984357],
      ['5.49 B', 2324.9006968159474, 3629.043644192299, 84.53985222244263, 492.0966093750003],
      ['0.50-B', 2226.596344243576, 3627.205169789902, 103.74706205749519, 516.6176401367181],
      ['1.19 B', 2144.5141929984934, 3638.6116792905473, 96.53803548431404, 506.5985141601564],
      ['24.99 B', 2062.013508837582, 3573.8536677114125, 85.05162748718291, 568.301408691406],
      ['1.20 B', 1886.7034784644854, 3664.0930279204667, 80.94769361114517, 498.1395200195311],
      ['4.99 B', 1793.3023137131167, 3675.1627917077794, 87.1744417877198, 487.0697600097657],
      ['1.71 B', 1602.5970413486416, 3681.234050763413, 103.5051898727418, 509.4603828125004],
      ['1.11 B', 1429.3104998933625, 3683.2590948172246, 97.57807525634769, 526.8966137695313],
      ['1.27 B', 1245.3488293919718, 3719.4418637460485, 87.17443361663811, 498.1395200195311],
      ['12.00 B', 1141.760196979237, 3638.035952029736, 111.19324201583852, 595.2753037109376],
      ['16.00 B', 1052.3197515484608, 3641.9534806881175, 99.6279422264098, 597.7674472656248],
      ['0.77', 958.9185969634377, 3730.5116286415987, 99.62792179870605, 354.2325527343756],
      ['77.70', 778.3430155334959, 3653.0232533175263, 99.62792179870605, 431.72093090820374],
      ['77 70', -0.000012374711539507643, 3697.302320926364, 49.81397724151611, 431.7209309082031],
      [
        'Every day you get cue best!',
        3218.0138042975063,
        2310.41255370495,
        127.09296146392819,
        1635.6047968750006,
      ],
      ['ARM', -0.000006353402268928221, 2468.558141065625, 24.906988620758057, 232.46510546874973],
      ['2024', 3652.3584894268856, 4359.234564926129, 234.61708145141583, 632.6236977539065],
      [
        'superior airflow',
        3193.061845931286,
        4470.7538359181935,
        287.8153654174801,
        973.6258095703125,
      ],
      [
        'quiet cooling pe',
        3305.6199577725315,
        4388.546136681996,
        290.4901689605712,
        1043.926395996094,
      ],
      [
        'ontinuing the le',
        3430.7164800603628,
        4387.921966202164,
        285.6459759521482,
        1025.082734375,
      ],
      [
        'fins and a 20%',
        2975.138351894987,
        4629.376757132983,
        273.9767726898197,
        1000.7069091796875,
      ],
      [
        'reduction in fin',
        3087.7577318998674,
        4549.191915940751,
        268.12014182281496,
        957.4397758789064,
      ],
    ] as const;
    const blocks = capturedBlocks.map(([text, x, y, width, height]) => ({
      text,
      boundingBox: { x, y, width, height },
    }));

    expect(parseReceiptText(rawText, blocks)).toEqual({
      title: 'Wegmans',
      items: [
        { name: 'WB BLUEBERRY SCONE', quantity: 1, amountMinorUnits: 499 },
        { name: 'MAOLA WH MILK UP', quantity: 1, amountMinorUnits: 249 },
        { name: 'LAYS BBQ CHIPS', quantity: 1, amountMinorUnits: 549 },
        { name: 'POLAR ORNG VANILLA', quantity: 1, amountMinorUnits: 119 },
        { name: 'MONSTER ULTRA ZERO', quantity: 1, amountMinorUnits: 2499 },
        { name: 'PEPPER GREEN', quantity: 1, amountMinorUnits: 120 },
        { name: 'WB ORGANIC MEDLEY', quantity: 1, amountMinorUnits: 499 },
        { name: 'GARLIC BULK', quantity: 1, amountMinorUnits: 171 },
        { name: 'BANANA ORGANIC', quantity: 1, amountMinorUnits: 111 },
        { name: 'PEPPER GREEN', quantity: 1, amountMinorUnits: 127 },
        { name: 'SESAME CHKN BWL', quantity: 1, amountMinorUnits: 1200 },
        { name: 'ENCHILADA GOLD PAN', quantity: 1, amountMinorUnits: 1600 },
      ],
      taxMinorUnits: 77,
      tipMinorUnits: 0,
      fees: [],
      discounts: [{ name: 'SC 20398 LAYS CHED & SC PTY', amountMinorUnits: 50 }],
      totalMinorUnits: 7770,
    });
  });
});

describe('grocery receipt price annotation regressions', () => {
  it('does not treat Whole Foods regular prices or Prime savings as purchased items', () => {
    const parsed = parseReceiptText(`
      WHOLE FOODS MARKET
      Fair Lakes FRL 703-222-2058
      4501 Market Commons Dr
      Fairfax, VA 22033 6003
      LQDDTH KLR COLA SPRK WTR 1.34 FT
      Reg $1.69
      Savings with Prime ($0.35)
      CHOBANI PEACH GRK YOG 1.69 FT
      CHOBANI STRWB GRK YOG 1.69 FT
      OG BANANA 1.82 FT
      Qty 2.31 lb @ $0.79/lb
      CHICKEN TIKKA MASALA 10.49 FT
      GREEN BELL PEPPER 1.52 FT
      Qty 0.51 lb @ $2.99/lb
      VISIONARY BOT 24.99 T
      Reg $29.99
      Savings with Prime ($5.00)
      ARGRNA DBL DOZEN ROSES 29.99 T
      Subtotal: 78.88
      Total Savings: -5.35
      Net Sales: 73.53
      Tax: 6.00% 3.30
      Tax: 1.00% 0.19
      Total: 77.02
      VISA *0669 77.02
    `);

    expect(parsed).toEqual({
      title: 'Whole Foods Market',
      items: [
        { name: 'LQDDTH KLR COLA SPRK WTR', quantity: 1, amountMinorUnits: 134 },
        { name: 'CHOBANI PEACH GRK YOG', quantity: 1, amountMinorUnits: 169 },
        { name: 'CHOBANI STRWB GRK YOG', quantity: 1, amountMinorUnits: 169 },
        { name: 'OG BANANA', quantity: 1, amountMinorUnits: 182 },
        { name: 'CHICKEN TIKKA MASALA', quantity: 1, amountMinorUnits: 1049 },
        { name: 'GREEN BELL PEPPER', quantity: 1, amountMinorUnits: 152 },
        { name: 'VISIONARY BOT', quantity: 1, amountMinorUnits: 2499 },
        { name: 'ARGRNA DBL DOZEN ROSES', quantity: 1, amountMinorUnits: 2999 },
      ],
      taxMinorUnits: 349,
      tipMinorUnits: 0,
      fees: [],
      discounts: [],
      totalMinorUnits: 7702,
    });
  });

  it('ignores H Mart regular-price and saved-amount annotations', () => {
    const parsed = parseReceiptText(`
      H MART
      http://www.hmart.com
      8103 Lee Highway
      Falls Church, VA 22042
      TEL (703) 573-6300
      Your Cashier was PRETTI KUMARI
      HMART SMART MEMBER 40136276997
      BIBIGO MANDOO 11.99 B
      NS SHIN RAMEN 10PK 14.99 B
      FREMO ALOE VERA DR 4.99 B
      PK SLD JOWL MEAT 18.32 B
      Regular Price 19.99, You saved 9.87
      FZ BF BRISKET(CHO) 19.51 B
      PLASTIC BAG 0.05
      PLASTIC BAG 0.05
      TAX 0.70
      **** BALANCE 70.60
      MasterCard Credit - H
    `);

    expect(parsed).toEqual({
      title: 'H Mart',
      items: [
        { name: 'BIBIGO MANDOO', quantity: 1, amountMinorUnits: 1199 },
        { name: 'NS SHIN RAMEN 10PK', quantity: 1, amountMinorUnits: 1499 },
        { name: 'FREMO ALOE VERA DR', quantity: 1, amountMinorUnits: 499 },
        { name: 'PK SLD JOWL MEAT', quantity: 1, amountMinorUnits: 1832 },
        { name: 'FZ BF BRISKET(CHO)', quantity: 1, amountMinorUnits: 1951 },
        { name: 'PLASTIC BAG', quantity: 1, amountMinorUnits: 5 },
        { name: 'PLASTIC BAG', quantity: 1, amountMinorUnits: 5 },
      ],
      taxMinorUnits: 70,
      tipMinorUnits: 0,
      fees: [],
      discounts: [],
      totalMinorUnits: 7060,
    });
  });
});
