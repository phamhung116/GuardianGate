# GuardianGate — Đánh giá và đề xuất kiến trúc

## 1. Tóm tắt để ra quyết định

- **Mode:** `design-new`
- **Mục tiêu kỹ thuật:** Xây prototype web cục bộ, dùng dữ liệu giả, chứng minh TideCloak thực thi danh tính, policy và governance thay vì chỉ mô phỏng trên giao diện.
- **Kết luận feasibility:** Khả thi có điều kiện.
- **Khuyến nghị chính:** Một ứng dụng Next.js + TypeScript, PostgreSQL cục bộ và TideCloak Dev chạy Docker. Dùng OIDC/TideCloak cho identity; QEA cho governed admin writes; Forseti C# contract là policy authority cho hành động cấp quyền/chia sẻ nhạy cảm.
- **Vì sao:** Ít thành phần vận hành cho demo nhưng vẫn tách rõ application data, identity và cryptographic authority.
- **Quyết định kỹ thuật đã xác nhận:** Triển khai cục bộ để demo; codebase duy nhất Next.js + TypeScript.

## 2. Nguồn và phạm vi đã đọc

- **Product spec:** `docs/product/product.md`, trạng thái `APPROVED`, ngày 2026-10-22.
- **Architecture/code/config:** Workspace chưa có ứng dụng triển khai tại thời điểm đánh giá. Đã đọc tài liệu chính thức TideCloak về OIDC, dev container, QEA và Forseti.
- **Phạm vi đánh giá:** Kiến trúc prototype cục bộ, tích hợp TideCloak, phân tách quyền, persistence và safeguards.
- **Phần không đánh giá:** Tích hợp bệnh viện/EHR thật, vận hành production, compliance pháp lý và thiết kế database chi tiết.

## 3. Trace product requirement sang kiến trúc

| Product requirement hoặc constraint | Architectural response | Feasibility | Risk/dependency |
| --- | --- | --- | --- |
| Dữ liệu chỉ mở khi identity, quan hệ, scope, mục đích, approval và hạn dùng hợp lệ | Protected route/service kiểm tra token TideCloak và policy state trước khi trả bất kỳ payload nào; Forseti policy quyết định authority cryptographic | Khả thi có điều kiện | Cần realm, client, roles và policy được provision đúng |
| Không có admin override | Không có route hay service grant toàn cục; role admin không map tới quyền đọc dữ liệu hồ sơ | Khả thi | Cần review mọi protected route |
| Một người giám hộ cho ca khám thường | Approval state thuộc application data; grant chỉ hiện hữu sau đúng approval | Khả thi | Cần ràng buộc người yêu cầu khác người duyệt |
| Hai giám hộ cho chia sẻ ngoài | Policy payload gồm hai approver độc lập; no-share trước khi policy pass | Khả thi có điều kiện | Forseti/approval evidence cần test end-to-end |
| Hai bác sĩ độc lập cho cấp cứu | Policy kiểm tra distinct subject, lý do, scope emergency-only và expiry | Khả thi | Cần chống self-confirmation ở server và policy |
| Privacy + Compliance cùng duyệt thay đổi nhạy cảm | QEA giữ governed write; Forseti/role validation ràng buộc vai trò nghiệp vụ | Khả thi có điều kiện | QEA threshold mặc định là M-of-N, không tự hiểu “đúng hai role” |
| Audit không bị sửa/xóa | Chỉ service append audit event; database role application không cấp mutation public; audit hiển thị theo role | Khả thi | Prototype không nên tuyên bố immutable ledger production |
| Dữ liệu giả, local demo | Seed dữ liệu giả; Docker volume cục bộ; không có cloud deployment | Khả thi | Không nạp dữ liệu bệnh nhân thật |

## 4. Đánh giá feasibility và rủi ro

- **Điểm khả thi rõ:** TideCloak Dev có Docker image và luồng khởi tạo realm/client cho local development. TideCloak dùng OIDC/OAuth chuẩn, có SDK Next.js và hỗ trợ QEA.
- **Constraint kỹ thuật:** TideCloak dev realm cần được người vận hành hoàn tất enrolment/license trong browser. Máy chạy demo cần Docker, Node.js LTS và Internet để bước Tide identity/Fabric hoạt động.
- **Risk cần giảm thiểu:** QEA theo ngưỡng admin không thay thế hoàn toàn rule business yêu cầu chính xác Privacy + Compliance; do đó không được xem UI hoặc QEA threshold thuần túy là đủ cho mọi policy nghiệp vụ.
- **Dependency ngoài:** `tideorg/tidecloak-dev`, Tide identity/Fabric, adapter cấu hình client TideCloak, PostgreSQL local.
- **Giả định kỹ thuật:** Prototype dùng free developer license và số user demo trong giới hạn của license; policy contract/deployment theo SDK hiện hành của Tide.

## 5. Các lựa chọn kiến trúc quan trọng

| Quyết định | Phương án | Ưu điểm | Nhược điểm | Khuyến nghị |
| --- | --- | --- | --- | --- |
| Ứng dụng web | Next.js monolith | Một repo, route handlers bảo vệ API sát UI, được TideCloak quickstart hỗ trợ | Không độc lập scale frontend/backend | Chọn cho prototype |
| Ứng dụng web | Vite + Fastify | Ranh giới tách rõ | Thêm deploy/dev config và code integration | Không chọn cho MVP |
| Identity | TideCloak Dev OIDC | Thực thi identity ngoài app, OIDC chuẩn | Cần Docker/enrolment | Chọn |
| Policy authority | UI/backend tự quyết | Nhanh nhưng có thể bị bypass và không đạt demo intent | Không chứng minh authority control | Không chọn |
| Policy authority | Forseti + backend PEP | Policy authority nằm ở Fabric; backend vẫn lọc dữ liệu/audit | Cần C# contract, policy setup và test tích hợp | Chọn |
| Governance | QEA-only | Governed writes sẵn có | Không diễn đạt chắc chắn ràng buộc đích danh Privacy + Compliance | Dùng cùng policy role validation |

## 6. Kiến trúc đề xuất

### Thành phần và trách nhiệm

1. **Next.js web application:** Cung cấp các màn dashboard/request/approval/audit/policy; không coi UI là điểm thực thi quyền.
2. **Next.js protected route handlers/services:** Xác minh access token TideCloak, tải policy state tối thiểu, kiểm tra deny-by-default và chỉ trả nhóm dữ liệu hợp lệ; tạo audit event.
3. **PostgreSQL local:** Lưu dữ liệu fake, relationship, consultation, request, approval, grant, policy proposal và audit event. Không lưu secret Tide hay dữ liệu bệnh nhân thật.
4. **TideCloak Dev:** Identity provider/issuer OIDC, role claims và QEA cho governed administrative changes.
5. **Forseti contract:** C# policy mô tả executor role, request payload, expiry, approver distinctness/quorum và constraints cấp emergency/chia sẻ. Contract được commit vào Tide Fabric; application giữ contract/policy identifier và evidence cần thiết, không có private key authority.
6. **Docker Compose:** Khởi động PostgreSQL và TideCloak Dev cùng volume cục bộ. Next.js chạy host để thuận tiện HMR hoặc có thể chạy container sau.

### Luồng hoạt động và loại dữ liệu

1. Người dùng đăng nhập qua TideCloak; browser nhận phiên/token gắn với identity/role.
2. Route hoặc server action nhận thao tác, lấy token từ phiên và xác minh server-side trước khi đọc dữ liệu.
3. Với request thường, service ghi request/audit nhưng không trả hồ sơ. Approver hợp lệ ghi quyết định; grant chỉ trở thành usable khi đầy đủ điều kiện.
4. Khi có yêu cầu xem/chia sẻ/cấp cứu, service xây policy payload tối thiểu. Forseti kiểm tra payload, approvers và executor cho thao tác cryptographic/policy-governed tương ứng. Nếu policy fail, không phát authority và API trả deny không kèm nội dung hồ sơ.
5. Khi policy pass và grant còn hiệu lực, service trả đúng data group fake đã yêu cầu. Mỗi access/deny/revoke/expiry tạo audit event.
6. Admin policy change đi qua QEA: thay đổi nhạy cảm trở thành change request; chỉ sau quorum workflow mới áp dụng. Rule nghiệp vụ bắt buộc Privacy + Compliance được xác minh thêm trong policy layer.

### Công nghệ đề xuất

| Phần | Đề xuất | Lý do | Khi cần đổi |
| --- | --- | --- | --- |
| Web/API | Next.js App Router + TypeScript | Một codebase, server-side guards, local demo nhanh | Tách Fastify khi có app client khác hoặc domain lớn hơn |
| Identity | TideCloak Dev + OIDC + SDK Next.js | Theo quickstart/vendor support, user/session gắn Fabric | Production cần realm/license/hosting chính thức |
| Policy | Forseti C# contract + Tide SDK | Enforce điều kiện authority ngoài UI/backend | Chỉ đổi sau khi vendor xác nhận capability không hỗ trợ use case |
| Data | PostgreSQL 16 local | Quan hệ/transaction/audit rõ ràng | Không đổi cho prototype |
| Data access | Prisma ORM + migrations | Type-safe, seed fake data, developer-friendly | Đổi khi đội có ORM chuẩn khác |
| Local runtime | Docker Compose | Lặp lại môi trường TideCloak/Postgres | Không cần cloud khi chỉ demo cục bộ |

## 7. Chạy dự án và nơi triển khai

Chỉ chạy local. Docker Compose quản lý TideCloak Dev và PostgreSQL với persistent volumes không được commit. Next.js chạy trên `localhost`; TideCloak client phải cấu hình exact local redirect URI/web origin, không dùng wildcard. Không chọn nhà cung cấp cloud.

## 8. Security, reliability và operations

| Safeguard | Risk/requirement liên quan | Cách đáp ứng | Trade-off |
| --- | --- | --- | --- |
| Server-side token validation | UI hide button bị bypass | Mọi route dữ liệu kiểm token/role/server policy trước query | Tăng code guard/test |
| Fail closed | Deny by default | Identity, relation, scope, purpose, expiry, approval hoặc Forseti evidence thiếu đều trả deny | Demo cần state rõ ràng |
| No admin read grant | No master key | Không map admin role tới record-data access; test negative route | Admin không thể hỗ trợ bằng bypass |
| Forseti policy boundary | Authority không ở app server | Contract governs policy-backed operation; config/contract ID không hardcode vào client | Cần setup Fabric/contract |
| QEA change request | Admin policy không đơn phương | Governed changes qua approval workflow; audit outcome | Cần chuẩn bị nhiều admin role demo |
| Secrets/config | Không lộ credentials | `.env.local` gitignored; adapter/config public chỉ chứa client setting được vendor cho phép | Cần onboarding setup |
| Audit minimization | Truy vết không lộ bệnh án | Log event metadata, không log record content hay token | Chi tiết điều tra bị giới hạn |
| Integration degraded mode | TideCloak/Fabric unavailable | Không xác thực/policy được thì protected action fail closed; UI báo không thể hoàn thành | Không hỗ trợ offline access |
| Local data recovery | Demo không mất fake setup | Docker named/local volume + documented reset/seed | Không phải backup production |

## 9. Blocker cần trả về Product

**Không có PRODUCT_BLOCKER.**

## 10. Giả định và câu hỏi kỹ thuật còn mở

- Cần xác nhận qua Tide MCP/SDK trong lúc triển khai: deployment workflow chính xác của Forseti contract và policy-forwarded operation phù hợp nhất cho payload GuardianGate.
- QEA cần có số/role administrator demo phù hợp với threshold. QEA không tự đảm bảo “Privacy + Compliance” nếu chỉ cấu hình threshold, vì vậy contract/policy role check là bắt buộc.
- User vận hành local sẽ hoàn tất wizard Tide account/realm/client và download adapter configuration; source repository không chứa adapter private setting hay secret.
