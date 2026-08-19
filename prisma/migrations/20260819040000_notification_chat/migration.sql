-- Tipe notifikasi baru untuk pesan masuk.
-- Dipakai supaya penjual tahu ada pembeli yang menghubunginya; sebelumnya
-- modul messages tidak membuat notifikasi sama sekali.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHAT';
