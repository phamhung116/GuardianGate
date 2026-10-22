# GuardianGate

Prototype local về kiểm soát truy cập hồ sơ y tế trẻ em bằng dữ liệu giả. Đây là **codebase đang phát triển**, chưa phải bản demo hoàn chỉnh.

## Điểm bắt đầu cho người tiếp quản

- [Product spec](docs/product/product.md), [Architecture](docs/architecture/architecture.md), [Database spec](docs/database/database.md) là ba nguồn yêu cầu đã duyệt.
- [Backend delivery plan](docs/backend/plan.md) ghi trạng thái từng task, bằng chứng đã kiểm tra và việc kế tiếp.
- Project skills nằm trong `.agents/skills/`; áp dụng các policy invariant khi xây protected route.

Hiện có Next.js 16 + TypeScript, Prisma/PostgreSQL 16, cấu hình public TideCloak OIDC, endpoint `/api/v1/health` và `/api/v1/me`, migration và seed dữ liệu giả. `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` đã chạy thành công ngày 2026-10-22. Migration/seed đã chạy trên PostgreSQL local. Các luồng ordinary access, external sharing, emergency, policy governance và frontend nghiệp vụ **chưa triển khai**. Chưa có Forseti contract, QEA enrollment hay OpenAPI handoff.

## Chạy local

Yêu cầu Node.js 24+, Docker và một TideCloak Dev realm đã cấu hình. Copy `.env.example` thành `.env` và `.env.local`; các giá trị demo là `TIDECLOAK_REALM=guardiangate` và `TIDECLOAK_CLIENT_ID=guardiangate-web`. Đây là định danh, không phải credential. PostgreSQL được ánh xạ qua cổng host `5434` để tránh xung đột cổng `5432` trên máy phát triển ban đầu.

```powershell
docker compose up -d postgres
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

TideCloak Dev chạy riêng trên `http://localhost:8080`. Instance trên máy tác giả đã có realm `guardiangate`, client public `guardiangate-web` và năm realm role (`doctor`, `guardian`, `admin`, `privacy_officer`, `compliance_approver`), nhưng trạng thái container không nằm trong Git. Khi setup trên máy khác, cần provision lại realm/client, hoàn tất Tide account enrollment/license, kiểm tra redirect URI `http://localhost:3000/auth/redirect` và web origin `http://localhost:3000`. Xem [TideCloak Quickstart](https://docs.tide.org/Admin/Quick-deploy-test). Public adapter nằm ở `tidecloakAdapter.json`; xác minh realm/client của môi trường mới trước khi sử dụng.

API `/api/v1/me` chặn request thiếu access token. Chưa có login UI hay người dùng Tide thực để xác nhận đường đăng nhập thành công. Seed DB dùng `tide_subject` giả; người tiếp quản cần map các tài khoản Tide thật vào `app_users` cho demo end to end. Không dùng dữ liệu bệnh nhân thật.

## Việc kế tiếp

1. Hoàn tất Tide enrollment, tạo user demo và kiểm tra token/role thực tế; hoàn thành BE-001 và BE-003.
2. Hoàn tất audit service append-only và integration test cho BE-002.
3. Xây ordinary/external, emergency/Forseti, policy governance, OpenAPI và UI theo plan.

Không commit `.env`, `.env.local`, token, secret, Docker volume hoặc dữ liệu runtime.
