export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "#004ac6";

function layout(heading: string, bodyHtml: string, actionUrl: string, actionLabel: string): string {
  return `<!doctype html>
<html lang="id">
<body style="margin:0;padding:24px;background:#f8f9fb;font-family:Arial,Helvetica,sans-serif;color:#191c1e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e0e3e5">
    <tr><td style="padding:28px">
      <p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:${BRAND}">NeedBuy</p>
      <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(heading)}</h1>
      ${bodyHtml}
      <p style="margin:24px 0">
        <a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold">${escapeHtml(actionLabel)}</a>
      </p>
      <p style="margin:0;font-size:12px;color:#737686">
        Kalau tombolnya nggak jalan, salin tautan ini ke browser kamu:<br>
        <span style="word-break:break-all">${actionUrl}</span>
      </p>
    </td></tr>
  </table>
  <p style="max-width:520px;margin:16px auto 0;font-size:11px;color:#737686;text-align:center">
    Email ini dikirim otomatis oleh NeedBuy. Nggak perlu dibalas.
  </p>
</body>
</html>`;
}

export function verificationEmail(name: string, verifyUrl: string, hours: number): EmailContent {
  return {
    subject: "Verifikasi email NeedBuy kamu",
    text: [
      `Halo ${name},`,
      "",
      "Makasih udah daftar di NeedBuy. Tinggal satu langkah lagi: konfirmasi alamat email kamu lewat tautan di bawah ini.",
      "",
      verifyUrl,
      "",
      `Tautannya berlaku ${hours} jam. Kalau kamu nggak pernah daftar di NeedBuy, abaikan aja email ini, nggak ada akun yang dibuat atas namamu tanpa konfirmasi ini.`,
      "",
      ": Tim NeedBuy",
    ].join("\n"),
    html: layout(
      `Halo ${name}, konfirmasi email kamu dulu ya`,
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#434655">
         Makasih udah daftar di NeedBuy. Tinggal satu langkah lagi biar akunmu aktif sepenuhnya.
         Tautannya berlaku <strong>${hours} jam</strong>.
       </p>
       <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#737686">
         Nggak pernah daftar di NeedBuy? Abaikan aja email ini.
       </p>`,
      verifyUrl,
      "Verifikasi Email"
    ),
  };
}

export function passwordResetEmail(name: string, resetUrl: string, minutes: number): EmailContent {
  return {
    subject: "Atur ulang password NeedBuy kamu",
    text: [
      `Halo ${name},`,
      "",
      "Ada yang minta atur ulang password buat akun NeedBuy kamu. Kalau itu kamu, buka tautan di bawah ini:",
      "",
      resetUrl,
      "",
      `Tautannya berlaku ${minutes} menit dan cuma bisa dipakai sekali.`,
      "",
      "Kalau bukan kamu yang minta, abaikan aja email ini, password kamu nggak berubah selama tautan ini nggak dibuka.",
      "",
      ": Tim NeedBuy",
    ].join("\n"),
    html: layout(
      `Halo ${name}, mau atur ulang password?`,
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#434655">
         Ada yang minta atur ulang password buat akun NeedBuy kamu. Tautannya berlaku
         <strong>${minutes} menit</strong> dan cuma bisa dipakai sekali.
       </p>
       <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#737686">
         Bukan kamu yang minta? Abaikan aja email ini. Password kamu nggak berubah
         selama tautan ini nggak dibuka.
       </p>`,
      resetUrl,
      "Atur Ulang Password"
    ),
  };
}
