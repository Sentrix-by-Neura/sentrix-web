# Sentrix Supabase Production Email Templates

Template email HTML siap pakai (production-ready) dengan styling industrial dark & amber khas Sentrix. Dibuat menggunakan standard table-based inline CSS sehingga kompatibel di semua email client (Gmail, Outlook, Apple Mail, dsb).

---

## 1. Template: Confirm Signup (Verifikasi Email)
- **Supabase Tab**: `Authentication` → `Email Templates` → **Confirm signup**
- **Recommended Subject**: `Confirm your Sentrix Account` atau `Aktifkan Akun Sentrix Anda`
- **File**: [`supabase/email-templates/confirm-signup.html`](./confirm-signup.html)

### Cara Pasang:
1. Buka file [`confirm-signup.html`](./confirm-signup.html).
2. Salin (Copy) seluruh isi kode HTML.
3. Di Supabase Dashboard, paste ke tab **Message Body** pada **Confirm signup**.
4. Klik **Save**.

---

## 2. Template: Reset Password (Lupa Kata Sandi)
- **Supabase Tab**: `Authentication` → `Email Templates` → **Reset password**
- **Recommended Subject**: `Reset your Sentrix Password` atau `Permintaan Reset Password Sentrix`
- **File**: [`supabase/email-templates/reset-password.html`](./reset-password.html)

### Cara Pasang:
1. Buka file [`reset-password.html`](./reset-password.html).
2. Salin (Copy) seluruh isi kode HTML.
3. Di Supabase Dashboard, paste ke tab **Message Body** pada **Reset password**.
4. Klik **Save**.

---

## 3. Template: Magic Link (Login Tanpa Password)
- **Supabase Tab**: `Authentication` → `Email Templates` → **Magic link**
- **Recommended Subject**: `Sign in to Sentrix` atau `Link Masuk Sentrix`
- **File**: [`supabase/email-templates/magic-link.html`](./magic-link.html)

### Cara Pasang:
1. Buka file [`magic-link.html`](./magic-link.html).
2. Salin (Copy) seluruh isi kode HTML.
3. Di Supabase Dashboard, paste ke tab **Message Body** pada **Magic link**.
4. Klik **Save**.

---

## Live Preview di Browser
Anda dapat melihat tampilan live rendering template ini langsung di localhost:
👉 **[http://localhost:3000/email-preview.html](http://localhost:3000/email-preview.html)**
