# Vijayalakshmi Gems

A new gemstone and jewellery shop, separate from any other project. The phone app and the configuration desk both read and write one API. Nothing the shopper sees is hard-coded in the app: stones, prices, currencies, banners, advice rules, reviews, and help pages come from the server.

## Parts

- `server` — Node.js API. Catalog, accounts, bag, orders, advice, and the desk all live here. Data is stored in a local SQLite file.
- `portal` — React desk for staff. Editing a piece, a rate, or a rashi window changes what the phone shows on the next load.
- `mobile` — Expo React Native app for shoppers.

## Run

From three terminals, inside this folder:

```bash
npm install --prefix server && npm start --prefix server
npm install --prefix portal && npm run dev --prefix portal
npm install --prefix mobile && npm start --prefix mobile
```

- API: http://localhost:4000
- Desk: http://localhost:5173
- Phone: Expo. Press `w` for the browser, or scan the QR code. On a physical phone, set `EXPO_PUBLIC_API_URL` to this computer's address, for example `http://192.168.1.20:4000`.

## Local sign-in

- Staff desk: `admin@vijayalakshmi.local` / `Admin@123`
- Sample shopper: `meera@vijayalakshmi.local` / `Demo@123`

Prices are kept in US dollars. The app multiplies by the currency rate from the desk. Advice uses the rashi date windows and the purpose-to-stone map, and the suggested carat is body weight divided by the divisor in atelier settings.
