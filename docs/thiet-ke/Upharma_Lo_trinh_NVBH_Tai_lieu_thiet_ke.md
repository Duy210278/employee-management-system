# Tài liệu thiết kế hệ thống "Lộ trình Upharma"

Quản lý khung năng lực, checklist onboarding và lộ trình 4 Level cho nhân viên bán hàng nhà thuốc

| Thông tin | Nội dung |
|---|---|
| Phiên bản tài liệu | 0.12, bản nháp để rà soát nội bộ (mục 14: demo chạy local, cài trực tiếp trên máy, không dùng Docker) |
| Ngày soạn | 17/10/2026 |
| Đơn vị đặt hàng | BP Đào tạo, Upharma |
| Người nhận | Đội lập trình web |
| Trạng thái | Chờ BP Đào tạo chốt các vấn đề mở ở mục 16 trước khi giao phát triển |

Tài liệu nguồn được dùng để xây dựng đặc tả này:

| Mã | Tài liệu | Vai trò trong đặc tả |
|---|---|---|
| N1 | Khung_Nang_Luc_Upharma_v2_1.docx | Định nghĩa Level, KPI, Rubric, Buddy Score, cảnh báo, quy tắc cập nhật |
| N2 | Checklist_Onboarding_4Level_v2_1.xlsx | 138 đầu việc, 15 giai đoạn, 4 phiếu đánh giá, trạng thái, vai trò |
| N3 | Checklist_onboarding_UI.html | Giao diện tham chiếu: bố cục, màu sắc, luồng xác nhận, điều hướng theo vai trò |
| N4 | Bản thử nghiệm "Cấu hình Khung năng lực" | Mô hình phiên bản, kiểm tra hợp lệ |
| N5 | Bản thử nghiệm "Cấu hình Checklist Onboarding" | Trình xây dựng checklist, phân loại thay đổi diễn đạt / tiêu chí |
| N6 | Bản thử nghiệm "Lịch giao việc Onboarding" | Thuật toán tính lịch, hàng đợi việc theo người, cảnh báo |

---

## Mục lục

1. Tổng quan dự án
2. Thuật ngữ
3. Người dùng, vai trò và phân quyền
4. Kiến trúc thông tin và điều hướng
5. Module Quản trị người dùng (BP Đào tạo)
6. Module Xây dựng và quản lý Khung năng lực
7. Module Xây dựng và quản lý Checklist
8. Quản lý phiên bản
9. Hồ sơ nhân viên, lượt Level và gán phiên bản
10. Bộ tính lịch và giao việc
11. Màn hình nghiệp vụ hằng ngày
12. Quy tắc nghiệp vụ tổng hợp
13. Mô hình dữ liệu
14. Kiến trúc kỹ thuật (bản demo chạy local)
15. Thiết kế giao diện
16. Vấn đề mở cần BP Đào tạo chốt
17. Yêu cầu phi chức năng
18. Tích hợp
19. Dữ liệu khởi tạo và chuyển đổi
20. Kịch bản kiểm thử nghiệm thu
21. Kế hoạch triển khai theo giai đoạn
22. Phụ lục

---

## 1. Tổng quan dự án

### 1.1 Bối cảnh

BP Đào tạo đã xây dựng bộ "Khung năng lực và mục tiêu đào tạo NVBH" (4 Level) và bộ "Checklist Onboarding" dạng Excel. Hiện việc theo dõi diễn ra trên file, nên gặp các vấn đề:

- Không biết từng nhân viên đang ở đâu trong lộ trình, mục nào trễ hạn.
- Mỗi nhân viên vào làm một ngày khác nhau nên hạn của từng việc khác nhau. Theo dõi thủ công dễ sai.
- Người xác nhận (Buddy, CHT, QLKV, BP Đào tạo) không có danh sách việc cần xử lý.
- Khi BP Đào tạo sửa tài liệu, không có cách quản lý phiên bản. Không biết nhân viên nào đang áp dụng bản nào.
- Không có hồ sơ điện tử chứng minh đào tạo phục vụ thanh tra GPP.

### 1.2 Mục tiêu

1. BP Đào tạo tự xây dựng, chỉnh sửa và ban hành Khung năng lực và Checklist theo phiên bản, không cần lập trình viên can thiệp.
2. Mỗi nhân viên được giao đúng việc, đúng thời điểm, tính từ ngày bắt đầu Level của chính họ.
3. Mỗi người xác nhận có danh sách việc cần xử lý, có nhắc hạn và cảnh báo leo thang.
4. Quy trình đánh giá, chuyển Level, gia hạn được số hóa với chuỗi ký điện tử.
5. BP Đào tạo quản trị toàn bộ tài khoản, vai trò và phạm vi dữ liệu.
6. Lưu vết đầy đủ: ai xác nhận gì, lúc nào, theo phiên bản nào.

### 1.3 Phạm vi

| Trong phạm vi | Ngoài phạm vi (giai đoạn này) |
|---|---|
| Quản trị người dùng, vai trò, phạm vi cửa hàng / khu vực | Nội dung bài giảng LMS (chỉ lưu liên kết và trạng thái) |
| Trình soạn Khung năng lực có phiên bản | Tính lương, thưởng theo Level |
| Trình soạn Checklist có phiên bản, phiếu đánh giá | Tự động lấy doanh số từ POS (giai đoạn 3) |
| Lượt Level, gán phiên bản, chuyển phiên bản | Đồng bộ chấm công để đếm ca thực tế (giai đoạn 3) |
| Tính lịch, giao việc, nhắc việc, cảnh báo | Ứng dụng di động gốc (web responsive là đủ) |
| Xác nhận hai phía, yêu cầu làm lại, lịch sử | |
| Doanh số nhập tay, quan sát Rubric, Buddy Score | |
| Phiếu đánh giá, chuyển Level, gia hạn | |
| Báo cáo, xuất CSV, nhật ký hệ thống | |

Bản đầu tiên là **bản demo chạy trên một máy tính (localhost)**, dùng dữ liệu mẫu, không tích hợp hệ thống khác. Nghiệp vụ đầy đủ như đặc tả; hạ tầng tối giản theo mục 14.

---

## 2. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| NVBH, NV | Nhân viên bán hàng, đối tượng của lộ trình |
| Buddy | Người kèm cặp NV tại quầy (thường là NV Level 3–4 hoặc CHT). Là **vai trò phân công** trên lượt Level, không phải chức danh |
| CHT | Cửa hàng trưởng |
| QLKV | Quản lý khu vực, phụ trách nhiều cửa hàng |
| BP ĐT | Bộ phận Đào tạo, đồng thời là quản trị hệ thống |
| Level | 1 trong 4 cấp: L1 Hội nhập, L2 Phát triển, L3 Trưởng thành, L4 Chuyên gia |
| Khung năng lực | Tài liệu định nghĩa Level: thời gian, mục tiêu, KPI, Rubric, Buddy Score, cảnh báo, chỉ tiêu tỉ lệ chuyển Level |
| Checklist | Danh sách đầu việc theo Level, chia thành giai đoạn |
| Giai đoạn | Một khoảng thời gian trong Level (Tuần 1, Tháng 4–6…) gồm nhiều đầu việc |
| Đầu việc (item) | Một việc cần thực hiện hoặc kiểm tra, có người xác nhận và hạn |
| Bộ lộ trình | Một bản phát hành gồm Khung năng lực + Checklist + Phiếu đánh giá, có chung số phiên bản |
| Phiên bản | Một bản của Bộ lộ trình (2.1, 2.1.1, 2.2…) |
| Lượt Level (run) | Việc một NV đi qua một Level, bắt đầu từ ngày D, gắn cố định với một phiên bản |
| Mã đầu việc (item_key) | Mã cố định của đầu việc, giữ nguyên qua các phiên bản (ví dụ `L1-1-5`) |
| Sửa diễn đạt | Thay đổi chỉ về câu chữ, không đổi cách đánh giá |
| Thay đổi tiêu chí | Thay đổi ảnh hưởng cách đánh giá: thời gian, ngưỡng, người xác nhận, thêm/bỏ mục |
| GPP | Thực hành tốt nhà thuốc (quy định Bộ Y tế) |
| DS, HS1 | Doanh số, doanh số hàng hệ số 1 |

---

## 3. Người dùng, vai trò và phân quyền

### 3.1 Nguyên tắc

1. **Vai trò tài khoản** xác định chức năng được dùng: NV, CHT, QLKV, BP Đào tạo.
2. **Vai trò phân công** xác định quan hệ với một lượt Level cụ thể: Buddy. Một tài khoản NV (ví dụ đang ở L3) có thể vừa làm checklist của chính mình, vừa là Buddy của 3 NV mới.
3. **Phạm vi dữ liệu** giới hạn dữ liệu được xem: bản thân, các NV được phân công, cửa hàng, khu vực, toàn chuỗi.
4. **Quyền bổ sung** gắn thêm vào tài khoản bất kỳ: "Có thể làm Buddy", "Người duyệt phiên bản".
5. BP Đào tạo là quản trị viên: quản lý tài khoản, vai trò, phạm vi và quyền bổ sung.

> Điểm khác với giao diện tham chiếu N3: N3 coi Buddy là một vai trò tài khoản riêng. Đặc tả này chuyển Buddy thành vai trò phân công. Lý do: thực tế Buddy là NV Level 3–4 đồng thời đang có checklist của riêng mình (N2, checklist L3 mục "Nhận phân công kèm cặp").

### 3.2 Danh sách vai trò

| Vai trò | Loại | Phạm vi dữ liệu mặc định | Màu nhận diện (N3) |
|---|---|---|---|
| Nhân viên (NV) | Tài khoản | Lộ trình của chính mình | Tím `--r-nv` |
| Buddy | Phân công | Các lượt Level mình được gán làm Buddy | Xanh ngọc `--r-buddy` |
| Cửa hàng trưởng (CHT) | Tài khoản | Các cửa hàng được gán (1 hoặc nhiều) | Xanh dương `--r-cht` |
| QLKV | Tài khoản | Các khu vực được gán, gồm mọi cửa hàng trong khu vực | Vàng hổ phách `--r-qlkv` |
| BP Đào tạo (Quản trị) | Tài khoản | Toàn chuỗi | Đỏ cam `--r-bp` |
| Người duyệt phiên bản | Quyền bổ sung | Chỉ màn hình duyệt phiên bản | Dùng màu vai trò gốc |

### 3.3 Ma trận phân quyền

Ký hiệu: ✔ có quyền, ◐ có quyền trong phạm vi, ✖ không có quyền.

| Chức năng | NV | Buddy | CHT | QLKV | BP ĐT | Người duyệt |
|---|---|---|---|---|---|---|
| **Quản trị người dùng** | | | | | | |
| Xem danh sách tài khoản | ✖ | ✖ | ◐ (cửa hàng) | ◐ (khu vực) | ✔ | ✖ |
| Duyệt / từ chối đăng ký | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |
| Tạo tài khoản, nhập hàng loạt | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |
| Phân vai trò, phạm vi, quyền bổ sung | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |
| Khóa / mở khóa tài khoản | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |
| Quản lý danh mục cửa hàng, khu vực | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |
| **Khung năng lực và Checklist** | | | | | | |
| Xem phiên bản đang hiệu lực | ✔ (phần tổng quan Level của mình) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Tạo bản nháp, chỉnh sửa | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |
| Gửi duyệt, rút về nháp | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |
| Duyệt và ban hành, trả về nháp | ✖ | ✖ | ✖ | ✖ | ✔ (nếu được bật cấu hình "BP ĐT tự ban hành") | ✔ |
| Chạy chuyển phiên bản cho NV đang dở Level | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |
| **Hồ sơ nhân viên và lượt Level** | | | | | | |
| Tạo hồ sơ NV, bắt đầu lượt L1 | ✖ | ✖ | ◐ | ◐ | ✔ | ✖ |
| Sửa hồ sơ, đổi Buddy / CHT / QLKV | ✖ | ✖ | ◐ | ◐ | ✔ | ✖ |
| Tạm dừng lượt Level | ✖ | ✖ | ◐ (đề xuất) | ◐ (duyệt) | ✔ | ✖ |
| Ngừng theo dõi (nghỉ việc) | ✖ | ✖ | ◐ | ◐ | ✔ | ✖ |
| **Thực hiện checklist** | | | | | | |
| Đọc tổng quan Level và xác nhận đã đọc | ✔ (của mình) | ◐ (thay NV chưa có tài khoản) | ◐ (thay NV chưa có tài khoản) | ✖ | ✖ | ✖ |
| Báo hoàn thành phần NV | ✔ (của mình) | ◐ (thay NV chưa có tài khoản) | ◐ (thay NV chưa có tài khoản) | ✖ | ✖ | ✖ |
| Xác nhận đạt với vai trò Buddy | ✖ | ◐ | ◐ (thay Buddy) | ✖ | ✖ | ✖ |
| Xác nhận đạt với vai trò CHT / QLKV / BP ĐT | ✖ | ✖ | ◐ (CHT) | ◐ (QLKV) | ✔ (BP ĐT) | ✖ |
| Yêu cầu làm lại | ✖ | ✖ | ◐ | ◐ | ✔ | ✖ |
| Đánh dấu Bỏ qua / N-A | ✖ | ✖ | ◐ | ◐ | ✔ | ✖ |
| Duyệt / ký cuối giai đoạn | Theo chuỗi ký cấu hình trong checklist | | | | | |
| **Đánh giá** | | | | | | |
| Nhập doanh số tháng | ✖ | ✖ | ◐ | ◐ | ✔ | ✖ |
| Ghi ca quan sát Rubric | ✖ | ◐ | ◐ | ◐ | ✖ | ✖ |
| Làm phiếu Buddy Performance Score | ✔ (đánh giá Buddy của mình) | ✖ | ✖ | ✖ | ✖ | ✖ |
| Điền phiếu đánh giá tổng kết | ✖ | ◐ (L1) | ◐ | ✖ | ✔ | ✖ |
| Ký phiếu đánh giá | Theo chuỗi ký cấu hình trong phiếu | | | | | |
| **Báo cáo** | | | | | | |
| Xem danh sách nhân sự, cảnh báo | ✖ | ◐ | ◐ | ◐ | ✔ | ✖ |
| Xuất CSV | ✖ | ✖ | ◐ | ◐ | ✔ | ✖ |
| Xem nhật ký hệ thống | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |

Quy tắc thay thế xác nhận (giữ như N3):

- CHT được xác nhận thay Buddy khi lượt Level chưa gán Buddy hoặc Buddy vắng mặt. Lịch sử ghi rõ "CHT xác nhận thay Buddy".
- Buddy hoặc CHT được báo hoàn thành thay NV **chỉ khi NV chưa có tài khoản**. Khi NV đã có tài khoản thì phần NV bắt buộc do NV tự bấm.

---

## 4. Kiến trúc thông tin và điều hướng

### 4.1 Khung trang chung (theo N3)

- Thanh trên cùng cố định: logo chữ "U" trên nền màu nhấn, tên "Lộ trình Upharma", tên người dùng, menu tài khoản.
- Ngay dưới là thanh tab điều hướng. Tab hiển thị theo vai trò, có huy hiệu số màu đỏ cho số việc cần xử lý hoặc cảnh báo đỏ.
- Nội dung chính một cột, rộng tối đa 1120 px. Riêng các màn hình soạn thảo của BP Đào tạo được dùng bố cục rộng tối đa 1440 px, có cột trái danh sách phiên bản.
- Trang chi tiết mở dạng trang đầy đủ, có nút "← Quay lại" ở đầu trang.

### 4.2 Tab theo vai trò

| Vai trò | Các tab |
|---|---|
| NV | Hôm nay · Lộ trình của tôi |
| NV đồng thời là Buddy | Hôm nay · Lộ trình của tôi · Việc kèm cặp (badge) |
| CHT | Việc cần xử lý (badge) · Nhân sự · Cảnh báo (badge) · Khung năng lực |
| QLKV | Việc cần xử lý (badge) · Nhân sự · Cảnh báo (badge) · Khung năng lực |
| BP Đào tạo | Việc cần xử lý · Nhân sự · Cảnh báo · Khung năng lực · **Thiết kế lộ trình** · **Quản trị** |
| Người duyệt phiên bản | Thêm tab "Duyệt phiên bản" (badge số bản chờ duyệt) |

### 4.3 Sơ đồ trang

```
Đăng nhập
 ├─ Đăng ký tài khoản → Chờ duyệt
 └─ (đã duyệt)
     ├─ Hôm nay (NV)
     │   └─ Tổng quan Level → Xác nhận đã đọc (mở khóa checklist)
     ├─ Lộ trình của tôi (NV) = Hồ sơ NV, chế độ xem của NV
     ├─ Việc cần xử lý (Buddy/CHT/QLKV/BP ĐT)
     ├─ Nhân sự
     │   └─ Hồ sơ NV
     │       ├─ Tổng quan
     │       ├─ Checklist (theo giai đoạn)
     │       ├─ Doanh số
     │       ├─ Quan sát Rubric
     │       ├─ Buddy Score
     │       ├─ Chuyển Level (phiếu đánh giá + chuỗi ký)
     │       └─ Lịch sử lượt Level (các Level, phiên bản, tạm dừng, gia hạn)
     ├─ Cảnh báo
     ├─ Khung năng lực (chỉ xem, bản đang hiệu lực)
     ├─ Thiết kế lộ trình (BP ĐT)
     │   ├─ Danh sách phiên bản
     │   ├─ Khung năng lực (soạn thảo)
     │   ├─ Checklist theo giai đoạn (soạn thảo)
     │   ├─ Phiếu đánh giá
     │   ├─ Thiết lập chung (Level, trạng thái, tham số lịch, cảnh báo)
     │   ├─ Xem trước (giao diện điện thoại)
     │   └─ Chuyển phiên bản cho NV đang dở Level
     ├─ Duyệt phiên bản (Người duyệt)
     └─ Quản trị (BP ĐT)
         ├─ Tài khoản và vai trò
         ├─ Hàng chờ duyệt đăng ký
         ├─ Danh mục cửa hàng, khu vực
         ├─ Nhập tài khoản hàng loạt
         ├─ Nhật ký hệ thống
         ├─ Cấu hình hệ thống (thông báo, ngày lễ, tích hợp)
         └─ Công cụ demo (chỉ khi DEMO_MODE): ngày giả lập, chạy job, khôi phục dữ liệu mẫu
```

---

## 5. Module Quản trị người dùng (BP Đào tạo)

### 5.1 Đăng ký, đăng nhập, chờ duyệt

Giữ luồng của N3, bổ sung xác thực thật.

1. Người dùng đăng nhập bằng email công ty và mật khẩu, có tùy chọn mã OTP qua email (chi tiết kỹ thuật ở mục 14.8; bản demo có thêm đăng nhập nhanh, mục 14.7).
2. Lần đầu đăng nhập, nếu chưa có hồ sơ: hiện form **Đăng ký tài khoản** gồm Họ tên, Mã nhân viên, Vai trò đề nghị, Nhà thuốc, Khu vực, Số điện thoại.
3. Sau khi gửi: màn hình **Đang chờ duyệt**. Người dùng không thấy dữ liệu nào cho tới khi được duyệt.
4. Hệ thống gửi thông báo tới BP Đào tạo khi có đăng ký mới.

### 5.2 Màn hình Tài khoản và vai trò

Bố cục: thanh lọc phía trên, bảng tài khoản bên dưới, bấm vào một dòng để mở trang chi tiết tài khoản.

Thanh lọc: tìm theo tên / mã NV / email; lọc Vai trò, Khu vực, Cửa hàng, Trạng thái; nút "+ Tạo tài khoản", "Nhập từ CSV".

Cột của bảng:

| Cột | Nội dung |
|---|---|
| Họ tên | Tên + mã NV ở dòng phụ |
| Vai trò | Nhãn màu theo vai trò |
| Phạm vi | Cửa hàng hoặc khu vực được gán |
| Quyền bổ sung | Nhãn "Buddy", "Duyệt phiên bản" |
| Hồ sơ NV | Liên kết tới hồ sơ NV nếu là NV |
| Trạng thái | Chờ duyệt / Hoạt động / Tạm khóa / Đã nghỉ |
| Lần vào cuối | Ngày giờ |
| Thao tác | Duyệt, Sửa, Khóa |

Hàng chờ duyệt hiển thị thành thẻ cảnh báo ở đầu trang: "3 tài khoản đang chờ duyệt", có nút Duyệt và Từ chối (bắt buộc nhập lý do).

### 5.3 Trang chi tiết tài khoản

| Nhóm | Trường | Ghi chú |
|---|---|---|
| Thông tin | Họ tên, mã NV, email, điện thoại | Mã NV duy nhất |
| Vai trò | Vai trò tài khoản (1 giá trị) | NV / CHT / QLKV / BP ĐT |
| Phạm vi | Cửa hàng (nhiều), Khu vực (nhiều) | CHT bắt buộc ≥ 1 cửa hàng; QLKV bắt buộc ≥ 1 khu vực |
| Quyền bổ sung | Có thể làm Buddy | Bật thủ công, hoặc tự gợi ý khi NV đạt L3 |
| | Người duyệt phiên bản | Thường cấp cho QLKV hoặc BGĐ |
| Liên kết | Hồ sơ nhân viên | Chỉ với vai trò NV; một tài khoản gắn tối đa một hồ sơ |
| Trạng thái | Hoạt động / Tạm khóa / Đã nghỉ | |
| Lịch sử | Mọi thay đổi vai trò, phạm vi, quyền, trạng thái | Ai đổi, lúc nào, giá trị cũ và mới |

### 5.4 Quy tắc khi thay đổi tài khoản

1. Luôn phải còn ít nhất 1 tài khoản BP Đào tạo đang hoạt động. Hệ thống chặn hạ quyền hoặc khóa tài khoản BP ĐT cuối cùng.
2. Đổi vai trò hoặc phạm vi có hiệu lực ngay ở lần tải trang kế tiếp. Phiên đăng nhập hiện tại phải được làm mới quyền.
3. Khi khóa hoặc chuyển trạng thái "Đã nghỉ" một tài khoản đang là Buddy, CHT hoặc QLKV của lượt Level đang chạy: hiện màn hình **Chuyển giao**. Màn hình liệt kê các lượt bị ảnh hưởng và bắt buộc chọn người thay trước khi lưu.
4. Các xác nhận đã làm trước đó vẫn giữ nguyên tên người xác nhận (không bị xóa khi người đó nghỉ).
5. Từ chối đăng ký không xóa bản ghi, chỉ chuyển trạng thái "Bị từ chối" kèm lý do.

### 5.5 Danh mục cửa hàng và khu vực

- Khu vực: mã, tên, QLKV phụ trách (có thể nhiều).
- Cửa hàng: mã, tên, địa chỉ, khu vực, CHT phụ trách, trạng thái hoạt động.
- Hồ sơ NV và tài khoản chọn cửa hàng từ danh mục, không nhập chữ tự do (N3 đang nhập tự do, cần thay đổi).

### 5.6 Nhập tài khoản hàng loạt

- Tải mẫu CSV: mã NV, họ tên, email, điện thoại, vai trò, mã cửa hàng, mã khu vực, quyền Buddy.
- Sau khi tải lên: hiện bảng xem trước, đánh dấu dòng lỗi (trùng mã, cửa hàng không tồn tại), chỉ nhập các dòng hợp lệ khi người dùng xác nhận.

### 5.7 Nhật ký hệ thống

Ghi mọi thao tác thay đổi dữ liệu: đăng nhập, đổi quyền, ban hành phiên bản, xác nhận đầu việc, ký phiếu, nhập doanh số, chuyển phiên bản. Lọc theo người, loại thao tác, khoảng ngày. Chỉ BP ĐT xem được. Không cho sửa hoặc xóa nhật ký.

---

## 6. Module Xây dựng và quản lý Khung năng lực

Khung năng lực là phần "luật" của lộ trình. BP ĐT soạn trên form, không soạn trên Word.

### 6.1 Các nhóm cấu hình

| Tab | Nội dung | Nguồn N1 |
|---|---|---|
| Thời gian Level | Mã, tên gọi, giai đoạn, khẩu hiệu, từ tháng – đến tháng, định nghĩa cốt lõi. Thang thời gian trực quan hiển thị các Level nối nhau, vùng hở tô gạch đỏ | Mục 1.2 |
| Mục tiêu Level | Danh sách mục tiêu hành vi theo Level (tiêu đề + mô tả), hiển thị cho NV ở trang Tổng quan | 2.1, 3.1, 4.1, 5.1 |
| Phân công trách nhiệm | Ba cột Buddy/CHT, QLKV, BP ĐT theo Level, dạng danh sách gạch đầu dòng | 2.3, 3.3, 4.3, 5.3 |
| Doanh số | Theo Level: cách xét (mọi tháng đều đạt / trung bình), cửa sổ tháng xét, DS tổng, DS HS1, tỉ trọng HS1, ngưỡng cảnh báo | 1.4, 2.2… |
| Rubric quan sát | Tiêu chí (mã, tên, mô tả mức 1/2/3, bắt buộc), thang điểm, tổng điểm đạt, không chấp nhận điểm 1, số ca quan sát tối thiểu/tháng, định nghĩa "tư vấn độc lập" | Phụ lục C |
| Buddy Score | Câu hỏi, trọng số (tổng 100%), thang điểm, ngưỡng đạt, ngưỡng họp ba bên, số ngày sau khi bắt đầu | Phụ lục D |
| Chuyển Level | Theo từng bước chuyển: điều kiện bắt buộc (checklist, LMS, KPI, Rubric, Buddy Score, GPP), tỉ lệ mục tiêu, tỉ lệ giữ chân L4 | Mục 6, 1.3 |
| Cảnh báo | Danh sách quy tắc: điều kiện, ngưỡng, đơn vị, người nhận, hành động, bật/tắt | Phụ lục F.2 |
| Danh mục SKU, GPP | Nhóm SKU theo Level (số lượng, tên nhóm, liên kết LMS); module GPP theo Level | Phụ lục A, B |
| Career Path | Ba hướng phát triển sau L4, mô tả, đãi ngộ (rich text) | Phụ lục E |

### 6.2 Kiểm tra hợp lệ (chạy liên tục khi soạn, chặn gửi duyệt nếu có lỗi)

| Mã | Mức | Quy tắc |
|---|---|---|
| KNL-01 | Lỗi | Các Level phải nối liền, không hở tháng, không chồng lấn |
| KNL-02 | Lỗi | Chỉ Level cuối được để trống "đến tháng" |
| KNL-03 | Lỗi | Cửa sổ xét KPI phải nằm trong thời gian Level |
| KNL-04 | Lỗi | DS HS1 không lớn hơn DS tổng |
| KNL-05 | Lưu ý | Tỉ trọng HS1 khai báo lệch hơn 0,5 điểm % so với HS1 / DS tổng |
| KNL-06 | Lỗi | Ngưỡng đạt Rubric không vượt tổng điểm tối đa |
| KNL-07 | Lưu ý | Định nghĩa "x/y lần quan sát đạt" có y lớn hơn số ca quan sát tối thiểu/tháng |
| KNL-08 | Lỗi | Tổng trọng số Buddy Score phải bằng 100% |
| KNL-09 | Lỗi | Ngưỡng họp ba bên không được cao hơn ngưỡng đạt |
| KNL-10 | Lỗi | Mỗi bước chuyển Level có ít nhất 1 bước duyệt |
| KNL-11 | Lỗi | Bản nháp phải có ghi chú thay đổi và mã phiên bản không trùng |

Mỗi lỗi hiển thị trong khung "Kiểm tra trước khi gửi duyệt" ở đầu trang. Bấm vào lỗi sẽ chuyển tới đúng tab và đúng dòng, kèm hiệu ứng nhấp nháy để định vị.

---

## 7. Module Xây dựng và quản lý Checklist

### 7.1 Cấu trúc dữ liệu checklist

```
Phiên bản
 └─ Level (L1..L4)
     └─ Giai đoạn (thứ tự)
         ├─ Tên, mục tiêu giai đoạn
         ├─ Mốc thời gian: từ ngày thứ a đến ngày thứ b tính từ ngày bắt đầu Level
         ├─ Nhãn hiển thị (Tuần 1, Tháng 4–6, Quý 1…), số ca tham khảo (Ca 1–6)
         ├─ Chuỗi ký / duyệt cuối giai đoạn
         └─ Đầu việc (thứ tự)
             ├─ Mã đầu việc (cố định qua phiên bản)
             ├─ Nhóm nội dung (Hành chính, GPP, LMS, Doanh số…)
             ├─ Nội dung cần thực hiện / kiểm tra
             ├─ Hướng dẫn cho người xác nhận
             ├─ Người thực hiện / xác nhận (xem 7.2)
             ├─ Hạn: ngày thứ d tính từ ngày bắt đầu Level
             ├─ Cờ: GPP bắt buộc, Bắt buộc, Cho phép N/A
             ├─ Nguồn xác nhận: Thủ công / LMS / POS
             ├─ Bằng chứng yêu cầu: Không / Điểm số / Ghi chú-biên bản / Tệp đính kèm
             └─ Phụ thuộc: chỉ xác nhận được sau mã X, Y
```

Mốc thời gian lưu bằng **số ngày tính từ ngày bắt đầu Level**, theo mô hình của N3 (giai đoạn có `a`, `b`; đầu việc có `d`). Nhãn "Tuần / Tháng / Quý" chỉ để hiển thị. Cách này tránh sai lệch khi cộng tháng và để BP ĐT kiểm soát chính xác hạn từng mục.

Khi tạo đầu việc mới, hệ thống gợi ý hạn bằng cách **chia đều trong giai đoạn** theo thứ tự (cách N3 đang làm): `d_i = a + round((b − a) × i / n)`. BP ĐT có thể sửa tay.

### 7.2 Mô hình người xác nhận

Mỗi đầu việc có danh sách vai trò cần xác nhận. Đầu việc chỉ "Đã hoàn thành" khi **đủ tất cả** xác nhận.

| Loại trong N2 | Cấu hình trong hệ thống | Ai phải xác nhận |
|---|---|---|
| NV tự làm | Phần NV + 1 người kiểm tra | NV báo hoàn thành, sau đó Buddy (L1) hoặc CHT (L2–L4) xác nhận |
| Buddy | Phần NV + Buddy | NV báo hoàn thành, Buddy xác nhận đạt |
| CHT | Phần NV + CHT | |
| QLKV | Phần NV + QLKV | |
| BP Đào tạo / BP ĐT (GPP) | Phần NV + BP ĐT | |
| Phối hợp | Phần NV + nhiều vai trò | Mặc định L1: Buddy + CHT; L2–L4: CHT + QLKV (theo N3). BP ĐT chọn được |
| NV tự đánh giá | Chỉ phần NV, không chọn người xác nhận | NV báo hoàn thành là xong. Không dùng cho mục GPP (CK-07). Báo "Cần hỗ trợ" gửi Buddy (chưa có Buddy thì CHT); lượt CHT gửi Đào tạo |
| Người khác làm cho NV | Tắt phần NV + người xác nhận | Chỉ người xác nhận đánh dấu, NV không cần bấm (ví dụ check-in cuối ngày của lượt CHT do Đào tạo xác nhận) |
| (đầu việc POS) | Hệ thống tính + CHT xác nhận số liệu | Mở khi đã có số liệu tháng |

Trong trình soạn, trường "Người xác nhận" là ô chọn nhiều giá trị, kèm công tắc "Có phần NV xác nhận" (mặc định bật, theo N3). Bật: NV tự báo hoàn thành, người xác nhận chỉ xác nhận sau NV. Tắt: NV không cần bấm. Không chọn người xác nhận và tắt luôn phần NV thì đầu việc không có ai xác nhận, bị chặn (CK-06). Việc lưu danh sách vai trò tường minh thay vì dùng giá trị "Phối hợp" giúp tránh hiểu sai giữa các Level.

Đầu việc NV tự đánh giá vẫn có kiểm soát: CHT, QLKV, BP ĐT yêu cầu làm lại được sau khi NV báo xong (R07), và chuỗi ký cuối giai đoạn rà lại cả giai đoạn.

### 7.3 Màn hình soạn checklist

Bố cục theo N5:

- Cột trái: danh sách phiên bản (dạng dòng thời gian), trạng thái từng bản.
- Đầu trang: tên phiên bản, trạng thái, nút thao tác theo quyền, ghi chú thay đổi, **dải tác động** ("Có 3 thay đổi tiêu chí, chỉ áp dụng cho lượt Level mới" hoặc "Chỉ sửa diễn đạt, áp dụng ngay").
- Khung "Kiểm tra trước khi gửi duyệt".
- Các tab: Checklist theo giai đoạn · Phiếu đánh giá · Thiết lập chung · Xem trước.

Tab "Checklist theo giai đoạn":

- Nút chọn Level kèm số đầu việc.
- Thang thời gian của Level: các giai đoạn là khối màu nối nhau, vạch "Hết Level", vùng vượt thời gian tô gạch đỏ. Bấm vào khối để cuộn tới giai đoạn.
- Thanh công cụ: tìm kiếm (mã, nội dung, hướng dẫn), lọc theo người xác nhận, chỉ mục GPP, thu gọn / mở tất cả.
- Mỗi giai đoạn là một thẻ: số thứ tự, nhãn thời gian, tên, ngày a–b, ca, chuỗi ký (dạng chip, thêm/bớt), mục tiêu giai đoạn.
- Mỗi đầu việc là một dòng hai cột (Nội dung | Hướng dẫn), dòng thuộc tính bên dưới, nút lên / xuống / xóa bên phải. Đầu việc GPP có viền trái màu nhấn.
- Nút "Thêm đầu việc vào giai đoạn này", "Thêm giai đoạn".

Thao tác cần hỗ trợ:

| Thao tác | Yêu cầu |
|---|---|
| Thêm, sửa, xóa giai đoạn | Không cho xóa giai đoạn còn đầu việc |
| Thêm, sửa, xóa đầu việc | Khi xóa, tự gỡ các phụ thuộc trỏ tới mã đó và thông báo |
| Sắp xếp lại | Kéo thả hoặc nút lên/xuống trong cùng giai đoạn |
| Chuyển giai đoạn | Chọn giai đoạn đích trong cùng Level |
| Đổi mã đầu việc | Cảnh báo: đổi mã sẽ tính là "bỏ mục cũ + thêm mục mới" khi phân loại thay đổi và khi chuyển phiên bản. Tự cập nhật phụ thuộc |
| Bật cờ GPP | Tự bật "Bắt buộc", tắt "Cho phép N/A" |
| Nhập từ Excel | Theo mẫu cột của N2: #, Nhóm nội dung, Nội dung, Hướng dẫn, Người xác nhận. Tạo thành bản nháp mới |
| Xuất | JSON (lưu trữ, chuyển môi trường), Excel (theo mẫu N2), PDF (in cho cửa hàng) |

### 7.4 Phiếu đánh giá tổng kết (cấu hình theo Level)

| Phần | Trường cấu hình |
|---|---|
| Thông tin | Quy trình phiếu (mô tả), thời điểm dùng |
| A. Tiêu chí định lượng | Mã, tên, ngưỡng đạt, nguồn dữ liệu, ghi chú. Nguồn là POS/LMS/Rubric thì hệ thống điền sẵn kết quả gợi ý |
| B. Nhận xét định tính | Nội dung cần viết, số ý tối thiểu (hệ thống đếm dòng không rỗng) |
| C. Kết quả và gia hạn | Lựa chọn kết quả; cho phép gia hạn; thời gian mỗi lần (tháng); số lần tối đa; số mục tiêu tối đa |
| D. Chuỗi ký | Danh sách vai trò theo thứ tự. Mặc định theo N3: CHT ký đề xuất → QLKV phê duyệt → BP ĐT xác nhận và lưu hồ sơ → NV ký đã nhận kết quả |

### 7.5 Thiết lập chung

- Level: thời gian, tên checklist (Buddy Checklist / CHT Checklist), định nghĩa.
- Vai trò xác nhận: mã cố định, tên hiển thị có thể đổi, mô tả trách nhiệm.
- Trạng thái đầu việc (theo N2): Chưa bắt đầu, Đang thực hiện, Đã hoàn thành, Cần hỗ trợ, Bỏ qua/N-A. Mỗi trạng thái có cờ "tính là hoàn thành", "bắt buộc ghi chú", "báo cho vai trò".
- Tham số lịch (xem 10.4).

### 7.6 Xem trước

Mô phỏng màn hình điện thoại của NV và của Buddy/CHT cho Level đang chọn. Các mục có phụ thuộc hiển thị khóa. Có thể tích thử, không lưu.

### 7.7 Kiểm tra hợp lệ checklist

| Mã | Mức | Quy tắc |
|---|---|---|
| CK-01 | Lỗi | Mỗi Level có ít nhất 1 giai đoạn |
| CK-02 | Lỗi | Giai đoạn có b > a; các giai đoạn trong Level không chồng nhau |
| CK-03 | Lưu ý | Giai đoạn kế tiếp không liền mạch (hở ngày) |
| CK-04 | Lỗi | Ngày kết thúc giai đoạn cuối vượt thời gian Level trong Khung năng lực |
| CK-05 | Lỗi | Hạn đầu việc d nằm ngoài [a, b] của giai đoạn |
| CK-06 | Lỗi | Đầu việc thiếu nội dung, không có ai xác nhận (không chọn người xác nhận và tắt phần NV), mã trùng |
| CK-07 | Lỗi | Mục GPP được phép N/A, không bắt buộc, hoặc để NV tự xác nhận (không có người kiểm tra) |
| CK-08 | Lỗi | Phụ thuộc trỏ tới mã không tồn tại, hoặc tới mục ở giai đoạn sau |
| CK-09 | Lưu ý | Nội dung nhắc "Tháng N" hoặc "N tháng" ngoài thời gian Level |
| CK-10 | Lưu ý | Nội dung nhắc "bài thu hoạch Level N" khác Level đang chứa |
| CK-11 | Lỗi | Giai đoạn không có chuỗi ký, hoặc có ô ký chưa chọn vai trò |
| CK-12 | Lỗi | Phiếu đánh giá thiếu tiêu chí, tiêu chí thiếu ngưỡng, chuỗi ký trống |
| CK-13 | Lưu ý | Phiếu cho phép gia hạn nhưng chưa có thời gian / số lần tối đa |
| CK-14 | Lưu ý | Ngưỡng LMS không thống nhất giữa các phiếu |
| CK-15 | Lỗi | Vai trò được dùng nhưng không có trong danh sách vai trò |
| CK-18 | Lưu ý | Đầu việc NV tự xác nhận, không có người kiểm tra (để người duyệt thấy rõ) |

Các quy tắc CK-04, CK-06, CK-09, CK-10 đã bắt được lỗi thật trong N2 (xem mục 16).

---

## 8. Quản lý phiên bản

### 8.1 Bộ lộ trình là đơn vị phiên bản

Khung năng lực, Checklist và Phiếu đánh giá được phát hành chung một số phiên bản. Lý do: N1 và N2 hiện đang lệch nhau ở chính các con số dùng để tính (thời gian Level, ngưỡng, người xác nhận). Gộp phiên bản giúp loại bỏ rủi ro hai tài liệu trôi khỏi nhau.

### 8.2 Vòng đời phiên bản

```
 Nháp ──Gửi duyệt──▶ Chờ duyệt ──Duyệt và ban hành──▶ Đang hiệu lực ──(bản mới ban hành)──▶ Hết hiệu lực
   ▲                    │
   └────Rút về / Trả về─┘
```

| Trạng thái | Ai thao tác | Sửa nội dung |
|---|---|---|
| Nháp | BP ĐT | Được |
| Chờ duyệt | Người duyệt: duyệt hoặc trả về; BP ĐT: rút về | Không |
| Đang hiệu lực | Chỉ xem; tạo bản nháp mới từ bản này | Không |
| Hết hiệu lực | Chỉ xem; có thể tạo bản nháp từ bản này | Không |

Khi duyệt: bắt buộc nhập **ngày hiệu lực** (được phép ở tương lai) và người duyệt. Bản đang hiệu lực trước đó tự chuyển "Hết hiệu lực" với ngày kết thúc = ngày hiệu lực mới − 1. Hệ thống chặn ban hành khi còn lỗi kiểm tra.

### 8.3 Đánh số và phân loại thay đổi

Khi gửi duyệt, hệ thống tự phân loại bản nháp dựa trên trường bị thay đổi so với bản gốc (xử lý nội bộ, không có màn hình hiển thị chi tiết thay đổi):

| Loại | Trường thuộc loại này | Số phiên bản | Áp dụng cho NV đang dở Level |
|---|---|---|---|
| Sửa diễn đạt | Nội dung, hướng dẫn, nhóm nội dung, tên giai đoạn, mục tiêu giai đoạn, định nghĩa, mô tả vai trò, câu hỏi nhận xét | Tăng số thứ ba: 2.1 → 2.1.1 | Áp dụng ngay (mọi người thấy câu chữ mới) |
| Thay đổi tiêu chí | Mọi trường còn lại: mốc ngày, người xác nhận, cờ, phụ thuộc, ngưỡng, KPI, thêm/bỏ mục, chuỗi ký… | Tăng số thứ hai: 2.1 → 2.2 | Không áp dụng; chỉ lượt Level bắt đầu từ ngày hiệu lực |
| Bắt buộc áp dụng | Thay đổi tiêu chí + BP ĐT chạy "Chuyển phiên bản" | 2.2 | Theo danh sách NV được chọn |

Các bản cùng hai số đầu (2.1, 2.1.1, 2.1.2) gọi là **dòng tiêu chí 2.1**. Lượt Level gắn với dòng tiêu chí; câu chữ hiển thị lấy từ bản mới nhất trong dòng.

### 8.4 Chuyển phiên bản cho NV đang dở Level

Chỉ BP ĐT thực hiện, chỉ dùng khi bắt buộc (ví dụ quy định GPP mới).

1. Chọn phiên bản đích (đang hiệu lực).
2. Chọn đối tượng: theo Level, cửa hàng, khu vực, hoặc chọn từng NV.
3. Hệ thống hiện **bản xem trước tác động**: số NV bị ảnh hưởng, số mục mới, số mục bị bỏ, số mục mới đã quá hạn theo lịch.
4. Nhập thời gian ân hạn (mặc định 14 ngày) và lý do.
5. Xác nhận chạy. Quy tắc đối chiếu:

| Trường hợp | Xử lý |
|---|---|
| Mã có ở cả hai bản | Giữ nguyên trạng thái và xác nhận. Mục đã xong không bị đánh giá lại |
| Mã chỉ có ở bản mới | Thêm vào. Nếu hạn tính ra đã qua: hạn = ngày chuyển + thời gian ân hạn |
| Mã chỉ có ở bản cũ | Trạng thái "Không áp dụng do đổi phiên bản", giữ lịch sử, không tính vào tiến độ |

6. Ghi log chuyển phiên bản: người chạy, thời điểm, lý do, danh sách NV, kết quả đối chiếu từng mã.

---

## 9. Hồ sơ nhân viên, lượt Level và gán phiên bản

### 9.1 Hồ sơ nhân viên

Trường (giữ theo form của N3, đổi cửa hàng/khu vực sang chọn từ danh mục):

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Họ tên, mã NV | Có | |
| Cửa hàng | Có | Khu vực suy ra từ cửa hàng |
| Ngày nhận việc | Có | Lấy từ dữ liệu nhân sự nếu tích hợp được |
| Level hiện tại, ngày bắt đầu Level hiện tại | Có | Dùng khi nhập NV đang làm việc |
| Tài khoản của NV | Không | Chọn từ tài khoản vai trò NV đã duyệt |
| Buddy | Bắt buộc với L1–L2 | Chọn từ tài khoản có quyền "Có thể làm Buddy" hoặc CHT |
| CHT, QLKV | Có | Mặc định lấy theo cửa hàng, cho sửa |

### 9.2 Lượt Level

Mỗi lần NV bắt đầu một Level, hệ thống tạo một **lượt Level**:

1. Chọn phiên bản: bản có ngày hiệu lực ≤ ngày bắt đầu Level (dòng tiêu chí của bản đó).
2. Sinh toàn bộ đầu việc của Level từ phiên bản, **lưu cứng** ngày mở và hạn của từng việc (xem mục 10).
3. Gắn người phụ trách theo vai trò: Buddy, CHT, QLKV của lượt.
4. Trạng thái lượt: Chưa bắt đầu (ngày bắt đầu ở tương lai) → Đang chạy → Tạm dừng → Chờ đánh giá → Đạt / Gia hạn / Không đạt / Dừng.

Một NV có nhiều lượt theo thời gian, mỗi lượt có thể thuộc phiên bản khác nhau. Trang hồ sơ có thanh "Lộ trình 4 Level" (theo `pathBar` của N3): Level đã qua tô xanh, Level hiện tại tô màu nhấn, Level sau hiển thị ngày dự kiến.

### 9.3 Các tình huống vận hành

| Tình huống | Xử lý |
|---|---|
| Lên Level | Khi BP ĐT ký cuối phiếu với kết quả "Đủ điều kiện": đóng lượt cũ, tạo lượt Level mới với ngày bắt đầu = ngày ký (theo N3; xem vấn đề mở V9) |
| Gia hạn | Không tạo lượt mới, không đổi phiên bản. Tăng số lần gia hạn, kéo dài ngày kết thúc dự kiến theo cấu hình phiếu, tạo phiếu đánh giá vòng mới. Chặn khi vượt số lần tối đa, yêu cầu họp ba bên |
| Tạm dừng (nghỉ dài ngày, thai sản) | Nhập khoảng ngày. Mọi mốc chưa xong từ ngày bắt đầu tạm dừng lùi đúng số ngày nghỉ. CHT đề xuất, QLKV hoặc BP ĐT duyệt |
| Đổi Buddy / CHT / QLKV | Chỉ đổi người nhận các việc chưa xác nhận. Lịch không đổi. Ghi lịch sử phân công |
| Chuyển cửa hàng | Đổi cửa hàng, gợi ý CHT/QLKV mới, lịch không đổi |
| Nghỉ việc | "Ngừng theo dõi": lượt chuyển trạng thái Dừng, dữ liệu giữ nguyên. Nếu NV đang là Buddy của người khác, bắt buộc chuyển giao |
| Không đạt, không được gia hạn | Đóng lượt "Không đạt". Xét lại sau thì tạo lượt mới với phiên bản hiện hành |

### 9.4 Xác nhận đã đọc tổng quan Level

Theo N3: khi bắt đầu Level, NV phải đọc trang "Tổng quan Level" (mục tiêu, người đồng hành, chỉ tiêu, nhiệm vụ LMS và tại quầy) và bấm "Tôi đã đọc và hiểu". Trước khi xác nhận, các tab còn lại bị khóa. Nếu NV chưa có tài khoản, Buddy/CHT xác nhận thay. Thời điểm xác nhận được lưu và hiển thị.

---

## 10. Bộ tính lịch và giao việc

### 10.1 Mốc gốc

Mọi ngày được tính từ **ngày bắt đầu lượt Level** (S) của từng NV. Với Level 1, S = ngày nhận việc. Hai NV vào cách nhau 3 ngày sẽ có lịch lệch nhau đúng 3 ngày.

### 10.2 Công thức

| Mốc | Công thức |
|---|---|
| Mở giai đoạn | S + a |
| Kết thúc giai đoạn | S + b |
| Hạn đầu việc | S + d |
| Mở đầu việc | Ngày mở giai đoạn (đầu việc hiện trong "Sắp tới" từ trước đó `upcomingDays` ngày) |
| Ký cuối giai đoạn | Mở từ (S + b − signOpenBefore), hạn (S + b + signDueAfter), chỉ bấm được khi các mục bắt buộc của giai đoạn đã xong |
| Phiếu đánh giá | Mở từ ngày mở giai đoạn cuối, hạn = ngày kết thúc dự kiến của Level |
| Đầu việc nguồn POS | Mở ngày `posDataDay` của tháng sau tháng chứa hạn (khi đã chốt số liệu) |
| Kết thúc dự kiến Level | S + số ngày của Level (L1 = 60 theo N3) + tổng ngày tạm dừng + gia hạn |
| Tạm dừng [P1, P2] | Mọi mốc ≥ P1 cộng thêm (P2 − P1 + 1) ngày |

Toàn bộ ngày tính theo ngày lịch, múi giờ Asia/Ho_Chi_Minh. Ngày được lưu cứng khi tạo lượt; chỉ tính lại khi có sự kiện tạm dừng, gia hạn, chuyển phiên bản, và mỗi lần tính lại đều ghi log (ngày cũ, ngày mới, lý do).

### 10.3 Trạng thái đầu việc tại ngày T (thứ tự ưu tiên)

| Thứ tự | Điều kiện | Trạng thái hiển thị | Màu |
|---|---|---|---|
| 1 | Đủ mọi xác nhận | Xong (ngày) | ok |
| 2 | Được đánh N/A | Bỏ qua / N-A | trung tính |
| 3 | T < ngày mở | Sắp mở (ngày) | trung tính |
| 4 | Phụ thuộc chưa xong / chưa tới lượt ký | Chờ [mã / vai trò] | trung tính |
| 5 | Có yêu cầu làm lại | Cần làm lại | bad |
| 6 | NV báo "Cần hỗ trợ" | Cần hỗ trợ | bad |
| 7 | Nguồn POS và T < ngày có số liệu | Chờ số liệu POS | info |
| 8 | T > hạn | Trễ N ngày | bad |
| 9 | Hạn − T ≤ remindDays | Hạn hôm nay / Còn N ngày | warn |
| 10 | Còn lại | Hạn dd/mm | trung tính |

### 10.4 Tham số lịch (BP ĐT cấu hình, có phiên bản)

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| remindDays | 3 | Chuyển "Sắp đến hạn" và gửi nhắc |
| escalateDays | 7 | Quá hạn hơn N ngày thì báo QLKV (F.2) |
| signOpenBefore | 3 | Mở ký cuối giai đoạn trước khi giai đoạn kết thúc |
| signDueAfter | 3 | Hạn ký sau khi giai đoạn kết thúc |
| posDataDay | 5 | Ngày chốt số liệu POS tháng trước |
| exemptFromDay | 15 | Vào làm từ ngày này thì tháng đầu miễn chỉ tiêu (N2 #37) |
| upcomingDays | 14 | Hiển thị việc sắp mở |
| graceDays | 14 | Ân hạn khi chuyển phiên bản |
| shiftsPerWeek | 6 | Ước tính "ca thứ mấy" khi chưa có chấm công |

### 10.5 Giao việc theo người

Việc được giao theo vai trò, phân giải ra người tại thời điểm hiển thị:

| Vai trò trong đầu việc | Người nhận |
|---|---|
| NV | NV của lượt (nếu chưa có tài khoản: Buddy, nếu không có Buddy thì CHT) |
| Buddy | Buddy của lượt; nếu chưa gán thì CHT |
| CHT | CHT của lượt |
| QLKV | QLKV của lượt |
| BP ĐT | Mọi tài khoản BP ĐT (ai xác nhận trước thì tính) |

Hàng đợi "Việc cần xử lý" của một người gồm mọi đầu việc, chữ ký giai đoạn, chữ ký phiếu mà người đó còn phần chưa xác nhận, xếp theo ưu tiên (theo `inboxData` của N3):

1. NV đã báo xong hoặc báo "Cần hỗ trợ", đang chờ người này.
2. Việc của người này đã quá hạn.
3. Việc đến hạn trong 7 ngày tới.

### 10.6 Thông báo

| Sự kiện | Người nhận | Kênh |
|---|---|---|
| Lượt Level sắp bắt đầu (trước 1 ngày) | NV, Buddy, CHT | Trong ứng dụng + email/Zalo |
| Đầu việc mở | Người thực hiện | Gộp thành bản tin sáng hằng ngày |
| Còn `remindDays` ngày tới hạn | Người còn thiếu xác nhận | Bản tin sáng |
| NV báo hoàn thành / Cần hỗ trợ | Người xác nhận kế tiếp | Ngay lập tức, trong ứng dụng |
| Yêu cầu làm lại | NV | Ngay lập tức |
| Quá hạn > escalateDays | QLKV | Bản tin sáng |
| Có phiếu chờ ký | Người ký kế tiếp | Ngay lập tức |
| Bản nháp chờ duyệt | Người duyệt phiên bản | Ngay lập tức |
| Đăng ký tài khoản mới | BP ĐT | Ngay lập tức |

Job hằng ngày lúc 06:00 chạy trong backend (mục 14.11), có khóa chống trùng khi chạy lại. Bản demo chỉ gửi thông báo trong ứng dụng; nếu bật Mailpit thì xem được email bản tin.

---

## 11. Màn hình nghiệp vụ hằng ngày

Các màn hình dưới đây giữ bố cục và hành vi của N3, bổ sung theo các yêu cầu đã phân tích.

### 11.1 Hôm nay (NV)

- Thẻ đầu: "Chào [tên], hôm nay dd/mm", Level, ngày thứ N/tổng, giai đoạn hiện tại, phần trăm hoàn thành lớn bên phải, thanh tiến độ, thanh lộ trình 4 Level.
- Cảnh báo: số mục bị yêu cầu làm lại (đỏ), số việc quá hạn (đỏ), số mục đã báo xong đang chờ xác nhận (xanh thông tin).
- Các nhóm: Quá hạn · Hôm nay và 3 ngày tới · Trong tuần tới · Sắp tới (tối đa 6 mục).
- Mục "Người quản lý sẽ kiểm tra bạn": các mục do Buddy/CHT quan sát trong giai đoạn hiện tại, chỉ đọc.
- Nếu Level chưa bắt đầu: "Lộ trình Level N bắt đầu ngày dd/mm (còn N ngày)".
- Nếu chưa xác nhận đã đọc: hiện trang Tổng quan Level trước.

### 11.2 Dòng đầu việc (thành phần dùng chung)

Theo `itemRow` của N3:

- Ô trạng thái bên trái: trống / ✓ xanh (xong) / … vàng (đang làm) / ! (cần hỗ trợ) / viền đỏ (trễ).
- Nội dung, đầu việc GPP có viền trái nhấn.
- Dòng meta: chip vai trò cần xác nhận (đã xác nhận có dấu ✓, chưa thì viền đứt), nhóm nội dung, thẻ hạn, "Chờ CHT + QLKV", "Cần làm lại", "Cần hỗ trợ", tên NV (khi ở hàng đợi quản lý).
- Bấm để mở rộng: hướng dẫn thực hiện; lý do yêu cầu làm lại; lịch sử (thời gian, người, vai trò, thao tác, ghi chú); ô ghi chú; nút "Tôi đã làm xong" / "Xác nhận đạt (vai trò)" / "Hủy xác nhận của tôi" / "Yêu cầu làm lại".
- Bổ sung so với N3: trường bằng chứng (điểm số, tệp đính kèm) hiện khi đầu việc yêu cầu.

### 11.3 Việc cần xử lý (Buddy, CHT, QLKV, BP ĐT)

- Bốn ô thống kê: Đang chờ bạn · Việc của bạn quá hạn · Đến hạn trong 7 ngày · Nhân sự phụ trách.
- Danh sách nhóm theo nhân viên: tên, Level, cửa hàng, nút "Mở hồ sơ", các dòng đầu việc.
- Thêm nhóm "Chữ ký chờ bạn" (ký giai đoạn, ký phiếu).
- QLKV có thêm khối "Cảnh báo trong khu vực" (việc của người khác quá hạn > escalateDays).

### 11.4 Nhân sự

- Bốn ô thống kê: Tổng nhân sự (theo Level) · % checklist trung bình · Mục đang trễ hạn · Nhân sự có cảnh báo đỏ.
- QLKV, BP ĐT: bảng tóm tắt theo cửa hàng (mở rộng được).
- Lọc: tìm tên/mã, cửa hàng, Level; nút "+ Thêm nhân viên".
- Bảng: Nhân viên · Cửa hàng · Level (ngày N/tổng) · Tiến độ · Trễ hạn · Cảnh báo (đỏ/vàng/ổn) · Phiên bản · Mở.
- Mặc định sắp xếp: nhiều cảnh báo đỏ trước.

### 11.5 Hồ sơ nhân viên

Đầu trang (theo `staffHeader`): tên, mã, cửa hàng, khu vực, ngày nhận việc; nhãn "Level N, ngày X/Y"; nhãn đã đọc tổng quan; nút "Sửa hồ sơ"; Buddy/CHT/QLKV dạng chip; thanh lộ trình; thanh tiến độ; danh sách cảnh báo. Bổ sung: nhãn phiên bản đang gắn (ví dụ "Checklist v2.1"), trạng thái tạm dừng / gia hạn.

Tab phụ: Tổng quan · Checklist · Doanh số · Quan sát Rubric · Buddy Score · Chuyển Level · Lịch sử lượt. Có bộ chọn Level để xem lại các Level đã qua.

**Tab Checklist** (theo `stageBlock` + `checkTable`): mỗi giai đoạn là một thẻ có tiêu đề, mục tiêu, khoảng ngày, số mục xong/tổng, nút ký giai đoạn. Bảng cột: # · Nội dung · Hạn · Trạng thái (ô chọn) · Ngày hoàn thành · Nhân viên xác nhận · Người khác xác nhận. Trên điện thoại bảng chuyển thành thẻ (mỗi ô có nhãn).

**Tab Doanh số** (theo `salesTab`): bảng theo tháng của Level, cột DS tổng, % đạt, DS HS1, % đạt, tỉ trọng HS1. CHT/QLKV/BP ĐT nhập trực tiếp (đơn vị triệu đồng). Nhãn "tháng đánh giá" (L1) hoặc "tính điều kiện" (2 tháng cuối L2–L4). Thẻ kết quả: Đạt 2/2 tháng / TB 2 tháng cuối…

**Tab Quan sát Rubric** (theo `obsTab`): form ghi ca quan sát (ngày, 5 tiêu chí chấm 1–3, nhận xét), danh sách ca đã quan sát, tỉ lệ đạt so với mục tiêu 80%. Tiêu chí lấy từ phiên bản của lượt.

**Tab Buddy Score** (mới, N3 chưa có): NV mới chấm Buddy sau `daysAfter` ngày theo câu hỏi và trọng số trong phiên bản; hiện điểm trung bình có trọng số; dưới ngưỡng họp ba bên thì tạo cảnh báo. Kết quả hiển thị ở hồ sơ của Buddy (dùng cho điều kiện L3→L4).

**Tab Chuyển Level** (theo `promoTab`): bốn ô số liệu tự động (checklist, mục trễ, Rubric, doanh số); nhắc nếu checklist chưa xong; phiếu đánh giá theo cấu hình phiếu của phiên bản; chuỗi ký theo thứ tự, mỗi bước hiện người ký, thời điểm, hoặc "Chưa đến lượt". Ký bước cuối thì hệ thống chuyển Level hoặc ghi nhận gia hạn.

### 11.6 Cảnh báo

Danh sách cảnh báo trong phạm vi, đỏ trước vàng sau, mỗi dòng có tên NV, Level, cửa hàng, nội dung, nút mở hồ sơ. Quy tắc lấy từ cấu hình phiên bản (mặc định theo N3 và N1 F.2):

| Quy tắc | Mức |
|---|---|
| Module GPP chưa xong sau N ngày làm việc | Đỏ |
| Chưa phân công Buddy sau 48 giờ (L1–L2) | Đỏ |
| Chưa gắn CHT | Vàng |
| Có mục trễ hạn hơn 7 ngày | Đỏ |
| Có mục trễ hạn | Vàng |
| DS tổng dưới 80% mức tham khảo 2 tháng liên tiếp | Vàng |
| Tỉ lệ ca Rubric đạt dưới 80% (khi có ≥ 3 ca) | Vàng |
| NV không đăng nhập quá 5 ngày (L1) | Vàng |
| Quá thời gian Level 14 ngày chưa có quyết định | Vàng |
| Buddy Score dưới ngưỡng họp ba bên | Đỏ |
| Lỗi an toàn thuốc nghiêm trọng được ghi nhận | Đỏ |

---

## 12. Quy tắc nghiệp vụ tổng hợp

| Mã | Quy tắc |
|---|---|
| R01 | Lượt Level gắn với dòng tiêu chí của phiên bản hiệu lực tại ngày bắt đầu, giữ đến hết lượt |
| R02 | Sửa diễn đạt áp dụng ngay cho mọi lượt cùng dòng tiêu chí; thay đổi tiêu chí chỉ áp dụng cho lượt mới hoặc khi chạy chuyển phiên bản |
| R03 | Bản đã ban hành không sửa được |
| R04 | Đầu việc "Đã hoàn thành" khi đủ mọi vai trò yêu cầu xác nhận |
| R05 | NV đã có tài khoản thì phần NV bắt buộc do NV tự xác nhận |
| R06 | CHT được xác nhận thay Buddy; hệ thống ghi rõ là xác nhận thay |
| R07 | "Yêu cầu làm lại" bắt buộc có lý do, xóa mọi xác nhận hiện có của đầu việc |
| R08 | Mỗi người chỉ hủy được xác nhận của chính mình |
| R09 | Chỉ CHT, QLKV, BP ĐT được đánh N/A; mục GPP không được N/A |
| R10 | Phụ thuộc chưa xong thì không xác nhận được mục phụ thuộc |
| R11 | Ký cuối giai đoạn chỉ thực hiện được khi mọi mục bắt buộc của giai đoạn đã xong hoặc N/A |
| R12 | Chuỗi ký (giai đoạn, phiếu) đi theo thứ tự; bước sau chỉ mở khi bước trước đã ký |
| R13 | Phiếu đánh giá: CHT chỉ ký khi đã chọn kết quả và điền đủ 2 phần nhận xét bắt buộc |
| R14 | Gia hạn không quá số lần tối đa trong cấu hình phiếu (L1: 2 lần, mỗi lần 1 tháng, ≤ 3 mục tiêu) |
| R15 | KPI L1: mọi tháng trong cửa sổ phải đạt (2/2 tháng); L2–L4: trung bình 2 tháng cuối Level |
| R16 | Rubric: ca đạt khi tổng ≥ 10/15 và không tiêu chí nào 1 điểm |
| R17 | Buddy Score đạt khi trung bình có trọng số ≥ 3,5/5; dưới 3,0 tạo cảnh báo họp ba bên |
| R18 | Ngày tính theo ngày lịch từ ngày bắt đầu Level; mọi thay đổi ngày đều ghi log |
| R19 | Luôn còn ít nhất 1 BP ĐT hoạt động |
| R20 | Khóa tài khoản đang được phân công thì phải chuyển giao trước |
| R21 | Dữ liệu xác nhận, phiếu, nhật ký không bị xóa vật lý (chỉ đánh dấu) |
| R22 | Phạm vi dữ liệu được kiểm tra ở tầng máy chủ (không chỉ ẩn trên giao diện) |

---

## 13. Mô hình dữ liệu

PostgreSQL 16, quản lý migration bằng Drizzle (mục 14.2). Tên bảng và cột mang tính tham khảo, đội phát triển tinh chỉnh.

### 13.1 Tổ chức và người dùng

| Bảng | Cột chính |
|---|---|
| `areas` | id, code, name, active |
| `stores` | id, code, name, address, area_id, active |
| `users` | id, auth_id, employee_code, full_name, email, phone, role (`nv`/`cht`/`qlkv`/`bp`), status (`pending`/`active`/`locked`/`left`/`rejected`), can_buddy, can_approve_versions, last_seen_at, created_at |
| `user_store_scopes` | user_id, store_id |
| `user_area_scopes` | user_id, area_id |
| `user_changes` | id, user_id, changed_by, field, old_value, new_value, at |
| `credentials` | user_id, password_hash (argon2id), otp_secret, password_changed_at |
| `sessions` | id, user_id, refresh_token_hash, user_agent, ip, created_at, expires_at, revoked_at (chỉ dùng khi chạy thật) |
| `system_settings` | key, value, updated_by, updated_at (ví dụ `fake_today` cho ngày giả lập ở bản demo) |

### 13.2 Phiên bản và nội dung

| Bảng | Cột chính |
|---|---|
| `versions` | id, code (2.1.1), criteria_line (2.1), status, effective_from, effective_to, parent_id, change_note, change_kind (`text`/`criteria`), submitted_by/at, approved_by/at |
| `v_levels` | version_id, level_key, name, title, stage, motto, from_month, to_month, total_days, checklist_name, definition |
| `v_level_goals` | version_id, level_key, order, title, body |
| `v_responsibilities` | version_id, level_key, party (`buddy_cht`/`qlkv`/`bp`), order, text |
| `v_kpis` | version_id, level_key, method (`all_months`/`average`), win_from, win_to, total, coef1, ratio, warn_total, warn_coef1, warn_ratio |
| `v_rubric` | version_id, scale_max, pass_total, forbid_one, min_obs_per_month, independent_pass, independent_of |
| `v_rubric_criteria` | version_id, key, order, name, d1, d2, d3, critical |
| `v_buddy_score` | version_id, days_after, scale_max, pass_avg, escalate_below |
| `v_buddy_questions` | version_id, key, order, text, weight |
| `v_transitions` | version_id, key (L1-L2), from_level, to_level, target_rate, conditions (jsonb) |
| `v_alert_rules` | version_id, key, name, param, unit, recipients, action, severity, enabled |
| `v_schedule_params` | version_id, remind_days, escalate_days, sign_open_before, sign_due_after, pos_data_day, exempt_from_day, upcoming_days, grace_days, shifts_per_week |
| `v_stages` | version_id, key, level_key, order, name, label, offset_start, offset_end, shift_from, shift_to, goal |
| `v_stage_signers` | version_id, stage_key, order, role |
| `v_items` | version_id, item_key, level_key, stage_key, order, category, content, guidance, due_offset, gpp, required, allow_na, data_source, evidence, require_nv_first, source_ref (Excel #) |
| `v_item_verifiers` | version_id, item_key, role |
| `v_item_deps` | version_id, item_key, depends_on_key |
| `v_forms` | version_id, level_key, flow, when_text, results (jsonb), ext_enabled, ext_months, ext_max_times, ext_max_goals |
| `v_form_criteria` | version_id, level_key, key, order, name, threshold, source, note |
| `v_form_prompts` | version_id, level_key, key, order, text, min_points |
| `v_form_signers` | version_id, level_key, order, role |
| `v_statuses` | version_id, key, name, counts_done, need_note, notify_role |

Ghi chú: có thể lưu nội dung phiên bản dạng một tài liệu JSONB bất biến để đơn giản hóa, kèm các bảng chỉ mục phục vụ truy vấn. Yêu cầu bắt buộc: bản đã ban hành bất biến.

### 13.3 Vận hành

| Bảng | Cột chính |
|---|---|
| `staff` | id, user_id (nullable), employee_code, full_name, store_id, hire_date, current_level, active |
| `level_runs` | id, staff_id, level_key, version_id, criteria_line, start_date, planned_end, status, ext_count, ack_by, ack_at, created_by |
| `run_assignments` | run_id, role (`buddy`/`cht`/`qlkv`), user_id, from_date, to_date |
| `run_pauses` | run_id, from_date, to_date, reason, requested_by, approved_by |
| `run_tasks` | id, run_id, item_key, open_date, due_date, status (`todo`/`doing`/`help`/`na`/`done`/`void`), na_reason, rework_note, rework_by, rework_at |
| `task_confirmations` | task_id, role, user_id, on_behalf_of_role, at, note, evidence (jsonb) |
| `task_events` | id, task_id, user_id, role, action, note, at |
| `task_date_changes` | task_id, old_open, old_due, new_open, new_due, reason (`pause`/`extend`/`migrate`), at, by |
| `stage_signoffs` | run_id, stage_key, order, role, user_id, at |
| `sales_monthly` | run_id, month_index, total, coef1, source (`manual`/`pos`), entered_by, at |
| `observations` | id, run_id, date, scores (jsonb), note, observer_id |
| `buddy_scores` | id, mentee_run_id, buddy_user_id, answers (jsonb), weighted_avg, at |
| `level_reviews` | id, run_id, round (0 = lần đầu, 1.. = gia hạn), criteria_results (jsonb), notes (jsonb), result, ext_goals, saved_by, saved_at |
| `review_signatures` | review_id, order, role, user_id, at |
| `version_migrations` | id, from_version_id, to_version_id, run_ids, grace_days, reason, report (jsonb), by, at |
| `notifications` | id, user_id, type, ref, channel, sent_at, read_at |
| `audit_logs` | id, user_id, action, entity, entity_id, payload (jsonb), at, ip |

---

## 14. Kiến trúc kỹ thuật (bản demo chạy local)

Mục tiêu của bản đầu tiên: **chạy trên một máy tính, một lệnh khởi động, mở trình duyệt là dùng được**. Có sẵn dữ liệu mẫu và công cụ "tua ngày" để trình diễn việc giao việc theo ngày vào làm. Không cần máy chủ, tên miền hay chứng chỉ. **Không dùng Docker**: mọi thành phần cài và chạy trực tiếp trên máy.

### 14.1 Nguyên tắc thiết kế cho demo

1. Chỉ ba thành phần: **PostgreSQL** (cài trực tiếp trên máy), **API NestJS**, **giao diện Vue** (chạy bằng Node.js). API phục vụ luôn file Vue đã build, nên người dùng chỉ cần mở một địa chỉ: `http://localhost:3000`.
2. Không dùng hạ tầng phụ (Redis, kho tệp S3, reverse proxy, máy chủ email, công cụ giám sát). Mỗi thứ được thay bằng một bản tối giản chạy ngay trong tiến trình API.
3. Các phần tối giản đó được viết sau một interface (adapter): `ClockService`, `StorageService`, `Notifier`, `JobRunner`. Khi chuyển sang chạy thật chỉ cần thay adapter, không phải sửa nghiệp vụ (mục 14.14).
4. **Demo chỉ khác bản thật ở hạ tầng, không khác ở nghiệp vụ.** Phân quyền, mô hình dữ liệu, tính lịch, phiên bản giữ đúng như các mục 3–13.

### 14.2 Công nghệ sử dụng

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| Cơ sở dữ liệu | **PostgreSQL 16**, cài trực tiếp trên máy (bộ cài chính thức hoặc trình quản lý gói của hệ điều hành) | Dữ liệu nằm trong thư mục dữ liệu của PostgreSQL trên máy demo |
| Backend | **NestJS 10, Node.js 20 LTS, TypeScript** | API REST, phân quyền, nghiệp vụ, job hằng ngày; phục vụ luôn giao diện Vue |
| Truy cập dữ liệu | **Drizzle ORM** + drizzle-kit | Migration dạng file SQL, viết được trigger |
| Kiểm tra dữ liệu vào | **Zod**, đặt trong gói `shared` | Dùng chung cho form Vue và API |
| Frontend | **Vue 3 + TypeScript + Vite** | Vue Router, Pinia, TanStack Query for Vue |
| Thành phần giao diện | CSS variables theo mục 15 + **Reka UI** (headless) | Giữ đúng nhận diện của N3 |
| Form, kéo thả, ngày | VeeValidate + Zod; vuedraggable; date-fns + date-fns-tz | |
| Phân quyền | **CASL** | Ma trận mục 3.3 viết thành một file cấu hình |
| Mật khẩu | **bcryptjs** | Thuần JavaScript, không cần biên dịch trên Windows |
| Job hằng ngày | **@nestjs/schedule** (cron trong tiến trình API) | Có nút "Chạy ngay" trong Công cụ demo |
| Thông báo | Trong ứng dụng (chuông thông báo, trang Thông báo) | Tùy chọn chạy **Mailpit** (một file chạy độc lập, không cần cài) để xem email bản tin trên `http://localhost:8025` |
| Tệp đính kèm | Thư mục `./storage` trên máy | Giới hạn 10 MB/tệp, chỉ ảnh và PDF |
| In, PDF | In từ trình duyệt bằng CSS in (`@media print`) | |
| Đọc/ghi Excel | **exceljs** | Nhập checklist theo mẫu N2, xuất báo cáo |
| Tài liệu API | Swagger UI tại `/api/docs` | |
| Kiểm thử | Vitest (shared, API, web); Playwright tùy chọn | Ưu tiên test hàm tính lịch và ma trận quyền |

Lý do chọn NestJS cho backend: dùng chung TypeScript với Vue, nên **hàm tính lịch và bộ kiểm tra hợp lệ chỉ viết một lần** trong gói `shared`. Bộ này chạy ở server (nguồn chính xác) và chạy cả trong trình duyệt cho màn "Xem trước", thanh thời gian giai đoạn và khung kiểm tra khi BP ĐT đang soạn. NestJS cũng có sẵn module, guard, cron, Swagger, giúp dựng demo nhanh mà vẫn đủ cấu trúc để phát triển tiếp.

### 14.3 Sơ đồ

```
 Máy tính chạy demo (Windows / macOS / Ubuntu)
 Đã cài: Node.js 20 LTS, pnpm 9, PostgreSQL 16
 ┌──────────────────────────────────────────────────────────┐
 │  Trình duyệt ──► http://localhost:3000                   │
 │                          │                               │
 │   ┌──────────────────────▼───────────────────────┐       │
 │   │ Tiến trình Node.js: API NestJS, cổng 3000    │       │
 │   │ (khởi động bằng lệnh `pnpm start`)           │       │
 │   │  ├─ /            giao diện Vue (file tĩnh)   │       │
 │   │  ├─ /api/v1/*    API                         │       │
 │   │  ├─ /api/docs    Swagger                     │       │
 │   │  ├─ cron         bản tin 06:00, cảnh báo     │       │
 │   │  └─ thư mục ./storage (tệp đính kèm)         │       │
 │   └──────────────────────┬───────────────────────┘       │
 │                          ▼                               │
 │   PostgreSQL 16 (dịch vụ của hệ điều hành, cổng 5432)    │
 │                                                          │
 │   Mailpit (tùy chọn) ── http://localhost:8025            │
 └──────────────────────────────────────────────────────────┘
```

### 14.4 Cấu trúc mã nguồn

Một repository, quản lý bằng **pnpm workspaces**.

```
upharma-lo-trinh/
├─ apps/
│  ├─ web/                      Vue 3
│  │  ├─ src/pages/             Theo sơ đồ trang mục 4.3
│  │  ├─ src/components/        ItemRow, StageCard, RoleChip, PathBar, StatusPill…
│  │  ├─ src/styles/tokens.css  Biến màu sáng/tối mục 15.1
│  │  └─ src/api/               Client gọi API
│  └─ api/                      NestJS
│     ├─ src/modules/           Một module cho mỗi nhóm nghiệp vụ (mục 14.5)
│     ├─ src/adapters/          clock, storage, notifier, jobs (bản demo)
│     └─ src/db/                Schema Drizzle, migration SQL, seed
├─ packages/
│  └─ shared/
│     ├─ schemas/               Zod: phiên bản, giai đoạn, đầu việc, phiếu, người dùng
│     ├─ schedule/              Hàm thuần tính ngày mở, hạn, trạng thái (mục 10)
│     ├─ validation/            Quy tắc KNL-01..11, CK-01..15
│     └─ change-kind/           Phân loại sửa diễn đạt / thay đổi tiêu chí (mục 8.3)
├─ seed/                        JSON bộ lộ trình v2.1 và dữ liệu mẫu (mục 14.12)
├─ scripts/
│  └─ setup-db.sql              Tạo user và cơ sở dữ liệu `lotrinh` trên PostgreSQL cài sẵn
├─ .env.example
└─ README.md                    Hướng dẫn chạy, tài khoản mẫu, kịch bản demo
```

### 14.5 Các module backend

| Module | Phụ trách | Mục đặc tả |
|---|---|---|
| `auth` | Đăng nhập, đăng xuất, đăng ký chờ duyệt, đăng nhập nhanh (demo) | 5.1, 14.7 |
| `users` | Tài khoản, vai trò, phạm vi, quyền bổ sung, chuyển giao, nhập CSV | 5.2–5.6 |
| `org` | Khu vực, cửa hàng | 5.5 |
| `versions` | Vòng đời phiên bản, phân loại thay đổi, ban hành | 8.1–8.3 |
| `framework` | Nội dung Khung năng lực trong phiên bản | 6 |
| `checklist` | Giai đoạn, đầu việc, phiếu, thiết lập; nhập/xuất Excel, JSON | 7 |
| `migrations` | Chuyển phiên bản cho NV đang dở Level | 8.4 |
| `staff`, `runs` | Hồ sơ NV, lượt Level, phân công, tạm dừng, gia hạn, lên Level | 9 |
| `tasks` | Đầu việc của lượt, xác nhận, làm lại, N/A, ký giai đoạn, hàng đợi | 10, 11.2–11.3 |
| `reviews` | Phiếu đánh giá, chuỗi ký | 11.5 |
| `sales`, `observations`, `buddy-scores` | Doanh số, Rubric, Buddy Score | 11.5 |
| `alerts` | Tính cảnh báo theo quy tắc của phiên bản | 11.6 |
| `notifications` | Thông báo trong ứng dụng; gửi email nếu cấu hình SMTP | 10.6 |
| `reports` | Xuất CSV | 11.4 |
| `audit` | Ghi và tra cứu nhật ký hệ thống | 5.7 |
| `demo` | Ngày giả lập, chạy job ngay, khôi phục dữ liệu mẫu (chỉ bật khi `DEMO_MODE=true`) | 14.7 |

### 14.6 Cách chạy

Ứng dụng chạy trực tiếp trên máy, **không dùng Docker**.

**Yêu cầu máy:** Windows 10 trở lên, macOS hoặc Ubuntu; RAM 4 GB; trống 2 GB ổ đĩa. Cài sẵn:

| Phần mềm | Phiên bản | Cách cài |
|---|---|---|
| Node.js | 20 LTS trở lên | Bộ cài từ nodejs.org, hoặc nvm |
| pnpm | 9 | `corepack enable && corepack prepare pnpm@9 --activate` (hoặc `npm i -g pnpm@9`) |
| PostgreSQL | 16 | Ubuntu 24.04: `sudo apt install postgresql` (bản Ubuntu cũ hơn dùng kho apt.postgresql.org); Windows: bộ cài chính thức của PostgreSQL; macOS: Postgres.app hoặc `brew install postgresql@16` |

PostgreSQL chạy như dịch vụ của hệ điều hành và tự khởi động cùng máy, không cần bật lại mỗi lần demo.

**Bước 1: Tạo cơ sở dữ liệu (làm một lần)**

Tệp `scripts/setup-db.sql` tạo user `lotrinh` (mật khẩu `lotrinh`), cơ sở dữ liệu `lotrinh` cho demo và `lotrinh_test` cho kiểm thử API, đặt múi giờ `Asia/Ho_Chi_Minh`. Chạy lại không lỗi (bỏ qua phần đã tạo).

Chạy bằng tài khoản quản trị PostgreSQL:

```bash
# Ubuntu
sudo -u postgres psql -f scripts/setup-db.sql
# macOS (Homebrew, Postgres.app)
psql -d postgres -f scripts/setup-db.sql
# Windows: mở "SQL Shell (psql)", đăng nhập user postgres, rồi gõ
#   \i 'C:/duong-dan/upharma-lo-trinh/scripts/setup-db.sql'
```

**Bước 2: Cài đặt và chạy**

```bash
git clone <địa chỉ repo> upharma-lo-trinh
cd upharma-lo-trinh
cp .env.example .env
pnpm install
pnpm build        # build gói shared, API và giao diện Vue
pnpm start        # chạy API, phục vụ luôn giao diện
# Mở http://localhost:3000
```

Lần chạy đầu, API tự chạy migration và nạp dữ liệu mẫu nếu cơ sở dữ liệu còn trống. Giữ cửa sổ terminal mở trong suốt buổi demo.

| Việc | Lệnh |
|---|---|
| Dừng ứng dụng, giữ dữ liệu | `Ctrl+C` trong cửa sổ đang chạy `pnpm start` |
| Xóa sạch, nạp lại dữ liệu mẫu | `pnpm db:reset` (hoặc nút trong Công cụ demo) |
| Chạy Mailpit (tùy chọn) | Tải file chạy Mailpit cho hệ điều hành, chạy `mailpit`, đặt `SMTP_URL=smtp://localhost:1025` trong `.env` |
| Sao lưu nhanh | `pg_dump -h localhost -U lotrinh lotrinh > backup.sql` |
| Khôi phục bản sao lưu | `psql -h localhost -U lotrinh lotrinh < backup.sql` |

**Chế độ phát triển (cho lập trình viên)**

```bash
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev          # web: http://localhost:5173 (tự chuyển /api sang cổng 3000); API tự nạp lại khi sửa mã
```

Các lệnh `pnpm` khai báo trong `package.json` gốc và viết bằng Node.js, để chạy giống nhau trên Windows, macOS và Ubuntu (không dùng lệnh shell riêng của từng hệ điều hành).

**Biến môi trường (.env)**

| Biến | Giá trị mẫu | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | `postgres://lotrinh:lotrinh@localhost:5432/lotrinh` | Kết nối PostgreSQL cài trên máy |
| `PORT` | `3000` | Cổng API và giao diện |
| `JWT_SECRET` | chuỗi ngẫu nhiên | Ký phiên đăng nhập |
| `TZ` | `Asia/Ho_Chi_Minh` | Múi giờ tính ngày |
| `DEMO_MODE` | `true` | Bật đăng nhập nhanh, ngày giả lập, Công cụ demo |
| `STORAGE_DIR` | `./storage` | Thư mục lưu tệp |
| `SMTP_URL` | để trống, hoặc `smtp://localhost:1025` | Trống thì chỉ thông báo trong ứng dụng |

Xem giao diện điện thoại: dùng chế độ thiết bị trong DevTools của trình duyệt. Nếu muốn mở bằng điện thoại thật cùng mạng Wi-Fi, truy cập `http://<IP máy demo>:3000` và mở cổng 3000 trên tường lửa của máy (tùy chọn, không bắt buộc).

### 14.7 Công cụ demo (chỉ khi `DEMO_MODE=true`)

| Công cụ | Mô tả |
|---|---|
| Đăng nhập nhanh | Màn đăng nhập hiện danh sách tài khoản mẫu theo vai trò, bấm một lần là vào. Thanh trên cùng có nút đổi nhanh sang tài khoản khác (giống bộ chọn vai trò của N3) |
| Ngày giả lập | BP ĐT đặt "Hôm nay" (ví dụ 19/10/2026), có nút −1 ngày, +1 ngày, +1 tuần, Về ngày thật. Mọi phép tính ở server lấy ngày từ `ClockService`. Khi đang giả lập, thanh trên cùng hiện dải màu cảnh báo "Đang giả lập ngày dd/mm/yyyy" |
| Chạy job ngay | Nút chạy bản tin sáng, cảnh báo leo thang, kích hoạt phiên bản theo ngày hiệu lực. Khi đổi ngày giả lập, hệ thống tự chạy kích hoạt phiên bản và tính lại cảnh báo |
| Giả lập tích hợp | Đầu việc nguồn LMS có nút "LMS báo hoàn thành"; doanh số nhập tay thay cho POS |
| Hộp thư thông báo | Chuông thông báo và trang Thông báo cho từng người; nếu bật Mailpit thì xem được email bản tin thật |
| Khôi phục dữ liệu mẫu | Xóa dữ liệu, nạp lại bộ mẫu, đặt lại ngày thật |

Ngày giả lập lưu trong bảng `system_settings` và áp dụng cho mọi người dùng trên máy demo. Khi `DEMO_MODE=false`, toàn bộ công cụ này bị tắt ở cả giao diện lẫn API.

### 14.8 Xác thực và phân quyền

- Đăng nhập bằng email + mật khẩu (băm bcryptjs). Phiên đăng nhập là JWT trong cookie `httpOnly`, hạn 12 giờ.
- Luồng đăng ký, chờ duyệt, BP ĐT duyệt (mục 5.1) vẫn giữ để trình diễn.
- Phân quyền giữ đủ, thực hiện ở backend theo thứ tự:
  1. `AuthGuard`: kiểm tra phiên, tài khoản phải đang Hoạt động.
  2. `AbilityGuard` (CASL): kiểm tra hành động theo ma trận mục 3.3.
  3. Bộ lọc phạm vi ở tầng truy vấn: mọi danh sách đều đi qua `scopeFilter(user)`.
  4. Kiểm tra theo bản ghi khi ghi: ví dụ xác nhận vai trò Buddy thì người gọi phải là Buddy hiện tại của lượt, hoặc CHT xác nhận thay theo R06.
- Ở tầng cơ sở dữ liệu: trigger chặn sửa và xóa nội dung phiên bản đã ban hành (R03); `audit_logs` được ghi cho mọi thao tác thay đổi dữ liệu.

### 14.9 Nguyên tắc xử lý dữ liệu

| Vấn đề | Cách xử lý |
|---|---|
| Kiểu ngày | Ngày nghiệp vụ lưu kiểu `date`, thời điểm thao tác lưu `timestamptz`. Mọi phép tính ngày dùng múi giờ Asia/Ho_Chi_Minh và lấy "hôm nay" từ `ClockService` |
| Transaction | Tạo lượt Level, ban hành phiên bản, chuyển phiên bản, ký bước cuối phiếu (lên Level) chạy trong một transaction |
| Ghi đồng thời | Ràng buộc duy nhất `(task_id, role)` cho xác nhận còn hiệu lực; cột `row_version` để chống ghi đè, giao diện báo "Dữ liệu vừa được người khác cập nhật, tải lại" |
| Job chạy lại | Mỗi job có khóa chống trùng (ví dụ `digest:{user_id}:{ngày}`), chạy lại không tạo thông báo trùng |
| Phiên bản bất biến | Nội dung lưu theo các bảng `v_*` (mục 13.2), kèm ảnh chụp JSON toàn bộ bản tại thời điểm ban hành |
| Xóa dữ liệu | Không xóa vật lý dữ liệu nghiệp vụ; dùng trạng thái hoặc `deleted_at` (R21). Riêng "Khôi phục dữ liệu mẫu" được xóa sạch |

### 14.10 API

REST, tiền tố `/api/v1`, JSON. Lỗi trả về dạng `{ code, message }` với thông báo tiếng Việt.

| Phương thức | Đường dẫn | Mục đích |
|---|---|---|
| POST | `/auth/login`, `/auth/logout`, `/auth/register` | Xác thực, đăng ký |
| GET, PATCH | `/users`, `/users/{id}` | Danh sách, cập nhật vai trò, phạm vi, trạng thái |
| POST | `/users/{id}/approve`, `/users/{id}/reject`, `/users/{id}/handover` | Duyệt, từ chối, chuyển giao |
| GET, POST | `/versions` | Danh sách, tạo bản nháp từ một bản |
| GET, PUT | `/versions/{id}/content` | Đọc, lưu nội dung bản nháp |
| GET | `/versions/{id}/validation` | Kết quả kiểm tra hợp lệ |
| POST | `/versions/{id}/submit`, `/withdraw`, `/approve`, `/reject` | Vòng đời phiên bản |
| POST | `/versions/{id}/import-excel` ; GET `/versions/{id}/export?format=xlsx\|json` | Nhập, xuất |
| POST | `/migrations/preview`, `/migrations` | Xem trước tác động, chạy chuyển phiên bản |
| GET, POST, PATCH | `/staff`, `/staff/{id}` | Hồ sơ NV |
| POST | `/staff/{id}/runs` | Bắt đầu lượt Level |
| POST | `/runs/{id}/ack`, `/runs/{id}/pauses`, `/runs/{id}/assignments` | Xác nhận đã đọc, tạm dừng, đổi Buddy/CHT/QLKV |
| GET | `/runs/{id}/tasks` | Checklist của lượt, kèm trạng thái tính sẵn |
| POST | `/tasks/{id}/confirm`, `/undo`, `/rework`, `/status` | Xác nhận, hủy, yêu cầu làm lại, đổi trạng thái |
| POST | `/runs/{id}/stages/{stageKey}/sign` | Ký cuối giai đoạn |
| GET | `/me/today`, `/me/inbox`, `/me/notifications` | Hôm nay, Việc cần xử lý, Thông báo |
| PUT | `/runs/{id}/sales/{month}` | Ghi doanh số tháng |
| POST | `/runs/{id}/observations`, `/runs/{id}/buddy-score` | Rubric, Buddy Score |
| GET, PUT | `/runs/{id}/review` ; POST `/runs/{id}/review/sign` | Phiếu đánh giá và chuỗi ký |
| GET | `/alerts`, `/reports/progress.csv`, `/audit-logs` | Cảnh báo, xuất CSV, nhật ký |
| GET, PUT | `/demo/clock` | Đọc, đặt ngày giả lập (demo) |
| POST | `/demo/jobs/{name}/run`, `/demo/reset` | Chạy job ngay, khôi phục dữ liệu mẫu (demo) |
| GET | `/demo/accounts` | Danh sách tài khoản đăng nhập nhanh (demo) |

### 14.11 Job hằng ngày (cron trong tiến trình API)

| Job | Lịch | Việc làm |
|---|---|---|
| `version-activate` | 00:05 | Bản có ngày hiệu lực hôm nay chuyển "Đang hiệu lực", bản cũ "Hết hiệu lực" |
| `daily-digest` | 06:00 | Tạo bản tin cho từng người: việc mở, sắp đến hạn, quá hạn |
| `escalation` | 06:15 | Việc quá hạn > `escalateDays` gửi QLKV |
| `alerts-refresh` | 06:30 | Tính lại cảnh báo cho trang Cảnh báo và Nhân sự |
| `run-start-reminder` | 17:00 | Báo trước 1 ngày cho lượt Level sắp bắt đầu |

Trên máy demo thường không bật qua đêm, nên mọi job đều có nút "Chạy ngay" trong Công cụ demo. Thao tác nặng (nhập Excel, chuyển phiên bản) chạy trực tiếp trong request vì dữ liệu demo nhỏ.

### 14.12 Dữ liệu mẫu

Nạp tự động lần chạy đầu. Ngày bắt đầu Level được tính **lùi từ ngày nạp dữ liệu**, nên lúc nào demo cũng có đủ trạng thái: đang chạy, sắp đến hạn, quá hạn, sắp bắt đầu.

Mật khẩu chung cho mọi tài khoản mẫu: `Demo@123`.

| Tài khoản | Vai trò | Tình huống mẫu |
|---|---|---|
| `admin@upharma.local` | BP Đào tạo (quản trị) | Quản trị, soạn phiên bản |
| `huy@upharma.local` | QLKV khu vực Hà Nội 1, có quyền Người duyệt phiên bản | Duyệt phiên bản, nhận cảnh báo leo thang |
| `ha@upharma.local` | CHT Nhà thuốc A | |
| `binh@upharma.local` | CHT Nhà thuốc B | |
| `hung@upharma.local` | NV Level 3 (bắt đầu L3 cách đây 229 ngày), có thể làm Buddy | Vừa làm checklist L3, vừa là Buddy của Lan, Tuấn, Mai |
| `thao@upharma.local` | NV Level 3 (cách đây 199 ngày), Buddy Nhà thuốc B | Buddy của Linh |
| `lan@upharma.local` | NV Level 1, bắt đầu cách đây 26 ngày | Có mục quá hạn, có mục bị yêu cầu làm lại |
| `tuan@upharma.local` | NV Level 1, bắt đầu cách đây 9 ngày (giữa tuần) | Lịch tuần chạy từ giữa tuần |
| `mai@upharma.local` | NV Level 1, bắt đầu sau 2 ngày nữa | Việc hiện ở "Sắp mở" |
| `linh@upharma.local` | NV Level 1, bắt đầu cách đây 61 ngày | Đến kỳ phiếu đánh giá, demo chuỗi ký và lên Level |
| `nam@upharma.local` | NV Level 2, bắt đầu cách đây 138 ngày | Có doanh số và ca quan sát Rubric |
| `moi@upharma.local` | Chưa duyệt | Demo BP ĐT duyệt đăng ký |

Kèm theo: bộ lộ trình **v2.1 đang hiệu lực** (nạp từ N3, N4, N5 theo giả định mục 16) và một **bản nháp v2.2** có sẵn 2 thay đổi (bổ sung người xác nhận cho L1-1-1, sửa câu hướng dẫn một mục) để demo luồng phiên bản.

### 14.13 Kịch bản trình diễn (khoảng 15 phút)

1. **BP ĐT** đăng nhập: vào Quản trị, duyệt tài khoản đang chờ, gán vai trò và cửa hàng.
2. **BP ĐT** vào Thiết kế lộ trình: mở v2.1 xem kết quả kiểm tra; mở bản nháp v2.2 xem dải tác động "có thay đổi tiêu chí"; gửi duyệt.
3. **QLKV (Người duyệt)**: duyệt và ban hành v2.2 với ngày hiệu lực là ngày mai.
4. **BP ĐT**: thêm một NV mới bắt đầu Level 1 ngày mai, rồi tua ngày +1. NV mới được gắn v2.2; việc tuần 1 mở; Buddy Hùng thấy việc của NV mới trong hàng đợi.
5. **NV Lan** (bật chế độ điện thoại trong DevTools): báo hoàn thành một mục. **Buddy Hùng** xác nhận. **CHT Hà** yêu cầu làm lại một mục khác kèm lý do.
6. Tua ngày +7: xuất hiện mục quá hạn; chạy bản tin sáng; **QLKV** thấy cảnh báo leo thang.
7. **CHT Hà** mở hồ sơ NV Linh: điền phiếu đánh giá, ký; QLKV ký; BP ĐT ký. Linh tự chuyển sang Level 2.
8. **BP ĐT** xuất CSV tiến độ.

### 14.14 Khi chuyển sang chạy thật

| Thành phần trong demo | Thay bằng khi chạy thật |
|---|---|
| Cron trong tiến trình API | Redis + BullMQ, worker chạy riêng |
| Thư mục `./storage` | MinIO hoặc kho tệp tương thích S3 |
| Thông báo trong ứng dụng (+ Mailpit) | SMTP công ty, Zalo OA |
| `http://localhost:3000` | Máy chủ nội bộ, reverse proxy (Caddy/Nginx) có TLS |
| Chạy tay bằng `pnpm start` trong terminal | Dịch vụ hệ thống (systemd hoặc PM2) tự khởi động lại khi lỗi |
| Đăng nhập nhanh, ngày giả lập | Tắt bằng `DEMO_MODE=false` |
| JWT 12 giờ, không làm mới | Access token ngắn hạn + refresh token thu hồi được; có thể SSO |
| Một tài khoản cơ sở dữ liệu | Tách role ứng dụng và role chỉ đọc cho Metabase |
| Không sao lưu tự động | pgBackRest, diễn tập khôi phục định kỳ |
| Không giám sát | OpenTelemetry → SigNoz |
| In từ trình duyệt | Dịch vụ tạo PDF nếu cần mẫu in chuẩn |
| Dữ liệu mẫu | Nhập NV thật theo mục 19.2 |

Vì các thành phần trên đã nằm sau adapter (mục 14.1), việc chuyển đổi không ảnh hưởng mã nghiệp vụ.

Lưu ý dữ liệu: bản demo chỉ dùng dữ liệu mẫu. Không nhập thông tin nhân viên thật vào máy demo nếu máy không được bảo vệ, vì đây là dữ liệu cá nhân.

---

## 15. Thiết kế giao diện

Bám theo N3. Các giá trị dưới đây lấy trực tiếp từ CSS của N3.

### 15.1 Bảng màu

**Chế độ sáng**

| Token | Mã | Dùng cho |
|---|---|---|
| `--bg` | #F1F5F5 | Nền trang |
| `--surface` | #FFFFFF | Thẻ, bảng, thanh trên |
| `--surface2` | #F6F9F9 | Nền phụ: tiêu đề giai đoạn, vùng mở rộng |
| `--ink` | #13272B | Chữ chính |
| `--mut` | #5A6F73 | Chữ phụ |
| `--line` | #DAE3E4 | Viền, đường kẻ |
| `--accent` | #0A7B67 | Màu nhấn: nút chính, tab đang chọn, thanh tiến độ, logo |
| `--accent-ink` | #FFFFFF | Chữ trên nền nhấn |
| `--soft` | #DFF1EC | Nền nhấn nhẹ: giai đoạn hiện tại, Level hiện tại |
| `--ok` / `--ok-bg` | #1C7C4B / #E1F4EA | Hoàn thành, đạt |
| `--warn` / `--warn-bg` | #9A6200 / #FFF1D4 | Sắp đến hạn, cảnh báo vàng |
| `--bad` / `--bad-bg` | #B93A27 / #FCE8E4 | Trễ hạn, cảnh báo đỏ, GPP, nút hủy |
| `--info` / `--info-bg` | #245AA8 / #E3EDFA | Thông tin, chờ xác nhận, nhãn Level |

**Màu vai trò**

| Vai trò | Chữ | Nền |
|---|---|---|
| NV | #6B4FB3 | #EEE8FA |
| Buddy | #0A7B67 | #DFF1EC |
| CHT | #245AA8 | #E3EDFA |
| QLKV | #9A6200 | #FFF1D4 |
| BP ĐT | #B93A27 | #FCE8E4 |

**Chế độ tối** (bắt buộc hỗ trợ, theo `prefers-color-scheme` và cho phép chọn tay):

| Token | Mã |
|---|---|
| `--bg` / `--surface` / `--surface2` | #0D1A1C / #142326 / #102022 |
| `--ink` / `--mut` / `--line` | #E5EFEF / #91A7AA / #26393C |
| `--accent` / `--accent-ink` / `--soft` | #3FC3A6 / #06211B / #14352F |
| `--ok` / `--ok-bg` | #55CF92 / #12331F |
| `--warn` / `--warn-bg` | #F0B84F / #3A2D0E |
| `--bad` / `--bad-bg` | #FF8A76 / #40201B |
| `--info` / `--info-bg` | #7FB0F0 / #162C4A |
| Vai trò NV / Buddy / CHT / QLKV / BP ĐT (chữ) | #B7A2F2 / #3FC3A6 / #7FB0F0 / #F0B84F / #FF8A76 |
| Vai trò (nền) | #2A2147 / #14352F / #162C4A / #3A2D0E / #40201B |

**Màu Level** (bổ sung cho thang thời gian trong màn hình soạn thảo; cần thống nhất với bộ nhận diện):

| Level | Màu |
|---|---|
| L1 | #F2B200 (chữ #3A2C00) |
| L2 | #E2674F |
| L3 | #1E3A8A (tối: #6F8FE8) |
| L4 | #2E8B66 (tối: #45B08A) |

### 15.2 Chữ

| Thành phần | Quy cách |
|---|---|
| Họ chữ chính | Be Vietnam Pro 400, 500, 600, 700, 800; dự phòng system-ui |
| Chữ đơn cách | IBM Plex Mono 400, 500, chỉ dùng cho số thứ tự, điểm Rubric |
| Nội dung | 14 px, line-height 1.5 |
| Tiêu đề trang (`.h1`) | 22 px, 800, letter-spacing −0.02em |
| Tiêu đề khối (`.h2`) | 16 px, 700 |
| Chữ phụ (`.sm`) | 12,5 px |
| Số thống kê (`.stat b`) | 26 px, 800, chữ số đều (tabular-nums) |
| Nhãn nhóm (`.sec`) | 12 px, 700, chữ hoa, giãn 0.06em |

### 15.3 Thành phần giao diện

| Thành phần | Quy cách (N3) |
|---|---|
| Thẻ (`.card`) | Nền surface, viền 1 px line, bo góc 12 px, đệm 16 px |
| Nút (`.btn`) | Bo 8 px, đệm 7×12, chữ 600; hover đổi viền sang màu nhấn. Biến thể: chính (nền nhấn), nguy hiểm (chữ và viền đỏ), nhỏ (4×9, 12,5 px), vô hiệu (mờ 45%) |
| Nhãn trạng thái (`.pill`) | Bo tròn, 12 px, 600; biến thể ok / warn / bad / info |
| Chip vai trò (`.rl`) | Bo 5 px, 11,5 px, 700, màu theo vai trò; chưa xác nhận: viền đứt, nền trong suốt; đã xác nhận: thêm dấu ✓ |
| Tab chính | Chữ 600 màu phụ, tab chọn màu nhấn + gạch chân 2 px; badge đỏ bo tròn |
| Tab phụ (`.sub`) | Nút bo tròn, tab chọn nền ink chữ bg |
| Ô thống kê (`.stat`) | Số lớn + nhãn nhỏ, lưới tự co 150 px |
| Thanh tiến độ (`.bar`) | Cao 6 px, bo 4 px, phần đã xong màu nhấn |
| Ô trạng thái đầu việc (`.chk`) | 20×20, bo 6 px: xong = nền ok + ✓; đang làm = viền và nền warn + "…"; trễ = viền bad |
| Thanh lộ trình (`.path`) | 4 cột tỉ lệ 1 : 1,3 : 1,6 : 1,6; Level đã qua nền ok-bg; hiện tại nền soft viền nhấn |
| Thông báo (`.alert`) | Nền warn-bg; biến thể đỏ bad-bg; xanh ok-bg; thông tin info-bg |
| Trống (`.empty`) | Căn giữa, tiêu đề + mô tả hướng dẫn hành động tiếp theo |
| Toast | Đáy giữa màn hình, nền ink, bo tròn, tự ẩn sau 2,6 giây |
| Đầu việc GPP (`.gpp`) | Viền trái 3 px màu bad |

### 15.4 Bố cục và responsive

- Khung rộng tối đa 1120 px, đệm ngang 16 px; màn hình soạn thảo BP ĐT rộng tối đa 1440 px, có cột trái 240 px.
- Điện thoại (≤ 620 px): thanh lộ trình 2 cột; bảng checklist chuyển thành thẻ có nhãn từng ô; tab cuộn ngang.
- Màn hình hẹp (≤ 960 px) trong khu soạn thảo: cột phiên bản chuyển thành dải cuộn ngang phía trên.
- Hỗ trợ vùng an toàn của điện thoại (`env(safe-area-inset-*)`).
- Ưu tiên thiết kế cho điện thoại với NV và Buddy (đứng quầy), cho máy tính với BP ĐT.

### 15.5 Khả năng tiếp cận

- Viền tập trung bàn phím 2 px màu nhấn trên mọi phần tử tương tác.
- Dòng đầu việc mở rộng được bằng Enter / Space, có `aria-expanded`.
- Không truyền đạt trạng thái chỉ bằng màu: luôn kèm chữ hoặc ký hiệu (✓, !, "Trễ 3 ngày").
- Tương phản chữ đạt chuẩn WCAG AA ở cả hai chế độ.

### 15.6 Khung màn hình chính

**Hôm nay (NV, điện thoại)**

```
┌───────────────────────────────┐
│ [U] Lộ trình Upharma     Lan ▾│
│ Hôm nay | Lộ trình của tôi    │
├───────────────────────────────┤
│ Chào Lan, hôm nay 17/10   45% │
│ Level 1 · ngày 27/60 · Tuần 4 │
│ ▓▓▓▓▓▓▓░░░░░░░  27/60 mục     │
│ [L1 hiện tại][L2][L3][L4]     │
├───────────────────────────────┤
│ ! 1 mục bị yêu cầu làm lại    │
│ ! 2 việc đã quá hạn           │
├───────────────────────────────┤
│ QUÁ HẠN · 2                   │
│ ☐ Thực hành 5 GD có Rubric    │
│   [NV][Buddy] Kỹ năng BH Trễ 3│
│ HÔM NAY VÀ 3 NGÀY TỚI · 3     │
│ ...                           │
└───────────────────────────────┘
```

**Việc cần xử lý (CHT, máy tính)**

```
┌──────────────────────────────────────────────────────────────┐
│ [U] Lộ trình Upharma                       Phạm Thu Hà (CHT) │
│ Việc cần xử lý (5) | Nhân sự | Cảnh báo (2) | Khung năng lực │
├──────────────────────────────────────────────────────────────┤
│ [ 3 Đang chờ bạn ][ 2 Quá hạn ][ 7 Trong 7 ngày ][ 6 Nhân sự ]│
│                                                              │
│ Nguyễn Thị Lan  L1  Nhà thuốc A                 [Mở hồ sơ]   │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ☐ DS tổng ≥ 30tr tháng 1   [NV✓][CHT]  Chờ CHT  Hạn 20/10│ │
│ │ ☐ Ký cuối giai đoạn 3      Chờ bạn ký                    │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Thiết kế lộ trình (BP ĐT)**

```
┌───────────┬──────────────────────────────────────────────────┐
│ Phiên bản │ Bộ lộ trình v2.2  [Bản nháp]   [Xóa] [Gửi duyệt] │
│ ○ v2.2 Nh │ Có 3 thay đổi tiêu chí: chỉ áp dụng lượt Level mới│
│ ● v2.1 HL │ Ghi chú thay đổi: [..............................]│
│           │ ┌ Kiểm tra trước khi gửi duyệt  1 lỗi  4 lưu ý ─┐ │
│           │ │ L1-1-1 chưa chọn người xác nhận               │ │
│           │ └───────────────────────────────────────────────┘ │
│           │ Khung NL | Checklist | Phiếu | Thiết lập | Xem    │
│           │ trước | Chuyển phiên bản                         │
│           │ [L1 60][L2 31][L3 24][L4 23]                     │
│           │ ███1███2███3███4████5████6███ | Hết Level        │
│           │ ┌ 1  Tuần 1: Định hướng…  ngày 0–7  Ký: CHT ┐   │
│           │ │ L1-1-1  Nội dung… | Hướng dẫn…    ↑ ↓ ×  │   │
│           │ │ Nhóm [..] Xác nhận [NV][Buddy] Hạn ngày 1 │   │
│           │ └───────────────────────────────────────────┘   │
└───────────┴──────────────────────────────────────────────────┘
```

**Quản trị: Tài khoản và vai trò**

```
┌──────────────────────────────────────────────────────────────┐
│ ! 3 tài khoản đang chờ duyệt                    [Xem hàng chờ]│
│ [Tìm..] [Vai trò▾] [Khu vực▾] [Cửa hàng▾] [Trạng thái▾]       │
│                                [+ Tạo tài khoản] [Nhập CSV]  │
│ Họ tên        Vai trò  Phạm vi       Quyền thêm  Trạng thái   │
│ Trần Văn Hùng [NV]     Nhà thuốc A   [Buddy]     Hoạt động [Sửa]│
│ Ngô Quang Huy [QLKV]   Khu vực HN1   [Duyệt PB]  Hoạt động [Sửa]│
│ Bùi Thị Hạnh  [NV]     Nhà thuốc B               Chờ duyệt [Duyệt]│
└──────────────────────────────────────────────────────────────┘
```

### 15.7 Văn phong giao diện

- Câu ngắn, động từ rõ: "Xác nhận đạt", "Tôi đã làm xong", "Yêu cầu làm lại", "Gửi duyệt", "Duyệt và ban hành".
- Tên hành động giữ nguyên trong cả luồng: nút "Ký xác nhận" thì thông báo là "Đã ký".
- Thông báo lỗi nêu rõ cách sửa, không xin lỗi chung chung. Ví dụ: "Nhập lý do vào ô ghi chú trước khi yêu cầu làm lại".
- Trạng thái trống luôn chỉ ra việc tiếp theo. Ví dụ: "Chưa có nhân sự nào. Bấm 'Thêm nhân viên' để tạo hồ sơ và bắt đầu lộ trình Level 1".

---

## 16. Vấn đề mở cần BP Đào tạo chốt

Các điểm dưới đây là mâu thuẫn giữa N1, N2 và N3. Đội phát triển có thể bắt đầu theo **giả định mặc định**, nhưng dữ liệu khởi tạo chỉ chốt khi BP ĐT xác nhận.

| Mã | Vấn đề | N1 (Word) | N2 (Excel) | N3 (UI) | Giả định mặc định |
|---|---|---|---|---|---|
| V1 | Thời gian Level 1 | 0–2 tháng | 12 tuần, ca 1–72; mục #52–54 nhắc "Tháng 3"; phiếu ghi "kết thúc 3 tháng" | 60 ngày, 6 giai đoạn nén lại | 60 ngày theo N3; sửa câu chữ các mục nhắc tháng 3 |
| V2 | Bắt đầu Level 2 | Tháng 4 | Tháng 3 | Tháng 4–12 (274 ngày) | Theo N3 |
| V3 | Quan sát Rubric | 3 ca/tháng, "80% = 8/10 lần" | 2 ca/tuần, 10 ca; mục #35 "≥ 80% (≥ 3 lần)" nhưng hướng dẫn "≥ 4/5 lần" | Mục tiêu ≥ 80% khi có ≥ 3 ca | Tỉ lệ % trên số ca thực tế, tối thiểu 3 ca/tháng |
| V4 | Thang điểm bài thu hoạch | ≥ 6/10 | ≥ 60/100; phiếu L3 ghi "≥ 6 điểm" | | Lưu dạng % (≥ 60%) |
| V5 | KPI Level 3 | ≥ 9/12 tháng đạt ngưỡng cửa hàng | ≥ 4/6 tháng (T16–21) và không tháng nào dưới ngưỡng (T22–24) | | Cần BP ĐT chọn |
| V6 | Cảnh báo GPP | 30 ngày | 3 ngày làm việc | 3 ngày | 3 ngày |
| V7 | Chuỗi duyệt lên L2 | Buddy → BP ĐT | Buddy điền, CHT ký | CHT → QLKV → BP ĐT → NV | Theo N3 cho mọi Level, cấu hình được |
| V8 | Tháng KPI: tháng của Level hay tháng lịch | | Miễn tháng đầu nếu vào từ ngày 15 | Nhập theo tháng của Level | Theo tháng của Level, CHT nhập số liệu tương ứng; chốt lại khi tích hợp POS |
| V9 | Ngày bắt đầu Level mới | | | Ngày BP ĐT ký phiếu | Theo N3 |
| V10 | Ký cuối giai đoạn | | Buddy/CHT + QLKV + NV ký từng giai đoạn | Chỉ CHT duyệt | Cấu hình được; dữ liệu khởi tạo theo N3 (CHT) |
| V11 | Đầu việc thiếu người xác nhận | | L1 #1 "Nhận việc" để trống | N3 gán Buddy | Buddy |
| V12 | Nội dung sai Level | | L4 #7 "bài thu hoạch SKU Level 3" | | Sửa thành Level 4 |
| V13 | Phiếu L4 | | Không có lựa chọn kết quả | "Đạt chuẩn Level 4 / Gia hạn" | Theo N3 |
| V14 | Gia hạn L2–L4 | | Không ghi thời gian, số lần | Tối đa 2 lần, 1 tháng (áp dụng chung) | Theo N3 |
| V15 | Số SKU Level 2 | 98 | 98 trong đầu việc, 107 trong mục tiêu giai đoạn | | 98 |
| V16 | Phiên bản file Excel | | Tên file v2.1, tiêu đề trong file v2.0 | | Coi là v2.1 |
| V17 | Tuần theo ngày lịch hay theo ca thực tế | | Tuần 1 = Ca 1–6 | Theo ngày | Theo ngày; số ca chỉ để tham khảo |
| V18 | Ngày lễ, Tết | | | | Không tự dời; dùng tạm dừng. Giai đoạn 2 xem xét lịch ngày nghỉ |
| V19 | Hệ thống "web member" | | Checklist L3 nhắc đăng ký, xác nhận trên web member | | Cần xác nhận có tích hợp hay thay thế |
| V20 | Ai được ban hành phiên bản | | | | Người có quyền "Người duyệt phiên bản"; cho phép cấu hình để BP ĐT tự ban hành |

---

## 17. Yêu cầu phi chức năng (bản demo)

| Nhóm | Yêu cầu |
|---|---|
| Cài đặt | Từ máy đã cài Node.js, pnpm và PostgreSQL 16, chạy được trong dưới 10 phút bằng các lệnh mục 14.6; không dùng Docker |
| Hiệu năng | Với dữ liệu mẫu, mọi trang tải dưới 1 giây trên máy demo |
| Quy mô | Mô hình dữ liệu vẫn thiết kế cho 2.000 NV, 300 cửa hàng; bản demo không kiểm thử tải |
| Bảo mật | Chỉ chạy trên máy cục bộ, không mở ra internet; dữ liệu mẫu; phân quyền và phạm vi vẫn kiểm tra ở backend (mục 14.8) |
| Lưu vết | Mọi thay đổi dữ liệu ghi `audit_logs` |
| Sao lưu | Không bắt buộc; có lệnh `pg_dump` khi cần giữ lại trạng thái demo |
| Trình duyệt | Chrome, Edge bản mới nhất; giao diện điện thoại kiểm tra bằng chế độ thiết bị của DevTools |
| Ngôn ngữ | Tiếng Việt; định dạng ngày dd/mm/yyyy; số theo vi-VN |
| Múi giờ | Asia/Ho_Chi_Minh cho mọi phép tính ngày |
| Truy cập | Hướng tới WCAG 2.1 AA (viền tập trung, nhãn, tương phản); không yêu cầu kiểm định ở bản demo |

Yêu cầu cho bản chạy thật (sẵn sàng 99,5%, sao lưu hằng ngày, lưu hồ sơ 5 năm, HTTPS) áp dụng khi chuyển đổi theo mục 14.14.

---

## 18. Tích hợp

Bản demo **không tích hợp hệ thống nào**. LMS được giả lập bằng nút "LMS báo hoàn thành", doanh số nhập tay thay POS (mục 14.7). Bảng dưới là lộ trình tích hợp khi chạy thật.

| Hệ thống | Giai đoạn | Nội dung |
|---|---|---|
| Xác thực | Demo đã có | Email + mật khẩu; khi chạy thật bổ sung refresh token và có thể SSO (mục 14.14) |
| Email / Zalo OA | Chạy thật | Bản tin sáng, thông báo tức thời (demo: trong ứng dụng, Mailpit) |
| n8n (sẵn có) | 2–3 | Không nằm trong luồng chính. Dùng cho luồng tích hợp phụ, gọi API của backend (ví dụ nhận file doanh số) |
| Metabase (sẵn có) | 2 | Báo cáo: tỉ lệ hoàn thành theo cửa hàng, tỉ lệ chuyển Level so với mục tiêu, trễ hạn theo đầu việc qua các phiên bản |
| Dữ liệu nhân sự | 2 | Lấy ngày nhận việc, cửa hàng, nghỉ việc |
| LMS | 2 | Trạng thái hoàn thành module, điểm quiz cho đầu việc nguồn LMS |
| POS | 3 | Doanh số tháng theo NV, DS HS1 |
| Chấm công | 3 | Số ca thực tế cho Level 1 |
| Web member | Cần xác nhận (V19) | Quan hệ kèm cặp, kết quả Buddy |

API nội bộ tối thiểu cần có để các job và tích hợp gọi vào: lấy danh sách việc đến hạn theo ngày; ghi nhận xác nhận từ nguồn LMS/POS; ghi doanh số tháng; lấy bản tin cho một người dùng.

---

## 19. Dữ liệu khởi tạo và chuyển đổi

### 19.1 Phiên bản khởi tạo v2.1

- Nạp từ N1 và N2 theo các giả định ở mục 16. Đã có sẵn dữ liệu đã bóc tách (JSON) từ các bản thử nghiệm N4, N5 và trong N3 (`LEVELS`, `OV`), đội phát triển dùng làm nguồn.
- Mã đầu việc dùng theo N3 (`L{level}-{giai đoạn}-{thứ tự}`, ví dụ `L1-1-5`) và giữ cố định từ đây. Lưu kèm số thứ tự gốc trong Excel ở trường `source_ref` để đối chiếu, vì Excel có số trùng (#32) và số thiếu (L3 không có #4, #5).
- BP ĐT rà soát trên màn hình Thiết kế lộ trình rồi ban hành v2.1 làm bản đầu tiên.
- Bản demo nạp sẵn v2.1 cùng bộ tài khoản, nhân viên mẫu theo mục 14.12.

### 19.2 Nhân viên đang làm việc (khi chạy thật)

1. Nhập tài khoản và hồ sơ NV hàng loạt.
2. Tạo lượt Level với ngày bắt đầu thực tế trong quá khứ, gắn v2.1.
3. Các mục đã xong trên file Excel được nhập với xác nhận nguồn "Ghi nhận từ hồ sơ cũ" (lưu người nhập, ngày nhập, `on_behalf_of_role`), phân biệt rõ với xác nhận phát sinh trong hệ thống.
4. Không gửi thông báo quá hạn cho các mục trước ngày đưa vào sử dụng trong 7 ngày đầu.

### 19.3 Thí điểm (khi chạy thật)

Theo N1 mục F.1: chạy 1 cửa hàng có NV mới trong 1 tháng trước khi mở toàn chuỗi.

---

## 20. Kịch bản kiểm thử nghiệm thu

Trên bản demo, các kịch bản liên quan đến ngày thực hiện bằng công cụ ngày giả lập (mục 14.7).

### 20.1 Tính lịch

Giả định cấu hình L1 theo N3: giai đoạn 1 [0, 7], giai đoạn 4 [21, 30], giai đoạn 6 [45, 60].

| Mã | Đầu vào | Kết quả mong đợi |
|---|---|---|
| T-L01 | NV A bắt đầu L1 ngày 08/10/2026 (thứ năm); đầu việc L1-1-1 có d = 1 | Hạn 09/10/2026 |
| T-L02 | Như trên, giai đoạn 1 | Hiển thị 08/10 → 15/10 |
| T-L03 | NV B bắt đầu 21/09/2026; hôm nay 17/10 | Ngày thứ 27/60; giai đoạn hiện tại là giai đoạn 4 (ngày 21–30) |
| T-L04 | NV C bắt đầu 19/10; hôm nay 17/10 | Hôm nay hiện "Lộ trình Level 1 bắt đầu ngày 19/10 (còn 2 ngày)"; Buddy thấy việc của C trong "Sắp mở" |
| T-L05 | NV A tạm dừng 01/11–10/11 | Mọi mốc chưa xong từ 01/11 lùi 10 ngày; `task_date_changes` có bản ghi |
| T-L06 | Đầu việc POS hạn 07/11, posDataDay = 5 | Trạng thái "Chờ số liệu POS" tới 05/12 |
| T-L07 | Hôm nay = hạn − 3 | Trạng thái "Còn 3 ngày", có trong bản tin sáng |
| T-L08 | Quá hạn 8 ngày | QLKV thấy trong "Cảnh báo trong khu vực" |

### 20.2 Xác nhận

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| T-X01 | NV bấm "Tôi đã làm xong" mục Buddy | Mục chuyển "Đang thực hiện", chip NV ✓; Buddy thấy ở đầu hàng đợi |
| T-X02 | Buddy xác nhận | Mục "Xong", ngày hoàn thành = ngày Buddy xác nhận |
| T-X03 | CHT yêu cầu làm lại không nhập lý do | Bị chặn, thông báo yêu cầu nhập lý do |
| T-X04 | CHT yêu cầu làm lại có lý do | Mọi xác nhận bị xóa, NV thấy cảnh báo đỏ kèm lý do |
| T-X05 | NV có tài khoản; Buddy cố xác nhận phần NV | Không có nút |
| T-X06 | Mục phối hợp L2 (CHT + QLKV); CHT xác nhận | Hiện "Chờ QLKV" |
| T-X07 | Đánh N/A mục GPP | Không có lựa chọn N/A |
| T-X08 | Cấu hình L1-2-1, L1-2-2, L1-2-3 phụ thuộc L1-2-9 (theo ghi chú Excel #22: "Đạt mới được tick mục an toàn thuốc tuần này"); L1-2-9 chưa xong | Ba mục bị khóa, hiện "Chờ L1-2-9" |
| T-X09 | Ký cuối giai đoạn khi còn mục bắt buộc chưa xong | Không ký được, hiện "Còn N mục bắt buộc chưa xong" |

### 20.3 Phiên bản

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| T-V01 | Tạo nháp từ v2.1, chỉ sửa hướng dẫn 1 mục | Dải tác động "Chỉ sửa diễn đạt"; khi ban hành số là 2.1.1; NV đang chạy v2.1 thấy câu mới |
| T-V02 | Tạo nháp, đổi hạn 1 mục | Số đề xuất 2.2; NV đang chạy v2.1 không thấy thay đổi; NV bắt đầu sau ngày hiệu lực nhận 2.2 |
| T-V03 | Gửi duyệt khi còn lỗi | Bị chặn, khung kiểm tra cuộn vào giữa màn hình |
| T-V04 | Duyệt với ngày hiệu lực 01/11 | v2.1 hết hiệu lực ngày 31/10; lượt bắt đầu 31/10 nhận v2.1, lượt bắt đầu 01/11 nhận v2.2 |
| T-V05 | Chuyển phiên bản 5 NV sang 2.2 | Xem trước đúng số mục thêm/bỏ; mục mới đã quá hạn được đặt hạn = ngày chuyển + 14 |
| T-V06 | Sửa bản đang hiệu lực qua API | Bị từ chối |

### 20.4 Quản trị người dùng

| Mã | Kịch bản | Kết quả mong đợi |
|---|---|---|
| T-U01 | Người dùng mới đăng ký | Thấy "Đang chờ duyệt"; BP ĐT nhận thông báo |
| T-U02 | BP ĐT từ chối không nhập lý do | Bị chặn |
| T-U03 | Hạ quyền BP ĐT cuối cùng | Bị chặn |
| T-U04 | Khóa tài khoản đang là Buddy của 3 NV | Hiện màn hình chuyển giao, bắt buộc chọn người thay |
| T-U05 | CHT cửa hàng A gọi API lấy hồ sơ NV cửa hàng B | Bị từ chối ở máy chủ |
| T-U06 | Đổi vai trò NV sang CHT | Tab hiển thị đúng vai trò mới sau khi tải lại; có bản ghi `user_changes` |

---

## 21. Kế hoạch triển khai theo giai đoạn

| Giai đoạn | Nội dung | Ước lượng (1–2 lập trình viên quen stack) | Điều kiện bắt đầu |
|---|---|---|---|
| 0. Chốt tối thiểu | BP ĐT chốt V1, V2, V7 (ảnh hưởng trực tiếp dữ liệu mẫu); các vấn đề khác dùng giả định mặc định mục 16 | Vài ngày | Ngay |
| 1. Demo vòng 1 | Khung dự án, script cài đặt chạy local (PostgreSQL cài trên máy, `pnpm start`), seed v2.1 và dữ liệu mẫu; đăng nhập, đăng nhập nhanh; quản trị người dùng, vai trò, phạm vi; hồ sơ NV, lượt Level, tính lịch, ngày giả lập; Hôm nay, Việc cần xử lý, Hồ sơ NV, Checklist, xác nhận hai phía; Cảnh báo; thông báo trong ứng dụng | 3–4 tuần | Xong giai đoạn 0 |
| 2. Demo vòng 2 | Thiết kế lộ trình (soạn Khung năng lực, Checklist, phiếu), kiểm tra hợp lệ, vòng đời phiên bản, chuyển phiên bản; Doanh số, Rubric, Buddy Score, phiếu đánh giá, lên Level, gia hạn; nhập/xuất Excel, CSV | 3–4 tuần | BP ĐT góp ý xong vòng 1 |
| 3. Chạy thật | Thay hạ tầng theo mục 14.14, tích hợp mục 18, nhập NV thật, thí điểm 1 cửa hàng | Lập kế hoạch riêng | BP ĐT duyệt bản demo |

Ước lượng giả định phạm vi giữ như tài liệu này và giao diện bám theo N3; thay đổi phạm vi sau khi bắt đầu sẽ làm thay đổi ước lượng.

---

## 22. Phụ lục

### 22.1 Ánh xạ trạng thái đầu việc

| Trạng thái (N2) | Mã | Cách đạt được | Tính là hoàn thành |
|---|---|---|---|
| Chưa bắt đầu | todo | Mặc định | Không |
| Đang thực hiện | doing | Chọn tay, hoặc đã có ít nhất 1 xác nhận | Không |
| Đã hoàn thành | done | Tự động khi đủ xác nhận | Có |
| Cần hỗ trợ | help | NV chọn; bắt buộc ghi chú; báo CHT | Không |
| Bỏ qua / N-A | na | CHT/QLKV/BP ĐT chọn; bắt buộc ghi chú; không áp dụng cho GPP | Có (không tính vào tổng) |
| Không áp dụng do đổi phiên bản | void | Hệ thống, khi chuyển phiên bản | Không tính vào tổng |

### 22.2 Mẫu JSON một đầu việc (định dạng xuất / nhập)

```json
{
  "item_key": "L1-1-5",
  "level": "L1",
  "stage_key": "L1-S1",
  "order": 5,
  "category": "GPP",
  "content": "Xem module GPP cơ bản (Quy trình bán hàng) trên LMS TRƯỚC KHI tiếp xúc khách hàng độc lập (Phụ lục B)",
  "guidance": "Buddy xác nhận với BP Đào tạo. Không được bỏ qua.",
  "verifiers": ["bp"],
  "require_nv_first": true,
  "due_offset": 3,
  "gpp": true,
  "required": true,
  "allow_na": false,
  "data_source": "lms",
  "evidence": "score",
  "depends_on": [],
  "source_ref": "Excel L1 #5"
}
```

### 22.3 Mẫu JSON một giai đoạn

```json
{
  "stage_key": "L1-S1",
  "level": "L1",
  "order": 1,
  "name": "Định hướng & Làm quen môi trường",
  "label": "Tuần 1",
  "offset_start": 0,
  "offset_end": 7,
  "shift_from": 1,
  "shift_to": 6,
  "goal": "Nhân viên hiểu cấu trúc nhà thuốc, đăng nhập được hệ thống, nắm quy trình mở/đóng ca. Hoàn thành module GPP trước khi tiếp xúc khách hàng độc lập.",
  "signers": ["cht"]
}
```

### 22.4 Thống kê dữ liệu khởi tạo (theo N3)

| Level | Thời gian | Số ngày | Giai đoạn | Đầu việc | KPI (DS tổng / HS1 / tỉ trọng) |
|---|---|---|---|---|---|
| L1 | Tháng 1–2 | 60 | 6 | 60 | 30 tr / 12 tr / 40% |
| L2 | Tháng 4–12 | 274 | 3 | 31 | 100 tr / 30 tr / 30% |
| L3 | Tháng 13–24 | 365 | 3 | 24 | 125 tr / 45 tr / 36% |
| L4 | Tháng 25–36 | 365 | 3 | 23 | 150 tr / 55 tr / 37% |
| Tổng | | | 15 | 138 | |
