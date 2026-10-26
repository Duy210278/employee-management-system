# Kế hoạch làm mới giao diện "Lộ trình Upharma"

## Bối cảnh

Giao diện hiện tại bám N3 (mục 15 tài liệu thiết kế): đủ chức năng nhưng dày đặc, nhiều viền, nhiều nhãn màu trên cùng một dòng, và trang không có tiêu đề nên người dùng khó biết mình đang ở đâu. Người dùng gửi giao diện **DTP LMS** (elearning.icpc1hn.work) làm mẫu tham khảo, muốn giao diện hài hòa, dễ đọc, dễ thao tác hơn và **sửa từng phần để tự kiểm soát chất lượng**.

**Phạm vi:** chỉ giao diện (`apps/web`). Không đổi API, nghiệp vụ, quyền. Thay đổi nào chạm tới hành vi (ví dụ bấm ô thống kê để lọc) được ghi là **đề xuất** và chỉ làm khi người dùng đồng ý.

---

## 1. Học gì từ giao diện DTP LMS

| Điểm ở DTP LMS | Hiện trạng của mình | Áp dụng |
|---|---|---|
| Thanh trên **một dòng**: logo, menu chữ đậm, mục đang chọn gạch chân, góc phải là tên + dòng phụ + ảnh đại diện | Hai dòng (logo + đổi tài khoản + chuông + tên + nút Đăng xuất, rồi mới đến tab) cộng dải ngày giả lập: chiếm khoảng 130 px | Gộp thành 1 dòng; đổi tài khoản và Đăng xuất vào menu người dùng |
| **Dải tiêu đề trang** (nền nhạt, họa tiết đường cong) có tên trang to + đường dẫn "Trang chủ › Lộ trình học tập" | Đa số trang không có tiêu đề (Việc cần xử lý, Nhân sự, Cảnh báo); Quản trị chỉ có chữ 16 px | Mọi trang có tiêu đề; đường dẫn chỉ hiện khi trang ở cấp 2 trở lên |
| **Thẻ lọc**: nhãn "Bài thu hoạch:" + nhóm nút liền nhau (Tất cả / Đã hoàn thành / Chưa hoàn thành) | Ô tìm kiếm và select rời rạc, không có nhãn; tab phụ là các nút tròn rời | Thanh lọc nằm trong một thẻ; lựa chọn ít giá trị dùng nhóm nút liền (segmented) |
| **Câu tóm tắt** "Bạn đang có **0** lộ trình học" | Chỉ có ô thống kê | Thêm câu tóm tắt dưới thanh lọc: "Đang hiển thị 12/40 nhân sự" |
| **Đăng nhập**: thẻ giữa trang, logo, lời chào 2 dòng, nhãn đậm trên ô nhập, ô nhập cao, nút bo tròn rộng hết thẻ, hàng liên kết bên dưới | Thẻ có viền, tiêu đề "Đăng nhập", nhãn chữ xám nhỏ | Làm lại theo bố cục này |
| Nhiều khoảng trắng, ít viền, chữ đậm rõ | Viền 1 px ở mọi thẻ, ô, nút; nhãn ô nhập màu xám | Viền nhạt hơn + bóng rất nhẹ; nhãn màu chữ chính |

**Không chép:**

- Nút đăng nhập của DTP (nền xanh nhạt, chữ đậm) trông như đang bị vô hiệu: giữ nút chính nền đậm, tương phản đạt WCAG AA.
- Nền xanh nhạt của ô nhập trong ảnh là do Chrome tự điền, không phải thiết kế.
- Màu đỏ, navy của DTP: giữ màu nhận diện Upharma (xem quyết định Q1).

---

## 2. Quyết định cần chốt trước khi làm

| Mã | Câu hỏi | Khuyến nghị | Phương án khác |
|---|---|---|---|
| Q1 | Màu nhấn | **Giữ xanh Upharma `#0A7B67`** (mục 15.1), chỉ học bố cục và nhịp khoảng trắng của DTP | Đổi sang xanh navy như nhóm nút của DTP (`#134E6F`) |
| Q2 | Độ rộng khung nội dung | **Tăng 1120 → 1240 px** để bảng Nhân sự, Tài khoản không phải cuộn ngang | Giữ 1120 px |
| Q3 | Nền trang | **Giữ nền xám rất nhạt, thẻ trắng** (app có nhiều thẻ và bảng nên cần tách lớp); dải tiêu đề nền nhạt như DTP | Nền trắng toàn trang như DTP |
| Q4 | Công cụ chụp ảnh so sánh trước/sau | **Thêm `playwright-core`** (dùng Chrome đã cài trên máy, không tải trình duyệt); kế hoạch triển khai vốn định dùng Playwright ở giai đoạn 5 | Người dùng tự chụp bằng tay |

---

## 3. Cách kiểm soát chất lượng mỗi giai đoạn

Mỗi giai đoạn là **một commit**, đủ nhỏ để duyệt trong 15–30 phút. Chỉ sang giai đoạn sau khi người dùng duyệt giai đoạn trước.

1. Claude làm xong giai đoạn trên máy local (chưa commit).
2. Claude chạy `pnpm typecheck` và `pnpm build`, rồi chụp ảnh "sau" các màn hình của giai đoạn đó.
3. Claude báo: đã đổi gì, danh sách file, đường dẫn ảnh trước/sau, các điểm cần người dùng xem kỹ.
4. Người dùng mở `pnpm build && pnpm start` (localhost:3000), đi theo **tiêu chí nghiệm thu** của giai đoạn, góp ý.
5. Sửa theo góp ý → người dùng nói "commit và push" → Render tự deploy bản demo.

**Mỗi giai đoạn đều phải giữ được** (kiểm tra chung, không nhắc lại ở từng giai đoạn):

- [ ] Chế độ sáng và tối đều đọc được, không có chữ chìm vào nền.
- [ ] Điện thoại 390 px không tràn ngang, nút đủ to để bấm (≥ 36 px).
- [ ] Dùng bàn phím: Tab thấy viền tập trung, Enter/Space mở được dòng đầu việc.
- [ ] Trạng thái không chỉ thể hiện bằng màu (luôn có chữ hoặc ký hiệu), theo mục 15.5.
- [ ] Không mất thông tin, không mất nút thao tác nào so với trước.
- [ ] Console trình duyệt không có lỗi.

**Nguyên tắc kỹ thuật:**

- CSS thuần như hiện nay (`tokens.css`, `base.css`), không thêm thư viện giao diện.
- Màu, bo góc, bóng đổ đi qua token trên `:root`, có bản tối tương ứng.
- Trang nào đang sửa thì gỡ luôn `style="..."` viết tay trong trang đó (hiện có khoảng 125 chỗ) sang class dùng chung.
- Ưu tiên điện thoại cho màn của NV và Buddy (Hôm nay, Lộ trình của tôi, Việc kèm cặp), máy tính cho BP ĐT (mục 15.4).

---

## 4. Các giai đoạn

Thứ tự đi từ nền tảng dùng chung ra từng trang: làm trang Đăng nhập trước làm **mẫu thí điểm** để chốt hướng thẩm mỹ với chi phí thấp nhất, sau đó mới đụng tới các trang nghiệp vụ.

| GĐ | Nội dung | Khối lượng | Ảnh hưởng |
|---|---|---|---|
| 0 | Công cụ chụp ảnh, chụp hiện trạng | Nhỏ | Không đổi giao diện |
| 1 | Nền tảng (token, ô nhập, nút, thẻ, nhóm nút) + Đăng nhập, Đăng ký, Chờ duyệt | Vừa | Mọi trang thay đổi nhẹ; 3 trang công khai đổi hẳn |
| 2 | Khung ứng dụng: thanh trên một dòng, menu người dùng, dải ngày giả lập | Vừa | Mọi trang sau đăng nhập |
| 3 | Dải tiêu đề trang và đường dẫn | Vừa | Mọi trang sau đăng nhập |
| 4 | Thanh lọc và bảng: Nhân sự, Cảnh báo | Vừa | 2 trang |
| 5 | Dòng đầu việc và checklist theo giai đoạn | Lớn | Hôm nay, Việc cần xử lý, Hồ sơ NV |
| 6 | Trang Hôm nay và Việc cần xử lý | Vừa | 2 trang |
| 7 | Hồ sơ nhân viên / Lộ trình của tôi và các tab | Lớn | 1 trang, 9 tab |
| 8 | Quản trị, Thông báo, Khung năng lực | Vừa | 7 trang |
| 9 | Thiết kế lộ trình (trình soạn phiên bản) | Lớn | 1 trang, nhiều trình soạn |
| 10 | Rà soát cuối, cập nhật mục 15 tài liệu thiết kế | Nhỏ | Không thêm tính năng |

Khối lượng: Nhỏ ≈ nửa ngày, Vừa ≈ 1 ngày, Lớn ≈ 1,5–2 ngày (1 dev + Claude, gồm cả thời gian duyệt).

---

### GĐ 0 – Công cụ chụp ảnh, chụp hiện trạng

**Mục tiêu:** có ảnh "trước" làm mốc so sánh cho mọi giai đoạn sau.

- Thêm `playwright-core` (devDependency gốc), script `scripts/ui-snap.mjs`: đăng nhập nhanh bằng tài khoản mẫu (NV, Buddy, CHT, QLKV, BP ĐT), mở danh sách màn hình, chụp ở **1440 px và 390 px**, **sáng và tối**.
- Lệnh `pnpm ui:snap <tên-thư-mục>`; ảnh lưu ở `ui-snap/<tên>/` (thêm vào `.gitignore`, không đẩy lên git).
- Chụp bộ `ui-snap/truoc/`.

**Nghiệm thu:** mở thư mục ảnh, thấy đủ các màn hình chính cho từng vai trò, ảnh không bị trắng hay kẹt ở màn đăng nhập.

---

### GĐ 1 – Nền tảng + trang Đăng nhập làm mẫu

**Mục tiêu:** chốt "ngôn ngữ thị giác" mới trên một trang nhỏ trước khi đổi cả hệ thống.

**Nền tảng** (`tokens.css`, `base.css`):

- Token mới: `--shadow-1` (bóng rất nhẹ cho thẻ), `--shadow-2` (menu, hộp nổi), `--ring` (vòng sáng khi ô nhập được chọn), `--accent-hover`; `--line` nhạt hơn một bậc. Đủ bản tối.
- Thẻ: viền nhạt hơn + `--shadow-1`, bo 12 px như cũ.
- Ô nhập, select: cao khoảng 40 px, đệm 9×12, khi chọn thì viền màu nhấn + vòng sáng nhạt.
- Nhãn ô nhập (`label.f`): chữ màu chính, 13 px, đậm 600 (như "Tên đăng nhập" của DTP), không còn màu xám.
- Nút: cao đều nhau (36 px, nút nhỏ 30 px), nút chính có trạng thái hover đậm hơn; thêm kiểu `.btn.ghost` (không viền) cho thao tác phụ.
- Nhóm nút liền `.seg` (kiểu "Tất cả | Đã hoàn thành | Chưa hoàn thành"): chỉ thêm class, chưa áp vào trang nào.

**Trang công khai** (`LoginPage.vue`, `RegisterPage.vue`, `PendingPage.vue`):

```
                ┌──────────────────────────────┐
                │            [ U ]             │
                │     Chào mừng đến với        │
                │      Lộ trình Upharma        │
                │                              │
                │  Email công ty               │
                │  [__________________________]│
                │  Mật khẩu                    │
                │  [__________________________]│
                │  [        Đăng nhập        ] │
                │  Chưa có tài khoản? Đăng ký  │
                │ ── hoặc đăng nhập nhanh ──── │
                │  [Chọn tài khoản mẫu ▾] [Vào]│
                └──────────────────────────────┘
```

- Thẻ rộng khoảng 420 px, căn giữa theo chiều dọc, không viền, nền `--surface2`, đệm rộng.
- Logo chữ U to hơn, lời chào 2 dòng căn giữa; nút chính bo tròn hết cỡ, rộng hết thẻ.
- Đăng ký: cùng khung, form chia 2 cột trên máy tính, 1 cột trên điện thoại.

**Nghiệm thu:**

- [ ] Ba trang công khai nhìn gần với ảnh mẫu DTP nhưng mang màu Upharma.
- [ ] Các trang khác chỉ đổi nhẹ (ô nhập, nút, thẻ), không vỡ bố cục: xem ảnh trước/sau của Nhân sự, Hồ sơ NV, Thiết kế lộ trình.
- [ ] Đăng nhập thường, đăng nhập nhanh, tài khoản chờ duyệt vẫn chạy như cũ.

---

### GĐ 2 – Khung ứng dụng (thanh trên, menu người dùng)

**Mục tiêu:** giải phóng chiều cao màn hình, gom các thao tác ít dùng vào một chỗ.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [U] Lộ trình Upharma   Việc cần xử lý ⑤   Nhân sự   Cảnh báo ②   Khung NL   🔔  Phạm Thu Hà   (PH)│
│                        ‾‾‾‾‾‾‾‾‾‾‾‾‾‾                                    Cửa hàng trưởng ▾│
├──────────────────────────────────────────────────────────────────────────────┤
│ Đang giả lập ngày 26/10 · ngày thật 20/10          [−1 | +1 | +7]  [📅]  Về ngày thật │
└──────────────────────────────────────────────────────────────────────────────┘
```

- `AppShell.vue`: logo, menu, chuông, khối người dùng trên **một dòng**, cao khoảng 60 px. Menu chữ đậm màu chính, mục đang chọn màu nhấn + gạch chân 2 px (như DTP), số đếm đỏ giữ nguyên.
- Khối người dùng: vòng tròn chữ viết tắt tên + tên đậm + vai trò chữ nhỏ bên dưới. Bấm vào mở menu: **Đổi tài khoản** (bản demo), **Đăng xuất**. Component mới `UserMenu.vue`; đóng bằng Esc hoặc bấm ra ngoài.
- `SimDateBar.vue`: dải mỏng hơn; các nút tua gom thành một nhóm nút liền.
- Màn hẹp (≤ 960 px): menu xuống dòng thứ hai, cuộn ngang; ≤ 620 px khối người dùng chỉ còn vòng tròn chữ viết tắt.

**Rủi ro:** BP ĐT có tới 6–7 mục menu. Nếu ở 1280 px vẫn chật thì rút gọn nhãn ("Thiết kế lộ trình" → "Thiết kế") hoặc đưa "Quản trị" vào menu người dùng: Claude sẽ hỏi trước khi chọn.

**Nghiệm thu:**

- [ ] Đăng nhập bằng từng vai trò: menu đúng như trước (NV, NV làm Buddy, CHT có hồ sơ onboarding, QLKV người duyệt phiên bản, BP ĐT).
- [ ] Đổi tài khoản và Đăng xuất trong menu người dùng chạy đúng.
- [ ] Phần đầu trang (thanh trên + dải giả lập) thấp hơn trước rõ rệt.

---

### GĐ 3 – Dải tiêu đề trang và đường dẫn

**Mục tiêu:** trang nào cũng có tên, người dùng luôn biết mình đang ở đâu.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ (nền nhạt, đường cong trang trí mờ ở góc phải)                                │
│ Nguyễn Thị Lan                                    [Phân công]  [Mở checklist] │
│ Nhân sự › Nguyễn Thị Lan                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Component mới `PageHeader.vue`, đặt trong `AppShell` (dải tràn hết bề ngang). Tiêu đề lấy từ `meta.title` của route; trang cần tiêu đề động (tên NV, mã phiên bản) đặt qua composable `usePageTitle()`; nút thao tác của trang gửi lên dải tiêu đề bằng `<Teleport>`.
- Trang cấp 1 (Việc cần xử lý, Nhân sự, Cảnh báo...) hiện **một dòng mô tả ngắn** thay cho đường dẫn, vì "Trang chủ › Nhân sự" không thêm thông tin gì. Trang cấp 2 trở lên hiện đường dẫn: Nhân sự › Tên NV; Quản trị › Tài khoản › Tên; Thiết kế lộ trình › v2.2.
- Bỏ nút "← Danh sách nhân sự" (đã có đường dẫn).
- Trang Hôm nay của NV: **không** có dải tiêu đề (lời chào đã là tiêu đề), để trên điện thoại việc cần làm hiện ngay.
- Điện thoại: dải tiêu đề gọn (chữ 20 px, đệm nhỏ), ẩn đường cong trang trí.

**Nghiệm thu:**

- [ ] Đi qua mọi menu: trang nào cũng có tiêu đề đúng tên menu.
- [ ] Bấm đường dẫn quay về đúng trang cha.
- [ ] Trên điện thoại, dải tiêu đề không đẩy nội dung xuống quá 1/4 màn hình.

---

### GĐ 4 – Thanh lọc và bảng (Nhân sự, Cảnh báo)

**Mục tiêu:** lọc nhanh, bảng dễ quét bằng mắt.

```
┌ Thẻ lọc ─────────────────────────────────────────────────────────────────────┐
│ [🔍 Tìm tên, mã NV        ]  [Mọi cửa hàng ▾]   Level: [Tất cả|L1|L2|L3|L4|CHT] │
└──────────────────────────────────────────────────────────────────────────────┘
Đang hiển thị 12/40 nhân sự · 3 người có cảnh báo đỏ
```

- Thanh lọc trong một thẻ (class `.toolbar`), ô tìm kiếm có biểu tượng kính lúp; Level và Mức cảnh báo dùng nhóm nút liền thay cho select.
- Câu tóm tắt dưới thanh lọc, số in đậm.
- Bảng Nhân sự: 8 cột → 6 cột. Gộp "Trễ hạn" + "Cảnh báo" thành **Tình trạng**; số phiên bản thành chữ nhỏ dưới Level; tên NV là liên kết, cả dòng đổi nền khi rê chuột, bỏ nút "Mở" riêng.
- Ô thống kê: số và nhãn gọn hơn. **Đề xuất (cần đồng ý):** bấm ô "Nhân sự có cảnh báo đỏ" thì lọc luôn bảng.
- Điện thoại: mỗi dòng là một thẻ (đã có `table.rt`), làm lại cho thoáng.

**Nghiệm thu:**

- [ ] Lọc theo tên, cửa hàng, Level, mức cảnh báo ra đúng kết quả như trước.
- [ ] Bảng Nhân sự ở 1440 px không cuộn ngang; ở 390 px mỗi NV là một thẻ dễ đọc.
- [ ] Rê chuột vào Tình trạng vẫn xem được nội dung cảnh báo.

---

### GĐ 5 – Dòng đầu việc và checklist theo giai đoạn

**Mục tiêu:** đây là thành phần xuất hiện nhiều nhất (Hôm nay, Việc cần xử lý, Hồ sơ NV) và rối nhất: một dòng hiện có thể có tới 9 nhãn màu. Giảm còn **một nhãn trạng thái chính**, phần còn lại là chữ phụ.

Trước:

```
☐ Thực hành 5 giao dịch có quan sát Rubric
  [NV][Buddy] [Ca sáng] [Kỹ năng BH] [GPP bắt buộc] [Trễ 3 ngày] [Chờ Buddy] L1-3-2
```

Sau:

```
┃ ☐  Thực hành 5 giao dịch có quan sát Rubric                     [Trễ 3 ngày]
┃    L1-3-2 · Kỹ năng bán hàng · Ca sáng · Hạn 14/10 · GPP
┃    [NV ✓] [Buddy]  chờ Buddy xác nhận
```

- `ItemRow.vue`: dòng 1 là nội dung + **một** nhãn trạng thái bên phải (Trễ N ngày / Chờ xác nhận / Đến hạn hôm nay / Đã xong); dòng 2 là chữ phụ (mã, nhóm, ca, hạn); dòng 3 là chip vai trò (tiến độ xác nhận). GPP giữ viền trái đỏ và chữ "GPP".
- Phần mở rộng chia 2 khối: **Hướng dẫn** (người hỗ trợ, tài liệu, cách làm) và **Xác nhận & lịch sử** (dạng dòng thời gian). Thanh thao tác: nút chính nổi bật bên trái, các nút phụ (Cần hỗ trợ, Bỏ qua) kiểu `.ghost`, "Yêu cầu làm lại" màu đỏ tách sang phải.
- `StageChecklist.vue`: đầu mỗi giai đoạn có ô số thứ tự, tên, khoảng ngày, thanh tiến độ nhỏ x/y, nhãn ký. Giai đoạn đang diễn ra đánh dấu bằng vạch màu nhấn bên trái thay cho tô nền cả dải. Thanh ký cuối giai đoạn làm lại cho rõ ai đã ký, ai chờ.
- Không đổi logic: cùng nút, cùng điều kiện hiện nút, cùng ghi chú bắt buộc.

**Nghiệm thu** (dùng ngày giả lập để có đủ trạng thái):

- [ ] So từng trạng thái (chưa làm, đang làm, cần hỗ trợ, chờ xác nhận, làm lại, trễ, xong, bỏ qua, chờ phụ thuộc): dòng mới vẫn cho biết đúng trạng thái đó.
- [ ] NV báo xong → Buddy/CHT xác nhận → hủy xác nhận → yêu cầu làm lại: luồng chạy như cũ.
- [ ] Ký cuối giai đoạn nhiều bước vẫn hiện đúng thứ tự và người ký.
- [ ] Trên điện thoại, dòng đầu việc đọc được mà không phải phóng to.

---

### GĐ 6 – Trang Hôm nay và Việc cần xử lý

**Hôm nay (NV, ưu tiên điện thoại)** – `TodayPage.vue`, `PathBar.vue`:

- Thẻ đầu: lời chào + ngày, Level và ngày thứ mấy, phần trăm hoàn thành to bên phải, thanh tiến độ.
- `PathBar` thành **thanh bước** 4 Level nối với nhau bằng đường kẻ (đã qua có ✓, hiện tại tô màu nhấn); dùng chung cho Hồ sơ NV.
- Gộp tối đa 4 khung thông báo xếp chồng (phiếu chờ ký, làm lại, quá hạn, chờ xác nhận) thành **một thẻ "Cần chú ý"**, mỗi dòng một việc kèm liên kết.
- Các nhóm Quá hạn / 3 ngày tới / Tuần tới / Sắp tới giữ nguyên, tiêu đề nhóm có số đếm.

**Việc cần xử lý / Việc kèm cặp** – `InboxPage.vue`:

- Ô thống kê gọn thành một hàng.
- Nhóm theo NV: đầu nhóm có vòng tròn chữ viết tắt, tên, cửa hàng, nhãn Level, thanh tiến độ nhỏ, nút "Mở hồ sơ".
- **Đề xuất (cần đồng ý):** nhóm nút liền ở đầu trang "Tất cả | Chờ tôi xác nhận | Quá hạn | Chữ ký" để lọc, đỡ phải cuộn khi phụ trách nhiều NV.

**Nghiệm thu:**

- [ ] NV ở các trạng thái: chưa bắt đầu Level, chưa đọc tổng quan, đang chạy, đã xong hết: màn Hôm nay đúng nội dung cho từng trường hợp.
- [ ] CHT và Buddy: Chữ ký chờ bạn, Cảnh báo khu vực, Lượt sắp bắt đầu vẫn đủ.

---

### GĐ 7 – Hồ sơ nhân viên / Lộ trình của tôi

`StaffProfilePage.vue` và các tab: `LevelOverview`, `SalesTab`, `RubricTab`, `ReviewTab`, `ChtOverview`, `ChtJournal`, `ChtEvaluation`, `RunManagePanel`.

- Thẻ đầu hồ sơ gọn lại: vòng tròn chữ viết tắt + tên + thông tin chia 2 dòng (mã, cửa hàng, khu vực / ngày nhận việc, email); "Người đồng hành" (Buddy, CHT, QLKV) thành hàng nhỏ có chip vai trò; cảnh báo gộp một khung.
- Tab của hồ sơ: từ nút tròn rời sang **tab gạch chân** (cấp 2, nhỏ hơn menu chính), cuộn ngang trên điện thoại.
- Bộ chọn Level đã qua: từ hàng nút tròn thứ hai sang **một select** "Đang xem: Level 2 (hiện tại) ▾" đặt cạnh tab.
- Các tab bên trong: dùng class chung mới (thẻ, bảng, ô nhập), gỡ style viết tay; bảng doanh số và chấm Rubric giữ số căn phải, chữ số đều.

**Nghiệm thu:**

- [ ] Mở hồ sơ NV Level 1–4 và CHT onboarding: tab đúng theo loại lượt.
- [ ] NV chưa đọc tổng quan: các tab khác vẫn bị khóa, có giải thích.
- [ ] Mở thẳng từ "Chữ ký chờ bạn" (có `?tab=&run=`) vào đúng tab, đúng Level.
- [ ] Nhập doanh số, chấm Rubric, ký phiếu, tạm dừng, đổi phân công vẫn chạy.

---

### GĐ 8 – Quản trị, Thông báo, Khung năng lực

- `AdminLayout.vue`: máy tính dùng **cột menu dọc bên trái** (kiểu trang cài đặt); điện thoại dùng nhóm nút liền cuộn ngang.
- Tài khoản: hàng chờ duyệt thành thẻ nổi bật có số đếm; thanh lọc và bảng theo mẫu GĐ 4. Chi tiết tài khoản, Danh mục, Nhập CSV, Nhật ký, Cấu hình: áp class chung.
- Thông báo: danh sách thoáng hơn, nhóm nút liền "Tất cả | Chưa đọc".
- Khung năng lực: bảng định nghĩa đọc dễ hơn (đầu bảng nền nhạt, dòng xen kẽ), chọn Level bằng nhóm nút liền.

**Nghiệm thu:**

- [ ] Duyệt, từ chối, tạo, sửa tài khoản; nhập CSV; xem nhật ký: chạy như cũ.
- [ ] Đánh dấu đã đọc thông báo đúng.

---

### GĐ 9 – Thiết kế lộ trình

`DesignPage.vue`, `VersionEditor.vue` và các trình soạn trong `components/design/`. Làm cuối vì chỉ BP ĐT dùng, dùng trên máy tính, và nhiều logic nhất.

- Cột phiên bản bên trái: thẻ phiên bản rõ trạng thái (nháp, chờ duyệt, hiệu lực...), bản đang chọn có vạch màu nhấn.
- Đầu trình soạn: tiêu đề, trạng thái, các nút (Lưu nháp, Gửi duyệt...) **dính trên cùng khi cuộn** để không phải cuộn ngược lên.
- Khung "Kiểm tra trước khi gửi duyệt", dải tác động: làm lại theo kiểu thẻ thông báo mới.
- Trình soạn giai đoạn, đầu việc, checklist CHT, Khung NL: dùng ô nhập, nhãn mới, khoảng cách đều; không đổi thao tác.

**Nghiệm thu:**

- [ ] Tạo nháp → sửa → kiểm tra lỗi → bấm lỗi nhảy đúng chỗ → gửi duyệt → duyệt và ban hành: chạy như cũ.
- [ ] Màn hẹp (≤ 960 px): cột phiên bản thành dải cuộn ngang như mục 15.4.

---

### GĐ 10 – Rà soát cuối

- Chụp bộ `ui-snap/sau/`, so toàn bộ với `ui-snap/truoc/`.
- Rà chế độ tối, điện thoại 390 px, bàn phím trên toàn bộ trang.
- Gỡ class CSS không còn dùng trong `base.css`; tìm lại `style="` còn sót.
- Cập nhật **mục 15 tài liệu thiết kế** (bảng màu, quy cách thành phần, bố cục, khung màn hình) cho khớp giao diện mới; ghi dòng tiến độ vào [KE_HOACH_TRIEN_KHAI.md](KE_HOACH_TRIEN_KHAI.md).

---

## 5. Theo dõi tiến độ

Ngày 2026-10-26 người dùng chốt: làm theo khuyến nghị Q1–Q3 (giữ xanh Upharma, khung 1240 px, nền xám nhạt + thẻ trắng), **bỏ GĐ 0** (người dùng tự kiểm tra trên trang dev), làm liền GĐ 1–9 rồi duyệt một lượt.

| GĐ | Trạng thái | Ngày duyệt | Ghi chú của người dùng |
|---|---|---|---|
| 0 | Bỏ (người dùng tự kiểm tra) | | |
| 1 | Xong, chờ duyệt | | |
| 2 | Xong, chờ duyệt | | |
| 3 | Xong, chờ duyệt | | |
| 4 | Xong, chờ duyệt | | |
| 5 | Xong, chờ duyệt | | |
| 6 | Xong, chờ duyệt | | |
| 7 | Xong, chờ duyệt | | |
| 8 | Xong, chờ duyệt | | |
| 9 | Xong, chờ duyệt | | |
| 10 | Chưa làm | | |

Chưa làm (đề xuất cần người dùng đồng ý): bấm ô thống kê để lọc bảng (GĐ 4), nhóm nút lọc ở Việc cần xử lý (GĐ 6).
