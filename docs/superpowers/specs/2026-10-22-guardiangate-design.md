# GuardianGate — Product Design Record

## Quyết định đã duyệt

- Primary user là bác sĩ điều trị; core job là yêu cầu và dùng phần hồ sơ tối thiểu trong ca khám hợp lệ.
- Ca khám thường cần một người giám hộ hợp pháp duyệt.
- Chia sẻ ra ngoài của trẻ có hai người giám hộ đã xác minh cần cả hai duyệt.
- Cấp cứu cần bác sĩ yêu cầu và bác sĩ khác xác nhận độc lập; chỉ tóm tắt y tế tối thiểu được mở tạm thời.
- Thay đổi policy nhạy cảm do admin đề xuất chỉ có hiệu lực sau hai phê duyệt độc lập: Privacy Officer và Compliance/Policy Approver.
- Luồng pháp lý là `LATER`; dữ liệu thật, tích hợp bệnh viện thật và các tuyên bố chống rò rỉ tuyệt đối là ngoài phạm vi.

## Lựa chọn phạm vi

MVP dùng năm luồng kiểm chứng policy: truy cập ca khám thường, chia sẻ ngoài, cấp cứu, quorum policy và audit. Đây là lựa chọn cân bằng giữa tính thuyết phục của demo và khả năng trình diễn; không mở rộng sang luồng pháp lý.

## Quy tắc trải nghiệm cần giữ nhất quán

- Trước khi quyền hợp lệ, UI phải nói rõ trạng thái/điều kiện còn thiếu nhưng không lộ nội dung hồ sơ.
- Khi quyền hợp lệ, chỉ nhóm dữ liệu, mục đích và thời hạn được duyệt mới có hiệu lực.
- Khi từ chối, hết hạn hoặc thu hồi, mọi lần truy cập sau bị chặn.
- “Đề xuất” policy phải được phân biệt rõ với “đã có hiệu lực”.

## Đặc tả chuẩn

Tài liệu nguồn sự thật cho Product và handoff là [product.md](../../product/product.md). Thiết kế kỹ thuật được chủ động để trống cho bước Architecture nhằm tránh giả định về TideCloak, backend hay hạ tầng.
