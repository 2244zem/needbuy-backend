-- Pemasukan penjual dari pesanan yang selesai.
-- Sebelumnya komisi hanya dicatat di kolom orders.commission_amount untuk
-- laporan, dan tidak ada mutasi dompet apa pun untuk penjual — jadi penjual
-- tidak pernah benar-benar menerima uang ke NeedPay-nya.
ALTER TYPE "WalletTxType" ADD VALUE IF NOT EXISTS 'EARNING';
