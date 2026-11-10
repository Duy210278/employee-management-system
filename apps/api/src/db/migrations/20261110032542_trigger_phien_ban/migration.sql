-- R03 (mục 14.8): bản đã gửi duyệt hoặc ban hành không sửa được nội dung, không xóa được;
-- bản đã ban hành không đưa về nháp. Chỉ bản nháp được sửa, xóa. Lỗi mã 50001.
CREATE TRIGGER [lotrinh].[trg_versions_no_delete] ON [lotrinh].[versions] INSTEAD OF DELETE AS
BEGIN
  -- INSTEAD OF chạy trước kiểm tra khóa ngoại (như BEFORE DELETE của PostgreSQL) nên luôn báo đúng R03
  SET NOCOUNT ON;
  DECLARE @msg NVARCHAR(400);
  SELECT TOP (1) @msg = CONCAT(N'Phiên bản ', COALESCE(d.code, CAST(d.id AS NVARCHAR(20))),
                               N' đã gửi duyệt hoặc ban hành, không được xóa (R03)')
  FROM deleted d WHERE d.[status] <> N'draft';
  IF @msg IS NOT NULL THROW 50001, @msg, 1;
  DELETE v FROM [lotrinh].[versions] v JOIN deleted d ON d.id = v.id;
END;
--> statement-breakpoint
CREATE TRIGGER [lotrinh].[trg_versions_guard_update] ON [lotrinh].[versions] AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @msg NVARCHAR(400);
  IF UPDATE(content)
  BEGIN
    SELECT TOP (1) @msg = CONCAT(N'Phiên bản ', COALESCE(d.code, CAST(d.id AS NVARCHAR(20))),
                                 N' đã gửi duyệt hoặc ban hành, không được sửa nội dung (R03)')
    FROM deleted d JOIN inserted i ON i.id = d.id
    WHERE d.[status] <> N'draft' AND i.content <> d.content;
    IF @msg IS NOT NULL THROW 50001, @msg, 1;
  END;
  IF UPDATE([status])
  BEGIN
    SELECT TOP (1) @msg = CONCAT(N'Phiên bản ', COALESCE(d.code, CAST(d.id AS NVARCHAR(20))),
                                 N' đã ban hành, không được đưa về nháp (R03)')
    FROM deleted d JOIN inserted i ON i.id = d.id
    WHERE d.[status] IN (N'active', N'expired') AND i.[status] NOT IN (N'active', N'expired');
    IF @msg IS NOT NULL THROW 50001, @msg, 1;
  END;
END;
