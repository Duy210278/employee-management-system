import type { AccountRole, UserStatus } from '@lotrinh/shared';

/** Dữ liệu mẫu cho bản demo (mục 14.12). Mật khẩu chung cho mọi tài khoản mẫu. */
export const SEED_PASSWORD = 'Demo@123';

export const SEED_AREAS = [{ code: 'HN1', name: 'Hà Nội 1' }];

export const SEED_STORES = [
  { code: 'NTA', name: 'Nhà thuốc A', address: '12 Cầu Giấy, Hà Nội', area: 'HN1' },
  { code: 'NTB', name: 'Nhà thuốc B', address: '45 Kim Mã, Ba Đình, Hà Nội', area: 'HN1' },
  { code: 'NTC', name: 'Nhà thuốc C', address: '8 Láng Hạ, Đống Đa, Hà Nội', area: 'HN1' },
  { code: 'NTD', name: 'Nhà thuốc D', address: '102 Trần Duy Hưng, Cầu Giấy, Hà Nội', area: 'HN1' },
];

export interface SeedUser {
  key: string;
  email: string;
  fullName: string;
  employeeCode: string;
  role: AccountRole;
  status: UserStatus;
  canBuddy?: boolean;
  canApproveVersions?: boolean;
  stores?: string[];
  areas?: string[];
  /** Tình huống mẫu, hiện ở màn đăng nhập nhanh */
  note: string;
}

export const SEED_USERS: SeedUser[] = [
  { key: 'admin', email: 'admin@upharma.local', fullName: 'Ngô Quốc Bảo', employeeCode: 'BP001', role: 'bp', status: 'active', note: 'Quản trị, soạn phiên bản, chỉnh ngày giả lập' },
  { key: 'huy', email: 'huy@upharma.local', fullName: 'Ngô Quang Huy', employeeCode: 'QL001', role: 'qlkv', status: 'active', canApproveVersions: true, areas: ['HN1'], note: 'QLKV Hà Nội 1, người duyệt phiên bản, nhận cảnh báo leo thang' },
  { key: 'ha', email: 'ha@upharma.local', fullName: 'Phạm Thu Hà', employeeCode: 'CH001', role: 'cht', status: 'active', stores: ['NTA'], note: 'CHT Nhà thuốc A' },
  { key: 'binh', email: 'binh@upharma.local', fullName: 'Lê Văn Bình', employeeCode: 'CH002', role: 'cht', status: 'active', stores: ['NTB'], note: 'CHT Nhà thuốc B' },
  { key: 'phuong', email: 'phuong@upharma.local', fullName: 'Trịnh Thu Phương', employeeCode: 'CH003', role: 'cht', status: 'active', stores: ['NTC'], note: 'CHT mới tuyển Nhà thuốc C, đang onboarding tuần đầu (ngày D+2)' },
  { key: 'minh', email: 'minh@upharma.local', fullName: 'Phan Đức Minh', employeeCode: 'CH004', role: 'cht', status: 'active', stores: ['NTD'], note: 'CHT mới Nhà thuốc D, chưa gán checklist: demo "Gán checklist CHT"' },
  { key: 'hung', email: 'hung@upharma.local', fullName: 'Trần Văn Hùng', employeeCode: 'NV101', role: 'nv', status: 'active', canBuddy: true, note: 'NV Level 3, đồng thời là Buddy của Lan, Tuấn, Mai' },
  { key: 'thao', email: 'thao@upharma.local', fullName: 'Đỗ Thị Thảo', employeeCode: 'NV102', role: 'nv', status: 'active', canBuddy: true, note: 'NV Level 3, Buddy của Linh (Nhà thuốc B)' },
  { key: 'lan', email: 'lan@upharma.local', fullName: 'Nguyễn Thị Lan', employeeCode: 'NV201', role: 'nv', status: 'active', note: 'NV Level 1 ngày thứ 27: có mục quá hạn, có mục bị yêu cầu làm lại' },
  { key: 'tuan', email: 'tuan@upharma.local', fullName: 'Phạm Minh Tuấn', employeeCode: 'NV202', role: 'nv', status: 'active', note: 'NV Level 1 ngày thứ 10, có mục cần hỗ trợ' },
  { key: 'mai', email: 'mai@upharma.local', fullName: 'Vũ Thị Mai', employeeCode: 'NV203', role: 'nv', status: 'active', note: 'NV Level 1, lộ trình bắt đầu sau 2 ngày nữa' },
  { key: 'linh', email: 'linh@upharma.local', fullName: 'Hoàng Thùy Linh', employeeCode: 'NV204', role: 'nv', status: 'active', note: 'NV Level 1 ngày thứ 62: đến kỳ phiếu đánh giá' },
  { key: 'nam', email: 'nam@upharma.local', fullName: 'Đặng Văn Nam', employeeCode: 'NV205', role: 'nv', status: 'active', note: 'NV Level 2 ngày thứ 139, có mục đã báo xong chờ CHT xác nhận' },
  { key: 'hanh', email: 'hanh@upharma.local', fullName: 'Bùi Thị Hạnh', employeeCode: 'NV206', role: 'nv', status: 'active', note: 'NV mới, tài khoản đã duyệt nhưng chưa có hồ sơ: dùng để demo "Thêm nhân viên"' },
  { key: 'moi', email: 'moi@upharma.local', fullName: 'Lý Thu Trang', employeeCode: 'NV207', role: 'nv', status: 'pending', stores: ['NTA'], note: 'Tự đăng ký, đang chờ BP Đào tạo duyệt' },
];

/** Lần vào cuối cách hôm nay bao nhiêu ngày (mặc định 1); null là chưa đăng nhập lần nào */
export const LAST_SEEN_DAYS_AGO: Record<string, number | null> = { tuan: 7, hanh: null };

/** Onboarding CHT đang chạy: Phương, CHT mới tuyển Nhà thuốc C, bắt đầu 2 ngày trước; Đào tạo đã check-in 2 ngày đầu */
export const SEED_CHT = {
  user: 'phuong',
  store: 'NTC',
  track: 'cht_moi_tuyen' as const,
  startOffset: -2,
  trainer: 'admin',
  qlkv: 'huy',
  trainingMode: 'offline' as const,
  journal: [
    { day: 0, mood: '🤔 Còn nhiều thứ chưa quen', difficulties: 'Chưa nhớ hết tên NV và ca làm; còn lúng túng khi tìm hàng trong kho', actions: 'Gửi sơ đồ quầy kệ, danh sách đội nhóm kèm ca làm việc', managerNote: '' },
    { day: 1, mood: '😐 Bình thường', difficulties: 'Thao tác POS còn chậm khi khách đông', actions: 'Hẹn NV kỳ cựu kèm thêm 30 phút POS đầu ca sáng mai', managerNote: 'Theo dõi thêm phần POS, cuối tuần báo lại' },
  ],
};

/** Đề xuất tạm dừng đang chờ duyệt: CHT Bình đề xuất cho Nam, QLKV Huy duyệt */
export const SEED_PAUSE = { user: 'nam', by: 'binh', fromOffset: 5, toOffset: 14, reason: 'Nghỉ phép năm 10 ngày' };

/** Kịch bản tiến độ tạo sẵn cho một lượt Level */
export interface ProgressPlan {
  /** Số mục đã quá hạn để trống (lấy các mục có hạn gần hôm nay nhất) */
  overdue?: number;
  /** Chỉ để trống những mục đã trễ ít nhất ngần này ngày */
  overdueMinDays?: number;
  /** Trong số mục quá hạn, bao nhiêu mục đã bị CHT yêu cầu làm lại */
  rework?: number;
  /** Mục sắp đến hạn mà NV đã báo xong (chỉ phần NV), đang chờ người xác nhận */
  waiting?: number;
  /** Mục sắp đến hạn mà NV báo cần hỗ trợ */
  help?: number;
}

export interface SeedStaff {
  user: string;
  store: string;
  level: number;
  /** Ngày bắt đầu Level so với ngày nạp dữ liệu (âm: đã bắt đầu từ ngần ấy ngày trước) */
  startOffset: number;
  buddy?: string;
  cht: string;
  qlkv: string;
  plan: ProgressPlan;
}

export const SEED_STAFF: SeedStaff[] = [
  { user: 'lan', store: 'NTA', level: 1, startOffset: -26, buddy: 'hung', cht: 'ha', qlkv: 'huy', plan: { overdue: 3, rework: 1, waiting: 1 } },
  { user: 'tuan', store: 'NTA', level: 1, startOffset: -9, buddy: 'hung', cht: 'ha', qlkv: 'huy', plan: { overdue: 1, waiting: 1, help: 1 } },
  { user: 'mai', store: 'NTA', level: 1, startOffset: 2, buddy: 'hung', cht: 'ha', qlkv: 'huy', plan: {} },
  { user: 'linh', store: 'NTB', level: 1, startOffset: -61, buddy: 'thao', cht: 'binh', qlkv: 'huy', plan: {} },
  { user: 'nam', store: 'NTB', level: 2, startOffset: -138, buddy: 'binh', cht: 'binh', qlkv: 'huy', plan: { overdue: 1, waiting: 2 } },
  { user: 'hung', store: 'NTA', level: 3, startOffset: -229, cht: 'ha', qlkv: 'huy', plan: { overdue: 1, overdueMinDays: 8 } },
  { user: 'thao', store: 'NTB', level: 3, startOffset: -199, cht: 'binh', qlkv: 'huy', plan: { waiting: 1 } },
];

/** Ngày nhận việc suy từ Level hiện tại: L2 bắt đầu khoảng tháng 4, L3 tháng 13 */
export const HIRE_BEFORE_LEVEL_START: Record<number, number> = { 1: 0, 2: 91, 3: 365, 4: 730 };

/** Doanh số tháng của Level đã qua (triệu đồng): [DS tổng, DS hệ số 1] theo tháng 1, 2, … */
export const SEED_SALES: Record<string, [number, number][]> = {
  linh: [
    [32, 13],
    [35, 14],
  ],
  nam: [
    [70, 20],
    [78, 22],
    [85, 26],
    [92, 28],
  ],
  hung: [
    [118, 42],
    [121, 43],
    [126, 45],
    [130, 46],
    [124, 44],
    [128, 46],
    [133, 48],
  ],
  thao: [
    [110, 38],
    [115, 40],
    [119, 41],
    [122, 43],
    [125, 45],
    [127, 46],
  ],
};

/** Ca quan sát Rubric: [ngày thứ mấy của lượt, điểm 5 tiêu chí theo thứ tự Phụ lục C, nhận xét] */
export const SEED_OBSERVATIONS: Record<string, [number, number[], string][]> = {
  linh: [
    [20, [2, 2, 3, 2, 2], 'Hỏi đủ triệu chứng, cảnh báo tương tác tốt'],
    [38, [3, 2, 2, 2, 2], ''],
    [52, [3, 3, 3, 2, 3], 'Tư vấn cá nhân hóa cho khách cao tuổi'],
  ],
  nam: [
    [95, [2, 2, 2, 2, 2], ''],
    [110, [3, 2, 2, 3, 2], 'Đề xuất bán kèm hợp lý'],
    [122, [3, 3, 1, 3, 3], 'Bỏ qua hỏi tiền sử dị ứng khi bán kháng sinh'],
    [131, [3, 3, 3, 2, 3], ''],
  ],
  lan: [
    [16, [2, 2, 2, 1, 2], 'Chưa đề xuất sản phẩm bổ trợ khi có cơ hội'],
    [23, [2, 2, 3, 2, 2], ''],
  ],
};

export const REWORK_NOTE = 'Thực hành chưa đạt: còn bỏ sót bước hỏi tiền sử dị ứng. Làm lại cùng Buddy trong ca tới.';
export const HELP_NOTE = 'Em chưa nắm cách nhập phiếu nhập hàng trên POS, nhờ anh chị hướng dẫn thêm.';
