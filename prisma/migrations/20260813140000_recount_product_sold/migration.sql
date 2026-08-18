-- Hitung ulang products.sold_count dari order yang benar-benar terjadi.
--
-- Sebelum ini soldCount hanya bertambah saat order COMPLETED, dan COMPLETED
-- butuh pembeli menekan "pesanan diterima" — praktisnya tidak pernah tercapai,
-- jadi angka "terjual" selamanya 0 meski produknya laku.
--
-- Yang dihitung: order yang sudah masuk PROCESSING ke atas. WAITING_PAYMENT
-- belum tentu jadi, CANCELLED jelas tidak jadi.
UPDATE "products" p
SET "sold_count" = COALESCE(s.qty, 0)
FROM (
  SELECT p2."id" AS product_id,
         (SELECT SUM(oi."quantity")
          FROM "order_items" oi
          JOIN "orders" o ON o."id" = oi."order_id"
          WHERE oi."product_id" = p2."id"
            AND o."status" IN ('PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED')
         ) AS qty
  FROM "products" p2
) s
WHERE p."id" = s.product_id;
