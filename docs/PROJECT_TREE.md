# BetZone – Project Tree

```
betzone/
├─ prisma/
│  ├─ schema.prisma              # User, Wallet, Bet, BetLeg, BookingCode, Transaction, Fixture, Market, Selection
│  └─ seed.ts                    # loads mock fixtures
├─ server/
│  ├─ socket.ts                  # Socket.io: odds + score ticker (3–5s)
│  ├─ oddsEngine.ts              # random-walk odds, suspension logic
│  └─ cashout.ts                 # cash-out offer calc (full / partial / auto)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ globals.css
│  │  ├─ page.tsx                # Home (desktop 3-col / mobile feed)
│  │  ├─ live/page.tsx
│  │  ├─ virtuals/page.tsx
│  │  ├─ jackpot/page.tsx
│  │  ├─ promotions/page.tsx
│  │  ├─ match/[id]/page.tsx     # all markets for one fixture
│  │  ├─ my-bets/page.tsx        # Active / Settled / Cashout
│  │  ├─ me/
│  │  │  ├─ page.tsx             # account dashboard
│  │  │  ├─ deposit/page.tsx
│  │  │  ├─ withdraw/page.tsx
│  │  │  └─ transactions/page.tsx
│  │  ├─ m/                      # mobile-first routes
│  │  │  ├─ layout.tsx           # bottom nav shell
│  │  │  ├─ page.tsx
│  │  │  └─ slip/page.tsx
│  │  └─ api/
│  │     ├─ fixtures/route.ts
│  │     ├─ booking/route.ts            # POST generate
│  │     ├─ booking/[code]/route.ts     # GET load + validate
│  │     ├─ bets/route.ts
│  │     ├─ cashout/route.ts
│  │     ├─ wallet/deposit/route.ts
│  │     └─ wallet/withdraw/route.ts
│  ├─ components/
│  │  ├─ layout/    Header, NavBar, LeftSidebar, RightSidebar, BottomNav
│  │  ├─ home/      BannerCarousel, LiveTicker, TimeFilterTabs
│  │  ├─ match/     LeagueAccordion, MatchRow, MarketTabs, OddsButton, MoreMarketsButton
│  │  ├─ betslip/   BetSlip, SlipTabs, SelectionCard, StakeBox, FlexiToggle, BookingPanel
│  │  ├─ wallet/    DepositFlow, MomoPrompt, CardForm, UssdSim, WithdrawPinModal, TxTable
│  │  └─ ui/        Button, Badge, Modal, Toast
│  ├─ store/
│  │  ├─ betslipStore.ts         # Zustand + persist
│  │  ├─ oddsStore.ts            # live odds map + flash direction
│  │  └─ walletStore.ts
│  ├─ lib/
│  │  ├─ bookingCode.ts          # generate / parse / validate
│  │  ├─ betMath.ts              # total odds, payout, bonus, flexi cuts
│  │  ├─ prisma.ts
│  │  └─ socketClient.ts
│  ├─ data/
│  │  └─ fixtures.ts             # mock matches + deep markets
│  └─ types/index.ts
├─ tailwind.config.ts
├─ next.config.mjs
├─ package.json
└─ .env.example
```

Install: `npx create-next-app@latest betzone --ts --tailwind --app`
then `npm i zustand framer-motion lucide-react socket.io socket.io-client @prisma/client && npm i -D prisma`
