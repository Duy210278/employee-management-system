import { HttpException, HttpStatus } from '@nestjs/common';

/** Lỗi API luôn có dạng { code, message } với thông báo tiếng Việt nêu rõ cách sửa (mục 14.10, 15.7) */
export function fail(status: number, code: string, message: string): HttpException {
  return new HttpException({ code, message }, status);
}

export const badRequest = (code: string, message: string) => fail(HttpStatus.BAD_REQUEST, code, message);
export const unauthorized = (code: string, message: string) => fail(HttpStatus.UNAUTHORIZED, code, message);
export const forbidden = (code: string, message: string) => fail(HttpStatus.FORBIDDEN, code, message);
export const notFound = (code: string, message: string) => fail(HttpStatus.NOT_FOUND, code, message);
export const conflict = (code: string, message: string) => fail(HttpStatus.CONFLICT, code, message);

export const staleData = () => conflict('STALE', 'Dữ liệu vừa được người khác cập nhật, tải lại trang rồi thao tác lại');
