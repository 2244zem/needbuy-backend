# Image untuk Railway. Dockerfile dipilih daripada builder otomatis (Nixpacks)
# supaya hasilnya sama persis di mana pun — kalau kredit Railway habis dan harus
# pindah host, berkas ini ikut dan tidak ada yang perlu dikonfigurasi ulang.
FROM node:20-slim

# Prisma butuh openssl, dan image -slim tidak membawanya.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Skema Prisma disalin SEBELUM npm ci, karena `postinstall: prisma generate`
# jalan di dalam npm ci dan butuh berkas skemanya sudah ada.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

# Railway menyuntikkan PORT sendiri; nilai ini hanya default kalau tidak diisi.
ENV PORT=8000
EXPOSE 8000

# `npm start` menjalankan `prisma migrate deploy` dulu, baru server.
CMD ["npm", "start"]
