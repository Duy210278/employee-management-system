-- R03 (mục 14.8): bản đã gửi duyệt hoặc ban hành không sửa được nội dung, không xóa được; chỉ bản nháp được sửa, xóa.
CREATE OR REPLACE FUNCTION versions_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Phiên bản % đã gửi duyệt hoặc ban hành, không được xóa (R03)', COALESCE(OLD.code, OLD.id::text)
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND NEW.content IS DISTINCT FROM OLD.content THEN
    RAISE EXCEPTION 'Phiên bản % đã gửi duyệt hoặc ban hành, không được sửa nội dung (R03)', COALESCE(OLD.code, OLD.id::text)
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status IN ('active', 'expired') AND NEW.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'Phiên bản % đã ban hành, không được đưa về nháp (R03)', OLD.code USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER versions_guard BEFORE UPDATE OR DELETE ON versions FOR EACH ROW EXECUTE FUNCTION versions_guard();
