# Speedrun Ethereum Journey

Repo chung cho ba challenge, moi challenge giu Yarn workspace va lockfile rieng.

| Challenge | Vercel project | Root Directory |
| --- | --- | --- |
| Crowdfunding | sre-crowdfunding | `challenge-crowdfunding/packages/nextjs` |
| Tokenization | sre-tokenization | `challenge-tokenization/packages/nextjs` |
| Token Vendor | sre-token-vendor | `challenge-token-vendor/packages/nextjs` |

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

## Git migration backup

Source cua cac challenge duoc quan ly truc tiep boi repo nay, khong con gitlink/submodule.
Lich su Git rieng truoc khi chuyen duoc giu local tai `.git/challenge-repositories-backup/`.
Ban sao index repo cha la `parent-index.before-migration` trong thu muc do.
No khong duoc push len GitHub. Cac thay doi source chua commit truoc migration van duoc giu nguyen.
