# Image untuk Railway. Dockerfile dipilih daripada builder otomatis (Nixpacks)
# supaya hasilnya sama persis di mana pun — kalau kredit Railway habis dan harus
# pindah host, berkas ini ikut dan tidak ada yang perlu dikonfigurasi ulang.
FROM node:20-slim

# Prisma butuh openssl, dan image -slim tidak membawanya.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# `prisma generate` jalan di dalam `npm ci` lewat script postinstall, dan
# MENOLAK berjalan kalau DATABASE_URL / DIRECT_URL tidak ada — walau dia tidak
# benar-benar menyambung ke database saat generate.
#
# Railway hanya menyuntikkan variable ke runtime, tidak ke tahap build
# Dockerfile. Jadi di sini diisi nilai semu.
#
# Sengaja ARG, bukan ENV: nilai ARG hanya hidup selama build dan TIDAK ikut ke
# image jadi. Saat container jalan, yang dipakai murni variable dari Railway.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG DIRECT_URL="postgresql://build:build@localhost:5432/build"

# Skema Prisma disalin SEBELUM npm ci, karena generate butuh berkas skemanya.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

# Railway menyuntikkan PORT sendiri; nilai ini hanya default kalau tidak diisi.
ENV PORT=8000
EXPOSE 8000

COPY docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

CMD ["./docker-entrypoint.sh"]
