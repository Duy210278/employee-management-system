# Lộ trình Upharma

Quản lý khung năng lực, checklist onboarding và lộ trình 4 Level cho nhân viên bán hàng nhà thuốc Upharma.
Bản demo chạy trên một máy tính, không dùng Docker.

- Đặc tả: [docs/thiet-ke/Upharma_Lo_trinh_NVBH_Tai_lieu_thiet_ke.md](docs/thiet-ke/Upharma_Lo_trinh_NVBH_Tai_lieu_thiet_ke.md)
- Kế hoạch triển khai và tiến độ: [docs/ke-hoach/KE_HOACH_TRIEN_KHAI.md](docs/ke-hoach/KE_HOACH_TRIEN_KHAI.md)
- Tài liệu nguồn N1, N2, N3: [docs/nguon/](docs/nguon/)

## Cài đặt (một lần)

Cần Node.js 20 trở lên, pnpm 9, SQL Server 2016 trở lên (đã thử SQL Server 2022 Developer cài trực tiếp trên Ubuntu 22.04, không Docker) và công cụ `sqlcmd` (gói `mssql-tools18`).

```bash
# Tạo cơ sở dữ liệu lotrinh (chạy thử), lotrinh_test (test) và tài khoản ứng dụng lotrinh_app
sqlcmd -S localhost -U sa -C -b -v APP_PASSWORD="<mật khẩu cho lotrinh_app>" -i scripts/setup-sqlserver.sql

cp .env.example .env          # điền mật khẩu lotrinh_app vào DATABASE_URL, DATABASE_URL_TEST; đổi JWT_SECRET
pnpm install
```

Bảng nằm trong schema `lotrinh`. Khi mở bằng `sqlcmd` cần cờ `-I` (bật `QUOTED_IDENTIFIER`, bắt buộc với filtered index).

## Chạy bản demo

```bash
pnpm build
pnpm start
```

Mở http://localhost:3000. Lần chạy đầu, API tự tạo bảng (migration) và nạp dữ liệu mẫu nếu cơ sở dữ liệu còn trống. Giữ cửa sổ terminal mở trong buổi demo; `Ctrl+C` để dừng.

Màn đăng nhập có ô **đăng nhập nhanh** (bản demo): chọn tài khoản mẫu trong danh sách thả xuống, theo nhóm vai trò, rồi bấm "Vào". Mật khẩu chung `Demo@123`; sau khi vào có thể đổi tài khoản ở thanh trên cùng.
Đăng nhập BP Đào tạo (Ngô Quốc Bảo) để khôi phục dữ liệu mẫu (tab Quản trị). Ứng dụng luôn dùng ngày thật; dữ liệu mẫu được dựng lùi từ hôm nay nên luôn có đủ tình huống đúng hạn, sắp đến hạn, quá hạn.

**Tài liệu API (Swagger):** http://localhost:3000/api/docs (JSON OpenAPI ở `/api/docs/json`). Liệt kê mọi API theo nhóm, body mẫu lấy từ schema Zod dùng chung. Muốn thử: gọi `POST /api/v1/auth/login` ngay trên trang (cookie tự lưu), rồi gọi các API khác. Đặt `API_DOCS=false` trong `.env` để tắt.

## Chạy khi phát triển

```bash
pnpm dev
```

Mở http://localhost:5173 (Vite, tự nạp lại khi sửa mã; `/api` được chuyển sang API ở cổng 3000).

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy shared (theo dõi thay đổi), API, web cùng lúc |
| `pnpm build` / `pnpm start` | Build cả 3 gói / chạy API phục vụ luôn giao diện ở cổng 3000 |
| `pnpm test` | Test lõi nghiệp vụ (shared) và test API (trên `lotrinh_test`, bị xóa sạch mỗi lần chạy) |
| `pnpm typecheck` | Kiểm tra kiểu cả 3 gói |
| `pnpm db:reset` | Xóa sạch, chạy migration, nạp lại dữ liệu mẫu (ngày bắt đầu Level tính lùi từ hôm nay) |
| `pnpm db:generate` | Sinh migration SQL sau khi sửa `apps/api/src/db/schema.ts` |
| `pnpm seed:extract` | Trích lại `seed/v2.1.json` từ giao diện tham chiếu N3 |
| `sqlcmd -S localhost -U lotrinh_app -C -Q "BACKUP DATABASE lotrinh TO DISK = N'/var/opt/mssql/data/lotrinh.bak' WITH INIT"` | Sao lưu nhanh dữ liệu chạy thử |

## Tài khoản mẫu

| Tài khoản | Vai trò | Tình huống |
|---|---|---|
| admin@upharma.local | BP Đào tạo | Quản trị, khôi phục dữ liệu mẫu |
| huy@upharma.local | QLKV Hà Nội 1 | Thấy mọi cửa hàng trong khu vực; người duyệt phiên bản; có đề xuất tạm dừng của Nam chờ duyệt |
| ha@upharma.local | CHT Nhà thuốc A | |
| binh@upharma.local | CHT Nhà thuốc B | Đồng thời là Buddy của Nam |
| hung@upharma.local | NV Level 3 | Buddy của Lan, Tuấn, Mai: tab "Việc kèm cặp" |
| thao@upharma.local | NV Level 3 | Buddy của Linh |
| lan@upharma.local | NV Level 1, ngày thứ 27 | Có mục quá hạn, mục bị yêu cầu làm lại |
| tuan@upharma.local | NV Level 1, ngày thứ 10 | Có mục cần hỗ trợ; 7 ngày chưa đăng nhập (cảnh báo vàng) |
| mai@upharma.local | NV Level 1, bắt đầu sau 2 ngày | Việc ở trạng thái "Sắp mở" |
| linh@upharma.local | NV Level 1, ngày thứ 62 | Đã xong checklist, đủ doanh số và Rubric: demo phiếu đánh giá, lên Level 2; giai đoạn cuối chờ CHT Bình ký |
| nam@upharma.local | NV Level 2, ngày thứ 139 | Có doanh số 4 tháng, 4 ca Rubric (1 ca lỗi an toàn thuốc: cảnh báo đỏ) |
| hanh@upharma.local | NV, chưa có hồ sơ | Dùng để demo "Thêm nhân viên" |
| moi@upharma.local | Chờ duyệt | Tự đăng ký (Nhà thuốc A), chưa đăng nhập được: demo duyệt hoặc từ chối |
| phuong@upharma.local | CHT Nhà thuốc C, mới tuyển | Đang onboarding tuần đầu (ngày D+2), Đào tạo là BP ĐT, QLKV Huy; tab "Lộ trình của tôi" |
| minh@upharma.local | CHT Nhà thuốc D | Chưa gán checklist: demo "Gán checklist CHT" ở Quản trị |

## Kịch bản demo MVP (khoảng 7 phút)

1. **BP ĐT** → Quản trị → Công cụ demo: khôi phục dữ liệu mẫu để bắt đầu từ trạng thái sạch.
2. **BP ĐT** → Nhân sự → Thêm nhân viên: chọn tài khoản Bùi Thị Hạnh, ngày nhận việc là ngày mai, Buddy Hùng. Đăng nhập **Hạnh**: "Lộ trình Level 1 bắt đầu ngày … (còn 1 ngày)".
3. **Hùng** → Việc kèm cặp: thấy việc của các NV mình kèm cặp đang chờ xác nhận (việc của Hạnh xuất hiện từ ngày mai, khi lượt bắt đầu).
4. **Lan** (chế độ điện thoại trong DevTools): mở một mục → "Tôi đã làm xong".
5. **Hùng**: mục của Lan ở đầu hàng đợi → "Xác nhận đạt (Buddy)".
6. **CHT Hà** → Nhân sự → Lan → Checklist: "Yêu cầu làm lại" (bắt buộc nhập lý do); Lan thấy cảnh báo đỏ.
7. **CHT Hà** mở hồ sơ một NV Nhà thuốc B qua URL: bị từ chối (ngoài phạm vi cửa hàng).

Xong thì BP ĐT → Quản trị → "Khôi phục dữ liệu mẫu".

## Đánh giá và lên Level (Hồ sơ NV)

Hồ sơ NV có các tab **Doanh số**, **Quan sát Rubric**, **Chuyển Level**; bộ chọn Level bên phải để xem lại Level đã qua.

- **Doanh số:** CHT, QLKV (trong phạm vi) hoặc BP ĐT nhập DS tổng và DS hệ số 1 theo tháng của Level (triệu đồng). Bảng có dòng Tổng cộng, Trung bình/tháng và Cửa sổ xét KPI: L1 mọi tháng 1–2 phải đạt; L2–L4 trung bình 2 tháng cuối Level.
- **Quan sát Rubric:** Buddy, CHT, QLKV của lượt chấm 5 tiêu chí 1–3 (Phụ lục C). Ca đạt khi tổng ≥ 10/15 và không tiêu chí nào 1 điểm; mục tiêu ≥ 80% ca đạt, tối thiểu 3 ca/tháng.
- **Chuyển Level:** phiếu mở từ ngày mở giai đoạn cuối. Buddy (L1), CHT hoặc BP ĐT điền; ký theo thứ tự CHT → QLKV → BP ĐT → NV. Khi **BP ĐT ký**, hệ thống tự áp dụng kết quả: lên Level mới từ hôm nay (tạo checklist Level mới), gia hạn 1 tháng (tối đa 2 lần, mở vòng phiếu mới), hoặc đóng lượt Không đạt.

Kịch bản thử: **CHT Bình** → Việc cần xử lý → "Chữ ký chờ bạn" → phiếu của **Linh** (đã đủ doanh số và Rubric) → điền, lưu, ký → **QLKV Huy** ký → **BP ĐT** ký → Linh lên Level 2 → **Linh** đăng nhập, ký nhận kết quả.

## Quản lý checklist (tab "Thiết kế lộ trình")

Khung năng lực và Checklist được phát hành chung một số phiên bản (mục 8 đặc tả). Bản đã ban hành không sửa được; muốn thay đổi thì tạo bản nháp.

1. **BP ĐT** → Thiết kế lộ trình: dữ liệu mẫu có sẵn một bản nháp với 2 thay đổi. Sửa giai đoạn, đầu việc (nội dung, người xác nhận, hạn, cờ GPP, phụ thuộc), thêm/xóa/sắp xếp, chuyển giai đoạn. `Ctrl+S` để lưu.
2. Khung **"Kiểm tra trước khi gửi duyệt"** chạy ngay khi gõ (CK-01..CK-11); bấm vào lỗi để nhảy tới đúng dòng. Còn lỗi thì không gửi duyệt được.
3. **Dải tác động** cho biết đây là *sửa diễn đạt* (số 2.1.1, NV đang chạy thấy câu mới ngay) hay *thay đổi tiêu chí* (số 2.2, chỉ áp dụng cho lượt Level bắt đầu từ ngày hiệu lực).
4. Nhập ghi chú thay đổi → **Gửi duyệt**.
5. **QLKV Huy** (quyền "Người duyệt phiên bản") → tab "Duyệt phiên bản" → chọn ngày hiệu lực → **Duyệt và ban hành**, hoặc **Trả về nháp** kèm lý do. BP ĐT không tự duyệt được bản mình soạn, trừ khi bật công tắc V20 ở Quản trị.
6. **Đổi ngày hiệu lực:** bản đã duyệt mà chưa tới ngày ("Sắp hiệu lực") có khung **Ngày hiệu lực** để người duyệt chọn lại ngày. Ngày mới phải sau bản trước, trước bản ban hành sau nó và không ở quá khứ; bản đang hiệu lực tự kết thúc theo ngày mới. Bị chặn nếu đã có lượt Level bắt đầu trong khoảng giữa ngày cũ và ngày mới (phiên bản gắn với lượt đó sẽ sai). Bản đã có hiệu lực thì không đổi được, muốn thay đổi phải ban hành bản mới.

Lưu ý có sẵn: CK-09 báo mục L1-6-5 nhắc "3 tháng" trong khi Level 1 dài 2 tháng (vấn đề V1) — có thể sửa bằng một bản sửa diễn đạt.

## Quản trị người dùng (BP Đào tạo → Quản trị)

- **Đăng ký → duyệt:** người mới bấm "Chưa có tài khoản? Đăng ký" ở trang đăng nhập, chọn vai trò đề nghị và nhà thuốc/khu vực, rồi thấy màn **Đang chờ duyệt**. BP ĐT nhận thông báo (chuông), vào **Tài khoản và vai trò**: thẻ "N tài khoản đang chờ duyệt" có nút Duyệt (theo đề nghị) và Từ chối (bắt buộc lý do). Muốn chỉnh vai trò, phạm vi trước khi duyệt thì mở Chi tiết.
- **Sửa tài khoản:** vai trò, cửa hàng (CHT) hoặc khu vực (QLKV), quyền "Có thể làm Buddy", "Người duyệt phiên bản", trạng thái Hoạt động / Tạm khóa / Đã nghỉ. Đổi vai trò có hiệu lực ngay ở lần tải trang kế tiếp; mọi thay đổi ghi ở "Lịch sử thay đổi".
- **Chuyển giao (R20):** khóa, cho nghỉ hoặc đổi vai trò người đang là Buddy/CHT/QLKV của lượt đang chạy thì khung "Chuyển giao" hiện ra, phải chọn người thay mới lưu được. Ví dụ: khóa Hùng (Buddy của Lan, Tuấn, Mai).
- **Gán checklist:** tài khoản NV đang hoạt động mà chưa có hồ sơ có nút **Gán checklist** trong danh sách; trang chi tiết có khung "Lộ trình và checklist" (điền sẵn họ tên, mã NV, nhà thuốc lúc đăng ký): chọn Level, Buddy, CHT, QLKV rồi bấm **Gán checklist**. Hệ thống tạo hồ sơ, bắt đầu lượt Level và sinh checklist từ Bộ lộ trình đang hiệu lực. NV đã có hồ sơ thì khung này hiện Level, tiến độ và lối tắt tới checklist. (Cách cũ ở Nhân sự → Thêm nhân viên vẫn dùng được.)
- **Gán checklist CHT:** tài khoản Cửa hàng trưởng có nút **Gán checklist CHT**; xem mục "Onboarding Cửa hàng trưởng" bên dưới.
- **Luôn còn ít nhất 1 BP ĐT hoạt động (R19);** không tự khóa tài khoản của mình.
- **Cửa hàng, khu vực:** thêm, sửa, ngừng; không ngừng cửa hàng còn nhân viên đang theo dõi.
- **Nhập tài khoản:** tải mẫu CSV, xem trước (dòng lỗi được đánh dấu: trùng email/mã NV, cửa hàng không tồn tại…), chỉ nhập các dòng hợp lệ. Mật khẩu ban đầu `Upharma@123`.
- **Nhật ký hệ thống:** mọi thao tác ghi dữ liệu, lọc theo người, loại thao tác, khoảng ngày.
- **Công cụ demo:** "Chạy job ngay", khôi phục dữ liệu mẫu.

## Vận hành lượt Level

- **Ký cuối giai đoạn:** chân mỗi thẻ giai đoạn (Hồ sơ NV → Checklist) có chuỗi ký. Mở từ 3 ngày trước khi giai đoạn kết thúc, hạn 3 ngày sau; chỉ ký được khi mọi mục bắt buộc đã xong hoặc N/A (R11). Giai đoạn sẵn sàng ký hiện ở "Chữ ký chờ bạn". Thử: **CHT Bình** → ký giai đoạn cuối của Linh.
- **Tạm dừng:** Hồ sơ NV → tab **Phân công & tạm dừng**. CHT đề xuất → QLKV hoặc BP ĐT duyệt (đề xuất hiện ở "Chữ ký chờ bạn" của QLKV). Khi duyệt, mọi mốc chưa xong từ ngày dừng lùi đúng số ngày nghỉ, ngày kết thúc dự kiến lùi theo; "ngày thứ N" đứng yên trong lúc dừng. QLKV, BP ĐT tạm dừng thì có hiệu lực ngay.
- **Đổi Buddy / CHT / QLKV, chuyển cửa hàng:** cùng tab; lịch không đổi, người mới nhận các việc chưa xác nhận và được thông báo.
- **Ngừng theo dõi (nghỉ việc):** lượt chuyển Dừng, dữ liệu giữ nguyên; nếu NV đang là Buddy của người khác thì phải chọn Buddy thay.
- **Xóa hồ sơ nhân viên (chỉ BP ĐT):** cùng tab, khung cuối trang. Gõ lại đúng họ tên và nhập lý do; xóa hẳn hồ sơ cùng mọi lượt Level, đầu việc, xác nhận, doanh số, Rubric, phiếu đánh giá, nhật ký onboarding và thông báo trỏ tới hồ sơ. Tài khoản đăng nhập giữ nguyên (vẫn là Buddy/CHT của người khác nếu đang được phân công, có thể gán checklist lại). Không khôi phục được; nhật ký hệ thống ghi họ tên và lý do. Nghỉ việc thì dùng "Ngừng theo dõi".

## Onboarding Cửa hàng trưởng (CHT)

Checklist làm quen tuần đầu của CHT, trích từ `docs/nguon/Onboarding_CHT_MoiTuyen_[TenCHT].xlsx` và `Onboarding_CHT_TuNVBH_[TenCHT].xlsx` (`python3 seed/extract-cht.py` sinh lại `packages/shared/src/defaults/cht-tracks.ts`). Có 2 loại: **CHT mới tuyển** (5 ngày, 26 việc, mã `CM-…`) và **CHT thăng tiến từ NVBH** (5 ngày, 25 việc, mã `CT-…`). Mỗi ngày D+n là một giai đoạn, không ký cuối ngày.

- **Quản lý checklist:** BP ĐT → Thiết kế lộ trình → bản nháp → tab **Checklist CHT**. Sửa thông tin (tên, mục tiêu, lưu ý, lựa chọn cảm xúc, tiêu chí đánh giá tuần đầu), từng ngày và đầu việc (người xác nhận Đào tạo / QLKV / Buddy, buổi, người hỗ trợ, link tài liệu). Bản chưa có checklist CHT có nút **Thêm … từ mẫu**. Đi qua cùng luồng gửi duyệt, ban hành với Khung năng lực.
- **Gán checklist:** BP ĐT → Quản trị → tài khoản CHT → **Gán checklist CHT** (hoặc QLKV qua API): chọn loại, cửa hàng, Ngày D, hình thức training, **Người phụ trách Đào tạo** (tài khoản BP ĐT), QLKV, Buddy (không bắt buộc). Hệ thống gợi ý "thăng tiến" khi tài khoản đã có lượt NVBH; khi đó lượt Level đang mở đóng với trạng thái **Thăng chức CHT** và hồ sơ cũ được dùng lại (thâm niên, cửa hàng cũ).
- **Phân vai trò:** việc của "Đào tạo" giao cho người phụ trách Đào tạo của lượt (không phải mọi BP ĐT), việc của QLKV giao cho QLKV. Đổi người ở tab **Phân công & tạm dừng**. CHT tự báo xong việc của mình ở **Lộ trình của tôi**.
- **Nhật ký theo dõi:** Đào tạo ghi cảm xúc, khó khăn, hành động hỗ trợ sau mỗi lần check-in; QLKV (hoặc BP ĐT) ghi chú quản lý.
- **Đánh giá tuần đầu:** Đào tạo chấm sao từng tiêu chí, đánh giá nguy cơ nghỉ việc (cao → báo QLKV và cảnh báo đỏ; trung bình → vàng), đề xuất hỗ trợ tuần 2. QLKV xác nhận khi checklist đã xong mọi việc bắt buộc và đánh giá đủ: lượt chuyển **Hoàn thành**, nhật ký và đánh giá khóa lại.

Kịch bản thử: **BP ĐT** → Quản trị → Phan Đức Minh → Gán checklist CHT. Mở hồ sơ **Phương** → tab Nhật ký theo dõi, Đánh giá tuần đầu. Đăng nhập **Phương** → Lộ trình của tôi → báo xong một việc ngày D+2.


## Cảnh báo, thông báo, xuất CSV

- **Cảnh báo** (tab Cảnh báo, cột Cảnh báo ở Nhân sự, đầu Hồ sơ NV): đỏ khi mục GPP quá hạn, Level 1–2 chưa có Buddy sau 48 giờ, có mục trễ hơn 7 ngày, có ca Rubric lỗi an toàn thuốc; vàng khi có mục trễ, chưa gắn CHT, DS tổng dưới 80% hai tháng liền, Rubric dưới mục tiêu, NV Level 1 không đăng nhập quá 5 ngày, quá thời gian Level 14 ngày, trễ ký giai đoạn. Tính trực tiếp nên luôn khớp ngày hôm nay. QLKV có thêm khối "Cảnh báo trong khu vực" ở Việc cần xử lý.
- **Thông báo** (chuông trên thanh trên cùng): NV báo xong / cần hỗ trợ → người xác nhận kế tiếp; yêu cầu làm lại → NV; chữ ký giai đoạn, phiếu → người ký kế tiếp; đề xuất tạm dừng → QLKV; bản nháp chờ duyệt → người duyệt; đăng ký mới → BP ĐT. Mỗi sáng có **bản tin** (việc quá hạn, sắp đến hạn, mới mở), QLKV nhận báo việc quá hạn lâu, lượt sắp bắt đầu được nhắc trước 1 ngày. Job chạy khi khởi động, sang ngày mới, khôi phục dữ liệu mẫu, hoặc bấm "Chạy ngay"; chạy lại không tạo trùng.
- **Xuất CSV tiến độ:** Nhân sự → "Xuất CSV" (CHT, QLKV trong phạm vi, BP ĐT toàn chuỗi), mở được bằng Excel.

## Khung năng lực (chỉ BP Đào tạo sửa)

- **Sửa:** BP ĐT → Thiết kế lộ trình → bản nháp → tab **Khung năng lực**. Theo từng Level: thông tin Level (số ngày, số tháng), mục tiêu, phân công trách nhiệm, chỉ tiêu doanh số và cách xét KPI, nhiệm vụ LMS / tại quầy, phiếu đánh giá (tiêu chí, phần nhận xét, gia hạn, chuỗi ký). Dùng chung: Rubric và phần giới thiệu. Đi qua cùng luồng nháp → gửi duyệt → ban hành với checklist; kiểm tra KNL-xx chạy ngay khi gõ (ví dụ DS hệ số 1 lớn hơn DS tổng là lỗi KNL-04).
- **Xem:** mọi người (trừ NV) mở tab **Khung năng lực** trên thanh trên cùng để xem phiên bản đang hiệu lực, chỉ đọc. CHT, QLKV, người duyệt không sửa được nội dung (máy chủ trả 403).
- **Ai ban hành (V20):** BP ĐT → Quản trị → "BP Đào tạo tự duyệt và ban hành phiên bản". Mặc định tắt: cần người có quyền duyệt (QLKV Huy). Bật: BP ĐT quản lý trọn vòng đời.

## Cấu trúc

```
apps/api/src      NestJS (mục 14.4–14.5 đặc tả)
  adapters/         phần hạ tầng tối giản thay được khi chạy thật: clock (nguồn "hôm nay" duy nhất; test thay bằng đồng hồ giả)
  common/           lỗi { code, message }, kiểm tra dữ liệu vào bằng Zod, phiên đăng nhập
  db/               schema Drizzle (SQL Server, schema lotrinh), migration, dữ liệu mẫu, lệnh db:*; mssql.ts thay tính năng PostgreSQL
  modules/          access (ma trận quyền CASL + lọc phạm vi), audit (ghi và xem nhật ký), auth (đăng nhập, đăng ký), demo,
                    health, me (Hôm nay, Việc cần xử lý), runs (checklist, ký giai đoạn, tạm dừng, phân công), staff,
                    tasks, versions (vòng đời phiên bản), sales, observations, reviews (phiếu đánh giá, lên Level),
                    users (tài khoản, chuyển giao, nhập CSV), org (cửa hàng, khu vực), alerts, notifications,
                    jobs (bản tin, leo thang, nhắc lượt, kích hoạt phiên bản), reports (CSV), cht (onboarding CHT)
  db/migrations/    khởi tạo (sinh từ schema) và trigger chặn sửa, xóa bản đã ban hành (R03, viết tay)
apps/web/src      Vue 3: api, components (ItemRow, StageChecklist, design/ trình soạn checklist…), designer/ (thao tác soạn),
                  pages, styles (bảng màu N3)
packages/shared   Lõi nghiệp vụ dùng chung API ↔ giao diện: schema phiên bản, tính lịch, trạng thái đầu việc,
                  quy tắc xác nhận và giao việc, kiểm tra hợp lệ CK (validation/), phân loại thay đổi (change-kind/)
seed/             Bộ lộ trình v2.1 (trích từ N3) và script trích
scripts/          setup-sqlserver.sql (tạo CSDL, tài khoản ứng dụng)
docs/             thiet-ke/ (đặc tả) · ke-hoach/ (kế hoạch, tiến độ) · nguon/ (N1, N2, N3)
```

Nguyên tắc: mọi phép tính ngày và quyền nằm trong `packages/shared` (chạy giống nhau ở API và giao diện) hoặc `modules/access`;
"hôm nay" luôn lấy từ `ClockService` (không gọi `new Date()` trong nghiệp vụ); phạm vi dữ liệu luôn kiểm tra ở máy chủ.
