# Speedrun Ethereum Journey

Repo chung cho cac challenge, moi challenge giu Yarn workspace va lockfile rieng.

| Challenge | Vercel project | Root Directory |
| --- | --- | --- |
| Crowdfunding | sre-crowdfunding | `challenge-crowdfunding/packages/nextjs` |
| Tokenization | sre-tokenization | `challenge-tokenization/packages/nextjs` |
| Token Vendor | sre-token-vendor | `challenge-token-vendor/packages/nextjs` |
| DEX (challenge 4) | sre-dex | `challenge-dex/packages/nextjs` |
| Dice Game (challenge 3) | sre-dice-game | `challenge-dice-game/packages/nextjs` |
| Oracles (challenge 5) | sre-oracles | `challenge-oracles/packages/nextjs` |

## Chay local

Dung Node.js 22 (>=22.10) va Corepack. Trong thu muc challenge tuong ung:

```sh
corepack enable
yarn install --immutable
yarn chain
# Terminal khac, cung thu muc challenge:
yarn deploy
yarn start
```

`NEXT_PUBLIC_TARGET_NETWORK=hardhat` trong `packages/nextjs/.env.local` de dung chain local.
Tokenization giu mac dinh Sepolia; hai challenge con lai dung Hardhat khi development.
Production build cua ca ba mac dinh dung Sepolia. Co the ghi de bang bien tren.

## Oracles (challenge 5)

Da trien khai WhitelistOracle, StakingOracle va OptimisticOracle trong `challenge-oracles`.
Bao cao: [reports/challenge5-oracles.tex](reports/challenge5-oracles.tex).
Bo test gom 81 ca goc va 7 ca bien bo sung. Chay `yarn test` trong thu muc challenge.

Chay `yarn chain`, `yarn deploy`, `yarn start` o ba terminal; truy cap
`http://localhost:3000/whitelist`, `/staking`, `/optimistic`.
De seed local khong phu thuoc mainnet RPC, dat `ORACLE_INITIAL_PRICE_WEI=2600000000000000000000`
truoc khi `yarn deploy` (gia mo phong 2600, khong phai gia thi truong).
Sau deploy co the kiem tra bytecode va lien ket bang
`yarn workspace @se-2/hardhat node scripts/check-local-deployment.mjs`.

Development mac dinh Hardhat, production mac dinh Sepolia; ghi de bang `NEXT_PUBLIC_TARGET_NETWORK`.
Da deploy 5 contracts len Sepolia va kiem tra bytecode/lien ket qua RPC.
Frontend: https://sre-oracles-steel.vercel.app/ (trang chu va ba trang oracle tra HTTP 200).
Chua xac nhan giao dich qua vi tren frontend cong khai hoac submit. Lenh deploy testnet can
mat khau deployer nhap truc tiep trong terminal. Giu nguyen cac quyen mo trong SimpleOracle/Decider
theo skeleton bai hoc; ban demo nay chua phu hop de su dung cho tai san that.

## Deploy contracts truoc khi deploy frontend

Chay thu cong trong tung thu muc challenge (cac lenh account/deploy co the hoi mat khau):

```sh
yarn generate
yarn account
# Nap Sepolia ETH cho deployer, roi:
yarn deploy --network sepolia
yarn verify --network sepolia
```

Neu da co deployer, dung account hien co thay vi tao lai.
Deploy tu dong cap nhat `packages/nextjs/contracts/deployedContracts.ts`; commit file nay cung source.
Khong sua ABI/address thu cong. Crowdfunding va Token Vendor hien chua co deployment Sepolia
trong file nay; frontend can deployment do de tuong tac duoc voi contracts.

## Ket noi Vercel

1. Push source len `https://github.com/DatNguyenss/speedrunethereum-journey`.
2. Import cung repo thanh ba Vercel projects, dat Root Directory theo bang tren.
3. Chon framework Next.js, Node.js 22.x, bat **Include source files outside of the Root Directory in the Build Step**.
4. Giu Install Command va Build Command theo `vercel.json` cua tung frontend; output la `.next`.
5. Them environment variables cho ca Production va Preview:
   - `NEXT_PUBLIC_TARGET_NETWORK=sepolia`
   - `NEXT_PUBLIC_ALCHEMY_API_KEY`: API key cua ban.
   - `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`: project ID cua ban.
6. Deploy; cac lan push tiep theo se duoc Vercel Git integration deploy tu dong.

Root Directory la setting tren Vercel, khong phai truong trong `vercel.json`.
Khong dua private key, mnemonic, deployer password hay Hardhat `.env` len Vercel.
Khong can GitHub Actions hay Vercel token cho cach ket noi Git nay.

Tai lieu: https://vercel.com/docs/monorepos va https://vercel.com/docs/monorepos/monorepo-faq

## Crowdfunding (challenge 1)

Contract da hoan thien contribute/receive, deadline, execute va refund, kem bao ve sau khi hoan tat.
Deadline: 30 giay tren local chain 31337, 24 gio tren testnet. Threshold: 1 ETH.
Frontend cho phep nhap so ETH, mac dinh 0.01 ETH; khoa cac nut theo trang thai campaign.

De dua challenge 1 len Sepolia, mo terminal trong `challenge-crowdfunding`:

```sh
yarn generate
# Tu dat mat khau trong terminal, luu lai dia chi deployer va nap Sepolia ETH cho dia chi do.
yarn deploy --network sepolia
yarn verify --network sepolia
```

Khong can tao lai deployer neu da co. Sau khi deploy, commit va push file ABI duoc tao tu dong.
Tao project Vercel rieng voi Root Directory `challenge-crowdfunding/packages/nextjs` va
`NEXT_PUBLIC_TARGET_NETWORK=sepolia`; khong doi Root Directory cua project Tokenization.
De submit challenge 1, dung URL Vercel moi va URL Etherscan cua **CrowdFund** tren Sepolia.
Dia chi 31337 trong ABI chi danh cho local, khong dung de submit.

## DEX (challenge 4)

Hoan thien swap ETH/BAL voi phi 0.3%, approve, them/rut thanh khoan va getLiquidity.
Contract co bao ve reentrancy, kiem tra pool, so du, allowance va LP shares.
Balloons.sol duoc giu nguyen theo de bai.

Chay local trong `challenge-dex`: `yarn chain`, `yarn deploy`, `yarn start` (cac terminal rieng).
Deploy script khoi tao pool 5 ETH + 5 BAL tren local; tren Sepolia chi dung 0.005 ETH test + 5 BAL.
Co the doi `DEX_INITIAL_ETH` va `DEX_INITIAL_TOKENS` trong `packages/hardhat/.env`.
Gui them ETH Sepolia cho deployer de du ca thanh khoan ban dau va gas; khong can mua ETH mainnet.
Neu approve/init bi gian doan, chay lai deploy khong kem `--reset` de tiep tuc.

Dung lai vi deployer hien co, chay tu thu muc goc repo:

```powershell
cd challenge-dex
Copy-Item ..\challenge-crowdfunding\packages\hardhat\.env .\packages\hardhat\.env
yarn deploy --network sepolia
yarn verify --network sepolia
```

Nhap mat khau deployer trong terminal. Tuy chon dat `FRONTEND_ADDRESS` la dia chi MetaMask
de nhan 10 BAL khi deploy moi; neu de trong, nguoi dung van co the mua BAL bang ETH test.
LP shares cua thanh khoan khoi tao thuoc deployer; vi MetaMask khac co the deposit de co LP shares rieng.

Vercel: tao project rieng, Root Directory `challenge-dex/packages/nextjs`, Next.js, Node 22.x,
bat include source files outside Root Directory, bien `NEXT_PUBLIC_TARGET_NETWORK=sepolia`.
Commit file `deployedContracts.ts` va deployment Sepolia duoc sinh ra sau deploy truoc khi deploy frontend.
Frontend production mac dinh Sepolia; local mac dinh Hardhat, co the ghi de bang bien mang tren.
Trong trang DEX: mua BAL, approve DEX, swap BAL ra ETH, deposit ETH/BAL va withdraw LP shares.
Khi submit, dung URL Vercel rieng va Etherscan URL cua **DEX**, khong phai Balloons.

## Git migration backup

Source cua cac challenge duoc quan ly truc tiep boi repo nay, khong con gitlink/submodule.
Lich su Git rieng truoc khi chuyen duoc giu local tai `.git/challenge-repositories-backup/`.
Ban sao index repo cha la `parent-index.before-migration` trong thu muc do.
No khong duoc push len GitHub. Cac thay doi source chua commit truoc migration van duoc giu nguyen.
