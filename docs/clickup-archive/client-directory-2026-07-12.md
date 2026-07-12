# ClickUp Client Archive — client directory (2026-07-12)

Extracted read-only from `docs/clickup-archive/crawl-metadata-corrected-2026-07-12.json` (35,131 rows, LOCKED footprint). No new crawl. One row per client, sorted by **built (worked-on) desc**.

## Counts
- **Distinct clients after merge: 259** (active 24 · frozen 235)
- Raw surfaces before merge: 269 list surfaces / 264 client codes (manifest). 7 merge groups collapsed 17 surfaces → 7 rows (net −10 → 259).

## Column definitions & reconciliation (READ THIS)
- **built** = worked-on = delivered + in-progress (dev/QA/approval/creative/troubleshooting).
- **delivered** = reached a terminal state (status_type done/closed, or custom live/push-live/launch-queue/reporting/completed-won-lost-null/implement).
- **years** = span of `date_created` (first→last task created for the client). NOT delivery dates.
- **status** = active (Neighborly / Sonrava / CRO Projects / ADM-CRO lists) · frozen (Client Archive folder) · active+frozen (client appears in both).

> ⚠ **Reconstruction vs locked headline.** This directory's columns sum to **14,370 built / 13,615 delivered**, ~415 / 243 under the LOCKED headline **14,785 / 13,858**. The locked classifier was list-workflow-order aware (the "orderindex best-effort floor"); that per-list stage order is NOT in the row metadata, so a row-only reconstruction lands a hair low on the built/delivered split. **Task counts and per-client RANKING are exact; the built/delivered split is directional (±3%).** The locked 14,785 / 13,858 remains the authoritative aggregate for the page headline.

## Merges applied — ⚑ CONFIRM EACH (Lacey)
- **Spotloan** ← [Archive] Spotloan + SPL - Spotloan → built 233 / delivered 232 / 2019–2025 / active+frozen — spans active (CRO Projects) + frozen (Client Archive); combined timeline
- **Fit Track** ← Fit Track US + Fit Track UK + Fit Track FR → built 150 / delivered 148 / 2020–2021 / frozen
- **Kiteworks** ← Kiteworks - US + Kiteworks - FR + Kiteworks - DE → built 76 / delivered 72 / 2023–2024 / frozen
- **Stamps** ← Stamps - Store + Stamps - Marketing + Stamps - Product → built 143 / delivered 122 / 2023–2024 / frozen
- **Bec + Bridge** ← Bec + Bridge US + Bec + Bridge AU → built 172 / delivered 164 / 2021–2022 / frozen
- **Solgaard** ← Solgaard + Solgaard2 → built 190 / delivered 187 / 2021–2023 / frozen
- **7 Mile Media** ← 7 Mile Media - Ghost Sales + 7 Mile Media - The Teacher Project → built 117 / delivered 114 / 2022–2023 / frozen — ⚠ two sub-projects; may be distinct clients, not one

## Not-a-client operational lists (flagged — exclude from a client visual?)
- **ADM - CRO** (active) — Fusion92's own internal CRO admin board, not a client.
- **Ad Hoc** / **Admin** (Neighborly, active) — catch-all buckets, not clients.
- **GUY - The Grounds Guys** & **SXP - Smile Express** show as *frozen* — they sit in the Client Archive here; their live work now lives in Jira, not ClickUp.

## Directory (sorted by built desc)

| # | Code | Client | Built | Deliv | Years | Status |
|--:|:--|:--|--:|--:|:--|:--|
| 1 | SPL | Spotloan ✱ | 233 | 232 | 2019–2025 | active+frozen |
| 2 |  | 1UP Nutrition | 217 | 214 | 2021–2024 | frozen |
| 3 |  | Moon Juice | 210 | 207 | 2022–2024 | frozen |
| 4 |  | Solgaard ✱ | 190 | 187 | 2021–2023 | frozen |
| 5 |  | Lancer Skincare | 188 | 188 | 2019–2024 | frozen |
| 6 |  | People Finders | 188 | 187 | 2022–2023 | frozen |
| 7 |  | Auto Brush | 178 | 178 | 2021–2022 | frozen |
| 8 | MLY | MLY - Molly Maid | 172 | 167 | 2023–2025 | active |
| 9 |  | Bec + Bridge ✱ | 172 | 164 | 2021–2022 | frozen |
| 10 | DWH | DWH - David Weekley Homes | 169 | 168 | 2020–2025 | active |
| 11 |  | Lexie Hearing | 157 | 155 | 2022–2024 | frozen |
| 12 | MRR | MRR - Mr Rooter | 155 | 152 | 2023–2025 | active |
| 13 |  | Thin Slim | 150 | 150 | 2021–2024 | frozen |
| 14 |  | Fit Track ✱ | 150 | 148 | 2020–2021 | frozen |
| 15 | ASV | ASV - Aire Serv | 150 | 145 | 2023–2025 | active |
| 16 | FSP | FSP - Five Star Painting | 146 | 145 | 2023–2025 | active |
| 17 |  | Stamps ✱ | 143 | 122 | 2023–2024 | frozen |
| 18 |  | Catholic Company | 139 | 134 | 2020–2022 | frozen |
| 19 |  | Just Thrive | 138 | 136 | 2021–2023 | frozen |
| 20 |  | V1CE | 137 | 130 | 2021–2022 | frozen |
| 21 | FPOO | FPOO - Fresh Pressed Olive Oil | 135 | 132 | 2021–2026 | active |
| 22 | MRA | MRA - Mr Appliance | 128 | 126 | 2023–2025 | active |
| 23 |  | IncFile | 127 | 123 | 2021–2023 | frozen |
| 24 |  | Tru.Earth | 122 | 117 | 2022–2023 | frozen |
| 25 |  | Primal Life Organics | 122 | 115 | 2021–2024 | frozen |
| 26 |  | MedCline | 121 | 120 | 2019–2020 | frozen |
| 27 |  | Cheese Brothers | 120 | 118 | 2023–2024 | frozen |
| 28 |  | 7 Mile Media ✱ | 117 | 114 | 2022–2023 | frozen |
| 29 |  | HumanN | 116 | 114 | 2021–2022 | frozen |
| 30 | MRE | MRE - Mr Electric | 111 | 107 | 2023–2025 | active |
| 31 | PDS | PDS - Precision Garage Door | 111 | 107 | 2025 | active |
| 32 |  | DowJanes | 104 | 97 | 2022–2023 | frozen |
| 33 |  | Ikonick | 102 | 98 | 2019–2020 | frozen |
| 34 | DW | DW - DentalWorks | 101 | 99 | 2025 | active |
| 35 | LF | LF - LightsFest | 100 | 93 | 2023–2025 | active |
| 36 | MDG | MDG - Glass Doctor | 96 | 90 | 2024–2025 | active |
| 37 | SHS | SHS - SunHomeSaunas | 93 | 86 | 2024–2025 | frozen |
| 38 |  | Built With Science | 87 | 85 | 2019–2021 | frozen |
| 39 |  | Notebook Therapy | 83 | 72 | 2022–2023 | frozen |
| 40 | MRH | MRH - Mr Handyman | 80 | 78 | 2023–2025 | active |
| 41 |  | Burga | 80 | 77 | 2020–2021 | frozen |
| 42 |  | Artifox | 80 | 75 | 2019–2020 | frozen |
| 43 |  | Social Media Examiner | 79 | 77 | 2019 | frozen |
| 44 |  | Snow | 79 | 76 | 2020–2021 | frozen |
| 45 |  | Vintage Muscle | 79 | 74 | 2023–2024 | frozen |
| 46 |  | Magnolia | 79 | 69 | 2019–2020 | frozen |
| 47 |  | Honest Paws | 78 | 75 | 2019–2020 | frozen |
| 48 |  | ClickFunnels | 76 | 75 | 2020–2021 | frozen |
| 49 |  | Kiteworks ✱ | 76 | 72 | 2023–2024 | frozen |
| 50 |  | Live Bearded | 75 | 73 | 2019–2020 | frozen |
| 51 |  | Kate Hewko | 74 | 70 | 2022 | frozen |
| 52 |  | Piper Lou Collection | 74 | 53 | 2021–2022 | frozen |
| 53 |  | Countrywide Testing | 71 | 70 | 2020–2021 | frozen |
| 54 |  | Empire Covers | 70 | 63 | 2023–2024 | frozen |
| 55 |  | Feals | 69 | 67 | 2022–2023 | frozen |
| 56 |  | Earthling Co. | 68 | 67 | 2021–2022 | frozen |
| 57 |  | Everlasting Comfort | 68 | 66 | 2021–2022 | frozen |
| 58 |  | George and Willy | 68 | 65 | 2022–2023 | frozen |
| 59 |  | Bella Belle | 67 | 61 | 2022 | frozen |
| 60 |  | The Last Coat | 66 | 63 | 2019–2020 | frozen |
| 61 |  | Crated With Love | 66 | 63 | 2021–2022 | frozen |
| 62 |  | MisakiCon | 65 | 64 | 2021–2022 | frozen |
| 63 |  | Private Label | 65 | 63 | 2021–2022 | frozen |
| 64 |  | Underwater Audio | 65 | 60 | 2023 | frozen |
| 65 | ADM | ADM - CRO | 65 | 57 | 2024–2025 | active |
| 66 |  | Innovo | 63 | 60 | 2022 | frozen |
| 67 |  | UKMedi | 62 | 60 | 2022 | frozen |
| 68 |  | Oru Kayak | 62 | 59 | 2022 | frozen |
| 69 |  | goPure | 62 | 59 | 2019 | frozen |
| 70 |  | Relearnit | 62 | 58 | 2022–2023 | frozen |
| 71 |  | VetFriends | 62 | 58 | 2019–2020 | frozen |
| 72 |  | Vanity Planet | 62 | 55 | 2020 | frozen |
| 73 |  | Blackjack Apprenticeship | 61 | 61 | 2022–2023 | frozen |
| 74 |  | Teren Designs | 61 | 59 | 2022 | frozen |
| 75 |  | AREA15 | 60 | 57 | 2023–2024 | frozen |
| 76 |  | Aphrodite's | 60 | 57 | 2019–2020 | frozen |
| 77 |  | Nine Months Sober | 60 | 57 | 2019 | frozen |
| 78 |  | Porch Potty | 59 | 58 | 2021–2022 | frozen |
| 79 |  | F-Formula | 59 | 55 | 2022 | frozen |
| 80 |  | ECO. Modern Essentials | 58 | 57 | 2021–2022 | frozen |
| 81 |  | Fast Home Offer | 58 | 56 | 2021–2022 | frozen |
| 82 |  | We The People Holsters | 57 | 57 | 2021–2022 | frozen |
| 83 |  | SneakPeek | 57 | 56 | 2021 | frozen |
| 84 |  | Freedom Grooming | 57 | 56 | 2021–2022 | frozen |
| 85 |  | Latico Leathers | 57 | 55 | 2021–2022 | frozen |
| 86 |  | Toynk | 56 | 56 | 2023 | frozen |
| 87 |  | Quality Of Life | 56 | 55 | 2020–2021 | frozen |
| 88 |  | Harv Eker | 56 | 54 | 2019–2020 | frozen |
| 89 |  | Ancaster | 56 | 53 | 2022 | frozen |
| 90 |  | Porter Collective | 56 | 50 | 2021–2022 | frozen |
| 91 |  | Old School Labs | 56 | 47 | 2022 | frozen |
| 92 |  | Urban Brew | 55 | 54 | 2021–2022 | frozen |
| 93 |  | AlenCorp | 55 | 52 | 2019 | frozen |
| 94 |  | PartsVu | 54 | 52 | 2022–2023 | frozen |
| 95 |  | Aventon | 54 | 51 | 2021–2022 | frozen |
| 96 |  | FaithGateway | 53 | 52 | 2021–2022 | frozen |
| 97 |  | Cheeky Chickadee | 53 | 51 | 2021–2022 | frozen |
| 98 | GUY | GUY - The Grounds Guys | 53 | 50 | 2023–2024 | frozen |
| 99 | MOJ | MOJ - Mosquito Joe | 53 | 49 | 2024–2025 | active |
| 100 |  | Intoxalock | 53 | 47 | 2022–2023 | frozen |
| 101 |  | Riversol | 52 | 48 | 2020 | frozen |
| 102 |  | Happily Hooked | 52 | 47 | 2020 | frozen |
| 103 | WDG | WDG - Window Genie | 52 | 47 | 2024–2025 | active |
| 104 |  | Earth Echo/Mindful Health | 51 | 51 | 2020–2021 | frozen |
| 105 |  | Annuity Gator | 51 | 51 | 2020 | frozen |
| 106 |  | Life Pro Fitness | 51 | 50 | 2020 | frozen |
| 107 |  | Strutmasters | 51 | 49 | 2021–2022 | frozen |
| 108 |  | Rockay | 51 | 47 | 2019–2020 | frozen |
| 109 |  | PushPay | 51 | 43 | 2019–2020 | frozen |
| 110 |  | Beautiful Earth | 50 | 50 | 2021 | frozen |
| 111 |  | Gear Bubble | 50 | 49 | 2020–2021 | frozen |
| 112 |  | HelloMood | 50 | 48 | 2022–2023 | frozen |
| 113 |  | Nomadik | 49 | 47 | 2021–2022 | frozen |
| 114 |  | Bitcoin Worldwide | 49 | 47 | 2021–2022 | frozen |
| 115 |  | 2Modern | 49 | 46 | 2022 | frozen |
| 116 |  | Night Buddy | 49 | 45 | 2022–2023 | frozen |
| 117 |  | Mathnasium | 49 | 40 | 2023 | frozen |
| 118 |  | Native Path | 48 | 44 | 2020–2021 | frozen |
| 119 |  | Woolly | 48 | 44 | 2020–2021 | frozen |
| 120 |  | Lindye Galloway | 48 | 41 | 2023–2024 | frozen |
| 121 |  | Moonglow | 47 | 45 | 2019 | frozen |
| 122 |  | Fringe Sport | 47 | 42 | 2022 | frozen |
| 123 |  | Detox Organics | 46 | 44 | 2020–2021 | frozen |
| 124 |  | AE Juice | 46 | 44 | 2021 | frozen |
| 125 |  | Carly Jean | 46 | 42 | 2023–2024 | frozen |
| 126 |  | ByWinona | 46 | 39 | 2024 | frozen |
| 127 |  | Corinthians Corner | 45 | 44 | 2021–2022 | frozen |
| 128 |  | Linenbundle | 45 | 42 | 2019–2020 | frozen |
| 129 |  | Go Hearing | 45 | 41 | 2023–2024 | frozen |
| 130 |  | WPForms | 44 | 42 | 2019–2020 | frozen |
| 131 |  | Pass Your Test | 44 | 38 | 2020 | frozen |
| 132 |  | Guardian Alarm | 43 | 43 | 2023–2024 | frozen |
| 133 |  | Flow Research | 43 | 41 | 2022–2023 | frozen |
| 134 |  | SmilePro Worldwide | 43 | 40 | 2020–2021 | frozen |
| 135 |  | Amourprints | 42 | 41 | 2021 | frozen |
| 136 |  | Stella Valle | 42 | 37 | 2020 | frozen |
| 137 |  | ADMIS | 41 | 40 | 2023 | frozen |
| 138 |  | Big Life Journal | 41 | 40 | 2020–2021 | frozen |
| 139 |  | Long & Foster | 41 | 36 | 2021–2022 | frozen |
| 140 |  | Nano Hearing Aids | 41 | 34 | 2019 | frozen |
| 141 |  | ADAY | 40 | 39 | 2019–2020 | frozen |
| 142 |  | EpicLand | 40 | 38 | 2020 | frozen |
| 143 |  | BNB Formula | 40 | 38 | 2022 | frozen |
| 144 |  | Rasa | 40 | 38 | 2020–2021 | frozen |
| 145 |  | VapeBright | 40 | 38 | 2019 | frozen |
| 146 |  | Edumind | 40 | 35 | 2022–2023 | frozen |
| 147 |  | Strideline | 39 | 39 | 2020–2021 | frozen |
| 148 |  | DrTalks | 39 | 38 | 2023 | frozen |
| 149 |  | Interview Kickstart | 39 | 38 | 2022 | frozen |
| 150 |  | Theradome | 39 | 38 | 2023 | frozen |
| 151 |  | Laundry Sauce | 39 | 38 | 2021–2022 | frozen |
| 152 |  | Embr Labs | 39 | 37 | 2022–2023 | frozen |
| 153 |  | PutterBall | 39 | 37 | 2019 | frozen |
| 154 | BRI | BRI - Brident | 39 | 37 | 2024–2025 | active |
| 155 |  | Lowbrow Customs | 39 | 36 | 2019 | frozen |
| 156 |  | RoseSkinCo | 39 | 35 | 2020–2021 | frozen |
| 157 |  | Investor's Business Daily | 38 | 37 | 2021–2022 | frozen |
| 158 |  | Stamina Pro | 38 | 35 | 2020 | frozen |
| 159 |  | Imbodhi | 38 | 35 | 2022 | frozen |
| 160 |  | Franchise | 38 | 34 | 2023 | frozen |
| 161 |  | Venus Et Fleur | 38 | 34 | 2019 | frozen |
| 162 |  | My Green Mattress | 37 | 35 | 2022 | frozen |
| 163 |  | National University | 37 | 35 | 2022 | frozen |
| 164 |  | GoodieCo | 37 | 35 | 2021 | frozen |
| 165 |  | Kidoriman | 36 | 33 | 2021 | frozen |
| 166 |  | 99 Jersey | 36 | 32 | 2021 | frozen |
| 167 |  | Natural Vitality | 35 | 35 | 2019–2020 | frozen |
| 168 |  | Contact Monkey | 35 | 33 | 2022 | frozen |
| 169 |  | Coolina | 35 | 33 | 2023–2024 | frozen |
| 170 |  | Averr Aglow | 35 | 33 | 2020 | frozen |
| 171 |  | Yogaworks | 35 | 32 | 2024 | frozen |
| 172 |  | XCJ | 35 | 32 | 2022 | frozen |
| 173 |  | Canvas Cultures | 35 | 31 | 2019 | frozen |
| 174 |  | Keeva Organics | 35 | 31 | 2019 | frozen |
| 175 |  | Renew Life | 34 | 34 | 2019 | frozen |
| 176 |  | Tushy | 34 | 31 | 2020 | frozen |
| 177 |  | Kozakh | 34 | 26 | 2022 | frozen |
| 178 |  | Haven Lock | 33 | 33 | 2021–2022 | frozen |
| 179 |  | ProjectHomeDIY | 33 | 30 | 2023 | frozen |
| 180 |  | Juvabun | 32 | 31 | 2021 | frozen |
| 181 |  | Vital Choice | 32 | 31 | 2020–2022 | frozen |
| 182 |  | Harry & David (1) | 32 | 26 | 2022 | frozen |
| 183 |  | Survival Frog | 31 | 29 | 2021 | frozen |
| 184 |  | Centime | 31 | 28 | 2022 | frozen |
| 185 |  | TopOneTrader | 31 | 26 | 2024 | frozen |
| 186 |  | MoodFabrics | 31 | 25 | 2022 | frozen |
| 187 |  | MCMC Auto | 31 | 24 | 2022 | frozen |
| 188 |  | Little and Lively | 30 | 29 | 2020 | frozen |
| 189 |  | Wicca Academy | 30 | 29 | 2022 | frozen |
| 190 |  | Feel Great 365 | 30 | 28 | 2019 | frozen |
| 191 |  | Peaceful Profits | 30 | 26 | 2021–2022 | frozen |
| 192 |  | 99 Walks | 29 | 28 | 2021 | frozen |
| 193 |  | Rustic and Main | 29 | 27 | 2021 | frozen |
| 194 |  | Doheny Bike | 29 | 27 | 2022–2023 | frozen |
| 195 |  | Outstanding Foods | 29 | 26 | 2020–2021 | frozen |
| 196 |  | Revitive | 29 | 26 | 2022 | frozen |
| 197 |  | EBY | 29 | 24 | 2020 | frozen |
| 198 |  | Quality Water Treatment | 28 | 28 | 2020 | frozen |
| 199 |  | Cellular Outfitter | 28 | 27 | 2021 | frozen |
| 200 |  | Publishing Life | 28 | 25 | 2022 | frozen |
| 201 |  | Burt's Bees | 28 | 24 | 2019–2020 | frozen |
| 202 |  | Tailored Canvases | 27 | 25 | 2020–2021 | frozen |
| 203 |  | Fig & Bloom | 26 | 26 | 2021 | frozen |
| 204 |  | 1 Body | 26 | 25 | 2019 | frozen |
| 205 |  | SafeMend | 26 | 24 | 2021 | frozen |
| 206 |  | Feed, The | 26 | 21 | 2021 | frozen |
| 207 |  | Wonder Ear | 26 | 19 | 2021 | frozen |
| 208 |  | Rainbow Light | 25 | 25 | 2019–2020 | frozen |
| 209 |  | Ad Hoc | 25 | 25 | 2025 | active |
| 210 |  | MikeTyson12Rounds | 25 | 23 | 2022–2023 | frozen |
| 211 |  | Cancel Form | 24 | 24 | 2020 | frozen |
| 212 |  | English Laundry | 24 | 24 | 2019 | frozen |
| 213 |  | Thrive Talk | 24 | 23 | 2019 | frozen |
| 214 |  | Wash Warrior | 23 | 23 | 2021 | frozen |
| 215 |  | RVnGO | 23 | 22 | 2022 | frozen |
| 216 |  | Pentagon Fit | 23 | 22 | 2021 | frozen |
| 217 |  | Shabby Chic | 23 | 20 | 2020 | frozen |
| 218 |  | Statistics Solutions | 23 | 20 | 2022 | frozen |
| 219 |  | Data Centers | 23 | 20 | 2022 | frozen |
| 220 |  | My Green Fills | 22 | 20 | 2020 | frozen |
| 221 |  | Entre Institute | 22 | 20 | 2020–2021 | frozen |
| 222 |  | Europamas | 22 | 20 | 2021 | frozen |
| 223 |  | RedHawkRifles | 21 | 20 | 2023 | frozen |
| 224 |  | Salt Strong | 21 | 20 | 2021 | frozen |
| 225 | WD | WD - Western Dental | 20 | 19 | 2025 | active |
| 226 |  | Credit Solutions Program | 20 | 16 | 2020 | frozen |
| 227 |  | Neat | 19 | 18 | 2021 | frozen |
| 228 |  | Toby & Ace | 19 | 18 | 2021 | frozen |
| 229 |  | Veteran TV | 19 | 17 | 2021 | frozen |
| 230 |  | Breezy Swimwear | 19 | 17 | 2020 | frozen |
| 231 |  | Imperia Caviar | 19 | 16 | 2019–2020 | frozen |
| 232 |  | Miracle Noodle | 18 | 18 | 2019 | frozen |
| 233 |  | Anson Calder | 18 | 17 | 2020 | frozen |
| 234 |  | Christian Faith Publishing | 18 | 16 | 2022 | frozen |
| 235 |  | HiitBurn | 18 | 13 | 2019–2020 | frozen |
| 236 |  | Page Publishing | 17 | 17 | 2022 | frozen |
| 237 |  | Succy Crafts | 17 | 17 | 2021 | frozen |
| 238 |  | Dolman Law | 17 | 16 | 2020 | frozen |
| 239 |  | StrongPointDigital | 17 | 14 | 2024 | frozen |
| 240 |  | Ministry of Supply | 16 | 13 | 2019 | frozen |
| 241 |  | Heartland Dental | 16 | 5 | 2022 | frozen |
| 242 |  | Growth Day | 15 | 11 | 2022 | frozen |
| 243 | SXP | SXP - Smile Express | 13 | 13 | 2025 | frozen |
| 244 |  | Cousin T's | 13 | 13 | 2022 | frozen |
| 245 |  | Wild Earth | 13 | 12 | 2020–2021 | frozen |
| 246 |  | LuckyVItamin | 13 | 9 | 2022 | frozen |
| 247 |  | Wonder Bulb | 13 | 3 | 2021 | frozen |
| 248 |  | NeoCell | 10 | 9 | 2020 | frozen |
| 249 | JUK | JUK - Junk King | 9 | 8 | 2025 | active |
| 250 |  | Sand Cloud | 9 | 7 | 2019 | frozen |
| 251 |  | Infinite Age | 9 | 6 | 2020 | frozen |
| 252 |  | Primo Management | 8 | 8 | 2021 | frozen |
| 253 |  | Inbox Experts | 6 | 6 | 2020 | frozen |
| 254 |  | Biostrap | 6 | 3 | 2019 | frozen |
| 255 | INT | INT - Sonrava AM/PM | 4 | 4 | 2025 | active |
| 256 |  | Beauty By Design | 4 | 3 | 2019 | frozen |
| 257 |  | Magnolia Mockups | 1 | 1 | 2019 | frozen |
| 258 |  | Admin | 1 | 1 | 2025 | active |
| 259 | PT | PT - PerfectTeeth | 1 | 1 | 2025 | active |

✱ = merged from multiple lists (see Merges above).