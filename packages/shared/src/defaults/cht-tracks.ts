import type { ChtTrack } from '../schemas/version';

/**
 * Mẫu checklist onboarding Cửa hàng trưởng, trích từ docs/nguon/Onboarding_CHT_*.xlsx bằng seed/extract-cht.py.
 * Không sửa tay: sửa file Excel rồi chạy lại script.
 */
export const DEFAULT_CHT_TRACKS: ChtTrack[] = [
  {
    "key": "cht_moi_tuyen",
    "code": "CM",
    "name": "CHT mới tuyển",
    "title": "Checklist làm quen tuần đầu – CHT mới tuyển",
    "goal": "Không bỡ ngỡ, biết nhịp cửa hàng, quen đội nhóm",
    "tip": "Tuần đầu = làm quen thực tế. CHT quan sát → thực hành → tự làm. Đào tạo check-in cuối mỗi ngày. 3 ngày đào tạo offline sẽ được lên lịch riêng trong tháng 1.",
    "notes": [
      "📌 Checklist tuần đầu = làm quen thực tế tại cửa hàng. KHÔNG bao gồm 3 ngày đào tạo offline (lịch riêng).",
      "📌 Mỗi ngày Đào tạo check-in 1 lần (cuối ngày) để ghi nhận tiến độ và hỗ trợ kịp thời.",
      "📌 Người hỗ trợ chính tại cửa hàng là NV kỳ cựu hoặc QLKV — Đào tạo theo dõi từ xa (online) hoặc có mặt trực tiếp.",
      "📌 Mục tiêu cuối tuần: CHT biết nhịp ngày làm việc, không còn bỡ ngỡ với không gian và con người."
    ],
    "totalDays": 5,
    "moods": [
      "😊 Tự tin",
      "😐 Bình thường",
      "🤔 Còn nhiều thứ chưa quen",
      "😟 Lo lắng",
      "😩 Căng thẳng"
    ],
    "ratings": [
      {
        "key": "van_hanh",
        "label": "Mức độ làm quen vận hành cửa hàng"
      },
      {
        "key": "tinh_huong",
        "label": "Khả năng xử lý tình huống thực tế"
      },
      {
        "key": "doi_nhom",
        "label": "Mối quan hệ với đội nhóm"
      }
    ],
    "stages": [
      {
        "key": "CM-S1",
        "order": 1,
        "name": "Hành chính, Định hướng, Làm quen cửa hàng, Đội nhóm",
        "label": "Ngày D",
        "offsetStart": 0,
        "offsetEnd": 1,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CM-1-1",
            "order": 1,
            "category": "Hành chính",
            "content": "Hoàn tất thủ tục hành chính: ký hợp đồng, nhận đồng phục, thẻ NV, tài khoản hệ thống (email, POS, nhóm chat nội bộ)",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#11",
            "session": "sang",
            "supporter": "HR + Đào tạo",
            "link": ""
          },
          {
            "key": "CM-1-2",
            "order": 2,
            "category": "Định hướng",
            "content": "Đào tạo giới thiệu tổng quan: mục tiêu tuần đầu, ai liên hệ khi cần hỗ trợ, lịch check-in hàng ngày",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#12",
            "session": "sang",
            "supporter": "Đào tạo",
            "link": ""
          },
          {
            "key": "CM-1-3",
            "order": 3,
            "category": "Làm quen cửa hàng",
            "content": "Đi một vòng cửa hàng cùng QLKV hoặc CHT bàn giao: quan sát bố cục quầy kệ, kho, khu vực tư vấn, thiết bị",
            "guidance": "",
            "verifiers": [
              "qlkv"
            ],
            "requireNvFirst": true,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#13",
            "session": "sang",
            "supporter": "QLKV / CHT bàn giao",
            "link": ""
          },
          {
            "key": "CM-1-4",
            "order": 4,
            "category": "Làm quen cửa hàng",
            "content": "Tìm hiểu các S.O.P liên quan đến nhà thuốc.",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#14",
            "session": "chieu",
            "supporter": "NV kỳ cựu tại CH",
            "link": ""
          },
          {
            "key": "CM-1-5",
            "order": 5,
            "category": "Đội nhóm",
            "content": "Được giới thiệu từng thành viên đội nhóm: tên, thâm niên, ca làm việc, điểm mạnh (CHT ghi chú lại)",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#15",
            "session": "chieu",
            "supporter": "Đào tạo / QLKV",
            "link": ""
          },
          {
            "key": "CM-1-6",
            "order": 6,
            "category": "Check-in",
            "content": "Check-in ngày D: Đào tạo hỏi thăm cảm nhận đầu tiên, ghi nhận điều CHT thấy lạ hoặc chưa hiểu",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#16",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      },
      {
        "key": "CM-S2",
        "order": 2,
        "name": "Làm quen cửa hàng, Phần mềm, Hàng hóa & kho",
        "label": "Ngày D+1",
        "offsetStart": 1,
        "offsetEnd": 2,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CM-2-1",
            "order": 1,
            "category": "Làm quen cửa hàng",
            "content": "Quan sát NV thực hiện ca sáng đầy đủ: kiểm tiền lẻ đầu ca, trưng bày, vệ sinh nhà thuốc đầu ca, xử lý đơn đầu ngày — CHT quan sát, ghi chú, không can thiệp",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 1,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#17",
            "session": "sang",
            "supporter": "NV kỳ cựu tại CH",
            "link": ""
          },
          {
            "key": "CM-2-2",
            "order": 2,
            "category": "Phần mềm",
            "content": "Làm quen phần mềm POS: thao tác bán hàng cơ bản, tra cứu sản phẩm, xem tồn kho",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 1,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#18",
            "session": "sang",
            "supporter": "NV kỳ cựu / Đào tạo",
            "link": ""
          },
          {
            "key": "CM-2-3",
            "order": 3,
            "category": "Phần mềm",
            "content": "Thực hành POS: tự thực hiện 3–5 giao dịch bán hàng thực tế có NV hỗ trợ",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 1,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#19",
            "session": "chieu",
            "supporter": "NV kỳ cựu tại CH",
            "link": ""
          },
          {
            "key": "CM-2-4",
            "order": 4,
            "category": "Hàng hóa & kho",
            "content": "Quan sát quy trình nhập hàng / kiểm tra biên nhận giao hàng: cách đối chiếu, ký nhận, nhập kho",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 1,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#20",
            "session": "chieu",
            "supporter": "NV kỳ cựu tại CH",
            "link": ""
          },
          {
            "key": "CM-2-5",
            "order": 5,
            "category": "Check-in",
            "content": "Check-in ngày D+1: Đào tạo hỏi về POS và vận hành — ghi nhận điểm cần giải thích thêm",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 1,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#21",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      },
      {
        "key": "CM-S3",
        "order": 3,
        "name": "Hàng hóa & kho, Tư vấn khách hàng, Phần mềm",
        "label": "Ngày D+2",
        "offsetStart": 2,
        "offsetEnd": 3,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CM-3-1",
            "order": 1,
            "category": "Hàng hóa & kho",
            "content": "Tìm hiểu cách sắp xếp hàng hóa: nguyên tắc FEFO, FIFO, vị trí từng nhóm hàng, cách nhận biết hàng sắp hết, hàng cận hạn",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#22",
            "session": "sang",
            "supporter": "NV kỳ cựu tại CH",
            "link": ""
          },
          {
            "key": "CM-3-2",
            "order": 2,
            "category": "Tư vấn khách hàng",
            "content": "Quan sát NV tư vấn khách hàng 3–5 ca: ghi nhận cách tiếp cận, ngôn ngữ sử dụng, cách xử lý câu hỏi thuốc",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#23",
            "session": "sang",
            "supporter": "NV kỳ cựu tại CH",
            "link": ""
          },
          {
            "key": "CM-3-3",
            "order": 3,
            "category": "Tư vấn khách hàng",
            "content": "Thực hành tư vấn khách hàng lần đầu (ca đơn giản): CHT tự tư vấn, NV đứng cạnh hỗ trợ khi cần",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#24",
            "session": "chieu",
            "supporter": "NV kỳ cựu tại CH",
            "link": ""
          },
          {
            "key": "CM-3-4",
            "order": 4,
            "category": "Phần mềm",
            "content": "Xem POS: báo cáo doanh số ngày, danh mục tồn kho, danh mục sản phẩm, danh mục gọi hàng, danh mục hàng đổi giá",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#25",
            "session": "chieu",
            "supporter": "Đào tạo",
            "link": ""
          },
          {
            "key": "CM-3-5",
            "order": 5,
            "category": "Check-in",
            "content": "Check-in ngày D+2: Đào tạo hỏi về tư vấn khách — CHT cảm thấy thế nào, điểm nào còn lúng túng",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#26",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      },
      {
        "key": "CM-S4",
        "order": 4,
        "name": "Đội nhóm, Tư vấn khách hàng, Phần mềm, Làm quen cửa hàng",
        "label": "Ngày D+3",
        "offsetStart": 3,
        "offsetEnd": 4,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CM-4-1",
            "order": 1,
            "category": "Đội nhóm",
            "content": "Tìm hiểu cách phân bổ lịch làm việc của nhà thuốc: xem lịch ca tuần hiện tại, hiểu nguyên tắc phân ca, biết phân bổ nhân sự khi NV xin đổi ca đột xuất",
            "guidance": "",
            "verifiers": [
              "qlkv"
            ],
            "requireNvFirst": true,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#27",
            "session": "sang",
            "supporter": "QLKV / NV kỳ cựu",
            "link": ""
          },
          {
            "key": "CM-4-2",
            "order": 2,
            "category": "Tư vấn khách hàng",
            "content": "Quan sát 2–3 tình huống thường gặp (có NV hỗ trợ): khách đổi trả hàng, hết thuốc theo đơn, khách hỏi toa bác sĩ",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#28",
            "session": "sang",
            "supporter": "NV kỳ cựu tại CH",
            "link": ""
          },
          {
            "key": "CM-4-3",
            "order": 3,
            "category": "Phần mềm",
            "content": "Tự thực hiện thao tác POS: dự trù hàng, xử lý hàng đổi trả, kiểm kê",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#29",
            "session": "chieu",
            "supporter": "NV kỳ cựu / Đào tạo",
            "link": ""
          },
          {
            "key": "CM-4-4",
            "order": 4,
            "category": "Làm quen cửa hàng",
            "content": "Quan sát quy trình đóng ca: đối chiếu doanh thu, đếm tiền, chốt POS, bàn giao ca tiếp theo",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#30",
            "session": "chieu",
            "supporter": "NV kỳ cựu tại CH",
            "link": ""
          },
          {
            "key": "CM-4-5",
            "order": 5,
            "category": "Check-in",
            "content": "Check-in ngày D+3: Đào tạo hỏi tổng thể — CHT đã hiểu nhịp ngày làm việc của cửa hàng chưa, còn điểm mù nào",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#31",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      },
      {
        "key": "CM-S5",
        "order": 5,
        "name": "Làm quen cửa hàng, Phần mềm, Họp tổng kết, Định hướng",
        "label": "Ngày D+4",
        "offsetStart": 4,
        "offsetEnd": 5,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CM-5-1",
            "order": 1,
            "category": "Làm quen cửa hàng",
            "content": "CHT tự điều hành ca sáng lần đầu: phân việc cho đội nhóm, xử lý phát sinh — Đào tạo / QLKV quan sát, không can thiệp",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#32",
            "session": "sang",
            "supporter": "CHT (Đào tạo quan sát)",
            "link": ""
          },
          {
            "key": "CM-5-2",
            "order": 2,
            "category": "Phần mềm",
            "content": "CHT tự đọc báo cáo doanh số ngày D+3 và rút ra 1 nhận xét: hôm qua bán tốt / chưa tốt ở điểm nào",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#33",
            "session": "sang",
            "supporter": "CHT + Đào tạo",
            "link": ""
          },
          {
            "key": "CM-5-3",
            "order": 3,
            "category": "Họp tổng kết",
            "content": "Họp tổng kết tuần đầu (20–30 phút): CHT + Đào tạo + QLKV — chia sẻ quan sát, ghi nhận nỗ lực, đặt ưu tiên tuần 2",
            "guidance": "",
            "verifiers": [
              "bp",
              "qlkv"
            ],
            "requireNvFirst": false,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#34",
            "session": "chieu",
            "supporter": "Đào tạo + QLKV + CHT",
            "link": ""
          },
          {
            "key": "CM-5-4",
            "order": 4,
            "category": "Định hướng",
            "content": "Đào tạo bàn giao lịch học tiếp theo: lịch 3 ngày đào tạo offline, khóa LMS cần hoàn thành trong tháng 1",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#35",
            "session": "chieu",
            "supporter": "Đào tạo",
            "link": ""
          },
          {
            "key": "CM-5-5",
            "order": 5,
            "category": "Định hướng",
            "content": "Đào tạo cập nhật file này, ghi nhật ký tổng kết, gửi báo cáo ngắn cho QLKV",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_MoiTuyen_[TenCHT].xlsx#36",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      }
    ]
  },
  {
    "key": "cht_thang_tien",
    "code": "CT",
    "name": "CHT thăng tiến từ NVBH",
    "title": "Checklist làm quen tuần đầu – CHT thăng tiến từ NVBH",
    "goal": "Chuyển đổi tư duy quản lý, hiểu đội nhóm, đọc được số cửa hàng",
    "tip": "Đã biết vận hành rồi — tuần này tập trung vào góc nhìn quản lý. Quan sát đội nhóm, đọc số, giao việc, coaching. Đào tạo check-in cuối mỗi ngày.",
    "notes": [
      "✅ Đã biết: văn hóa công ty, POS cơ bản, quy trình bán hàng, tư vấn khách hàng → KHÔNG lặp lại trong tuần đầu.",
      "🎯 Tập trung mới: góc nhìn quản lý, điều hành đội nhóm, đọc số doanh số, coaching NV, POS tính năng cấp QL.",
      "⚠ Rủi ro đặc thù: áp lực chuyển đổi tư duy từ \"làm tốt việc mình\" sang \"giúp cả đội làm tốt\".",
      "📌 Mục tiêu cuối tuần: CHT hiểu đội nhóm của mình, biết nhìn cửa hàng qua con mắt quản lý, không còn phản xạ \"nhảy vào làm thay NV\"."
    ],
    "totalDays": 5,
    "moods": [
      "😊 Tự tin",
      "😐 Bình thường",
      "🤔 Còn nhiều thứ chưa quen",
      "😟 Lo lắng",
      "😩 Căng thẳng",
      "😬 Áp lực từ đồng nghiệp cũ nay là cấp dưới"
    ],
    "ratings": [
      {
        "key": "van_hanh",
        "label": "Mức độ làm quen vận hành cửa hàng"
      },
      {
        "key": "tinh_huong",
        "label": "Khả năng xử lý tình huống thực tế"
      },
      {
        "key": "doi_nhom",
        "label": "Mối quan hệ với đội nhóm"
      },
      {
        "key": "chuyen_doi_tu_duy",
        "label": "Khả năng chuyển đổi tư duy (không nhảy vào làm thay NV)"
      },
      {
        "key": "dong_nghiep_cu",
        "label": "Mối quan hệ với đồng nghiệp cũ"
      }
    ],
    "stages": [
      {
        "key": "CT-S1",
        "order": 1,
        "name": "Hành chính, Định hướng, Góc nhìn quản lý, Đội nhóm, POS cấp QL",
        "label": "Ngày D",
        "offsetStart": 0,
        "offsetEnd": 1,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CT-1-1",
            "order": 1,
            "category": "Hành chính",
            "content": "Bàn giao chính thức: nhận quyết định bổ nhiệm, tài khoản cấp quản lý (POS cấp QL, nhóm QLKV, báo cáo)",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#11",
            "session": "sang",
            "supporter": "HR + Đào tạo",
            "link": ""
          },
          {
            "key": "CT-1-2",
            "order": 2,
            "category": "Định hướng",
            "content": "Đào tạo định hướng tuần đầu: mục tiêu không phải \"làm giỏi\" mà là \"quan sát và hiểu đội nhóm của mình\"; Xem các khóa học LMS của CHT",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#12",
            "session": "sang",
            "supporter": "Đào tạo",
            "link": ""
          },
          {
            "key": "CT-1-3",
            "order": 3,
            "category": "Góc nhìn quản lý",
            "content": "Đi một vòng cửa hàng với góc nhìn CHT: quan sát bố cục, điểm mạnh/yếu về trưng bày, vệ sinh, thiết bị cần nâng cấp",
            "guidance": "",
            "verifiers": [
              "qlkv"
            ],
            "requireNvFirst": true,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#13",
            "session": "sang",
            "supporter": "QLKV",
            "link": ""
          },
          {
            "key": "CT-1-4",
            "order": 4,
            "category": "Đội nhóm",
            "content": "Quan sát đội nhóm làm việc: ghi chú điểm mạnh và điểm cần cải thiện của từng NV — không nhận xét to trước mặt họ",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#14",
            "session": "chieu",
            "supporter": "CHT tự thực hiện",
            "link": ""
          },
          {
            "key": "CT-1-5",
            "order": 5,
            "category": "POS cấp QL",
            "content": "Tìm hiểu POS tính năng cấp quản lý: xem báo cáo doanh thu ngày, chỉnh sửa và duyệt ca làm việc đội nhóm",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#15",
            "session": "chieu",
            "supporter": "NV kỳ cựu / Đào tạo",
            "link": ""
          },
          {
            "key": "CT-1-6",
            "order": 6,
            "category": "Check-in",
            "content": "Check-in ngày D: Đào tạo hỏi về cảm xúc khi \"đội mũ\" mới — điều nào thấy quen, điều nào thấy khác",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 0,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#16",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      },
      {
        "key": "CT-S2",
        "order": 2,
        "name": "Đội nhóm, Doanh số & KPIs",
        "label": "Ngày D+1",
        "offsetStart": 1,
        "offsetEnd": 2,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CT-2-1",
            "order": 1,
            "category": "Đội nhóm",
            "content": "Tìm hiểu lịch ca tuần hiện tại: ai làm ca nào, vì sao phân ca vậy, nguyên tắc phân ca công bằng và hiệu quả",
            "guidance": "",
            "verifiers": [
              "qlkv"
            ],
            "requireNvFirst": true,
            "dueOffset": 1,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#17",
            "session": "sang",
            "supporter": "QLKV / NV kỳ cựu",
            "link": ""
          },
          {
            "key": "CT-2-2",
            "order": 2,
            "category": "Đội nhóm",
            "content": "Tìm hiểu quy trình chấm công, xin nghỉ phép, xử lý NV đi trễ / vắng đột xuất: ai quyết định, báo ai, ghi ở đâu",
            "guidance": "",
            "verifiers": [
              "qlkv"
            ],
            "requireNvFirst": true,
            "dueOffset": 1,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#18",
            "session": "sang",
            "supporter": "HR / QLKV",
            "link": ""
          },
          {
            "key": "CT-2-3",
            "order": 3,
            "category": "Doanh số & KPIs",
            "content": "Xem KPIs cửa hàng tháng gần nhất: doanh số, nhân sự, hàng hóa",
            "guidance": "",
            "verifiers": [
              "bp",
              "qlkv"
            ],
            "requireNvFirst": true,
            "dueOffset": 1,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#19",
            "session": "chieu",
            "supporter": "QLKV + Đào tạo",
            "link": ""
          },
          {
            "key": "CT-2-4",
            "order": 4,
            "category": "Check-in",
            "content": "Check-in ngày D+1: Đào tạo hỏi về phần nhân sự và KPIs — điểm nào cảm thấy áp lực, điểm nào đã nắm được",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 1,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#20",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      },
      {
        "key": "CT-S3",
        "order": 3,
        "name": "Góc nhìn quản lý, Đội nhóm, Hàng hóa & kho, Doanh số & KPIs",
        "label": "Ngày D+2",
        "offsetStart": 2,
        "offsetEnd": 3,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CT-3-1",
            "order": 1,
            "category": "Góc nhìn quản lý",
            "content": "Thực hành giao việc buổi sáng: CHT phân công nhiệm vụ cho từng NV trong ca, đặt kỳ vọng rõ ràng",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#21",
            "session": "sang",
            "supporter": "CHT tự thực hiện",
            "link": ""
          },
          {
            "key": "CT-3-2",
            "order": 2,
            "category": "Đội nhóm",
            "content": "Xử lý tình huống quản lý đầu tiên (thực tế hoặc mô phỏng): NV xin nghỉ đột xuất, xử lý thế nào? Nhân sự xung đột nội bộ, xử lý thế nào?",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#22",
            "session": "sang",
            "supporter": "Đào tạo / QLKV",
            "link": ""
          },
          {
            "key": "CT-3-3",
            "order": 3,
            "category": "Hàng hóa & kho",
            "content": "Xem và phân tích báo cáo hàng hóa: sản phẩm sắp hết hạn, tồn kho cao bất thường, hàng đặt chưa về",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#23",
            "session": "chieu",
            "supporter": "CHT + NV kỳ cựu",
            "link": ""
          },
          {
            "key": "CT-3-4",
            "order": 4,
            "category": "Doanh số & KPIs",
            "content": "Thực hành đọc báo cáo doanh số ngày: so sánh với ngày cùng kỳ tuần trước, nhận diện 1 điểm cần cải thiện",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#24",
            "session": "chieu",
            "supporter": "CHT + Đào tạo",
            "link": ""
          },
          {
            "key": "CT-3-5",
            "order": 5,
            "category": "Check-in",
            "content": "Check-in ngày D+2: Đào tạo hỏi về lần đầu giao việc và đọc số — cảm nhận khác gì so với hồi còn là NVBH",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 2,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#25",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      },
      {
        "key": "CT-S4",
        "order": 4,
        "name": "Đội nhóm, Doanh số & KPIs, Góc nhìn quản lý, Định hướng",
        "label": "Ngày D+3",
        "offsetStart": 3,
        "offsetEnd": 4,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CT-4-1",
            "order": 1,
            "category": "Đội nhóm",
            "content": "Coaching 1-1 đầu tiên: CHT gặp riêng 1 NV trong đội, hỏi thăm, ghi nhận một điểm tích cực và một điểm cần cải thiện",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#26",
            "session": "sang",
            "supporter": "CHT tự thực hiện",
            "link": ""
          },
          {
            "key": "CT-4-2",
            "order": 2,
            "category": "Doanh số & KPIs",
            "content": "Tìm hiểu quy trình báo cáo lên QLKV: báo cáo gì, báo bằng kênh nào, bao giờ, format như thế nào",
            "guidance": "",
            "verifiers": [
              "qlkv"
            ],
            "requireNvFirst": true,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#27",
            "session": "sang",
            "supporter": "QLKV",
            "link": ""
          },
          {
            "key": "CT-4-3",
            "order": 3,
            "category": "Góc nhìn quản lý",
            "content": "CHT tự điều hành ca chiều: phân công công việc, theo dõi tiến độ, xử lý 1–2 tình huống phát sinh thực tế dưới góc nhìn quản lý nhà thuốc",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#28",
            "session": "chieu",
            "supporter": "CHT (Đào tạo quan sát)",
            "link": ""
          },
          {
            "key": "CT-4-4",
            "order": 4,
            "category": "Định hướng",
            "content": "Thảo luận với Đào tạo: điều gì đang làm tốt từ thời NVBH cần phát huy, điều gì cần cải thiện để làm tốt vai trò CHT",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#29",
            "session": "chieu",
            "supporter": "Đào tạo",
            "link": ""
          },
          {
            "key": "CT-4-5",
            "order": 5,
            "category": "Check-in",
            "content": "Check-in ngày D+3: Đào tạo hỏi về coaching và điều hành ca — ghi nhận điểm chuyển đổi tư duy đang tiến triển",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 3,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#30",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      },
      {
        "key": "CT-S5",
        "order": 5,
        "name": "Góc nhìn quản lý, Doanh số & KPIs, Họp tổng kết, Định hướng",
        "label": "Ngày D+4",
        "offsetStart": 4,
        "offsetEnd": 5,
        "goal": "",
        "signers": [],
        "items": [
          {
            "key": "CT-5-1",
            "order": 1,
            "category": "Góc nhìn quản lý",
            "content": "CHT tự điều hành ca sáng độc lập: phân công nhân sự, phân việc, họp phổ biến công việc 5 phút đầu ca với đội nhóm",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#31",
            "session": "sang",
            "supporter": "CHT (Đào tạo quan sát)",
            "link": ""
          },
          {
            "key": "CT-5-2",
            "order": 2,
            "category": "Doanh số & KPIs",
            "content": "CHT tự đánh giá doanh số tuần đầu: nhận xét ngắn về điểm tốt và điểm cần cải thiện của cửa hàng",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": true,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#32",
            "session": "sang",
            "supporter": "CHT",
            "link": ""
          },
          {
            "key": "CT-5-3",
            "order": 3,
            "category": "Họp tổng kết",
            "content": "Họp tổng kết tuần đầu (20–30 phút): CHT + Đào tạo + QLKV — ghi nhận nỗ lực, đặt 3 ưu tiên cho tuần 2",
            "guidance": "",
            "verifiers": [
              "bp",
              "qlkv"
            ],
            "requireNvFirst": false,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#33",
            "session": "chieu",
            "supporter": "Đào tạo + QLKV + CHT",
            "link": ""
          },
          {
            "key": "CT-5-4",
            "order": 4,
            "category": "Định hướng",
            "content": "Đào tạo bàn giao IDP sơ bộ: lịch học LMS tháng 1, mục tiêu 30 ngày đầu theo KPIs CHT",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#34",
            "session": "chieu",
            "supporter": "Đào tạo",
            "link": ""
          },
          {
            "key": "CT-5-5",
            "order": 5,
            "category": "Định hướng",
            "content": "Đào tạo cập nhật file này, ghi nhật ký tổng kết, gửi báo cáo ngắn cho QLKV (kèm đánh giá nguy cơ nghỉ việc)",
            "guidance": "",
            "verifiers": [
              "bp"
            ],
            "requireNvFirst": false,
            "dueOffset": 4,
            "gpp": false,
            "required": true,
            "allowNa": true,
            "dataSource": "manual",
            "evidence": "none",
            "dependsOn": [],
            "sourceRef": "Onboarding_CHT_TuNVBH_[TenCHT].xlsx#35",
            "session": "cuoi_ngay",
            "supporter": "Đào tạo",
            "link": ""
          }
        ]
      }
    ]
  }
];
